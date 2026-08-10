const { insertOne, selectMany, selectOne, updateRows, deleteRows } = require('../services/supabaseRepository');
const { parseServers } = require('../services/serverNormalizer');

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'b24af203b14e23f8c91844baae37cfab';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY || TMDB_API_KEY === 'b24af203b14e23f8c91844baae37cfab') {
  console.error('CRITICAL: TMDB_API_KEY is not configured or is using the default placeholder. TMDb requests will fail.');
}

const TMDB_LANGUAGE = 'es-ES';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMAGE_BASE_W780 = 'https://image.tmdb.org/t/p/w780';

const normalizeGenres = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeCast = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const toBoolean = (value) =>
  value === true || value === 'true' || value === 1 || value === '1' || value === 'on';

const serializeMovie = (movie) => {
  const releaseYear = movie.release_year || (movie.release_date ? String(movie.release_date).slice(0, 4) : 0);
  const parsedYear = toInteger(String(releaseYear), 0);

  // Generate srcset for poster if it's a TMDB w500 URL
  let poster_srcset = movie.poster_srcset || '';
  if (!poster_srcset && movie.poster_url && movie.poster_url.includes('/p/w500/')) {
    const posterPath = movie.poster_url.split('/p/w500/')[1];
    poster_srcset = `https://image.tmdb.org/t/p/w185/${posterPath} 185w, https://image.tmdb.org/t/p/w342/${posterPath} 342w, ${movie.poster_url} 500w`;
  }

  // Generate srcset for banner if it's a TMDB w780 URL
  let banner_srcset = movie.banner_srcset || '';
  if (!banner_srcset && movie.banner_url && movie.banner_url.includes('/p/w780/')) {
    const bannerPath = movie.banner_url.split('/p/w780/')[1];
    banner_srcset = `https://image.tmdb.org/t/p/w300/${bannerPath} 300w, ${movie.banner_url} 780w, https://image.tmdb.org/t/p/w1280/${bannerPath} 1280w`;
  }

  const result = {
    id: movie.id,
    tmdb_id: movie.tmdb_id || null,
    title: movie.title,
    original_title: movie.original_title || movie.title || '',
    description: movie.overview || movie.description || '',
    overview: movie.overview || '',
    poster_url: movie.poster_url || '',
    banner_url: movie.banner_url || '',
    poster_srcset,
    banner_srcset,
    release_year: parsedYear,
    release_date: movie.release_date || (parsedYear > 0 ? `${parsedYear}-01-01` : ''),
    runtime: movie.runtime || 0,
    country: movie.country || '',
    language: movie.language || '',
    genres: movie.genres || [],
    rating: movie.rating || '',
    cast: movie.cast || [],
    director: movie.director || '',
    trailer: movie.trailer || '',
    servers: movie.servers || [],
    featured: Boolean(movie.featured),
    status: movie.status || 'published',
    popularity: movie.popularity || 0,
    content_type: movie.content_type || 'independent',
    creator_name: movie.creator_name || '',
    rights_holder: movie.rights_holder || '',
    license_info: movie.license_info || '',
    source_url: movie.source_url || '',
    created_by: movie.created_by,
    created_at: movie.created_at,
    updated_at: movie.updated_at
  };

  if (process.env.NODE_ENV !== 'production') {
    console.log('AUDIT serializeMovie RAW:', JSON.stringify(movie, null, 2), 'RESULT:', JSON.stringify(result, null, 2));
  }

  return result;
};

const tmdbFetch = async (path) => {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', TMDB_LANGUAGE);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Could not read error body');
      const partialUrl = `${url.origin}${url.pathname}?api_key=...&language=${TMDB_LANGUAGE}`;
      console.error(`TMDb API Error:
  - Status: ${response.status} ${response.statusText}
  - URL: ${partialUrl}
  - Body: ${errorBody}`);
      throw new Error(`TMDb responded with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Network or fetch error when calling TMDb: ${error.message}`, error);
    // Re-throw the error to be handled by the calling function
    throw error;
  }
};

const buildTmdbMoviePayload = async (tmdbId) => {
  if (!tmdbId) {
    return null;
  }

  // Usar append_to_response para obtener créditos y videos en una sola llamada a la API
  const movie = await tmdbFetch(`/movie/${tmdbId}?append_to_response=credits,videos`);

  const credits = movie.credits || {};
  const videos = movie.videos || {};

  const genres = Array.isArray(movie.genres)
    ? movie.genres.map((genre) => genre.name).filter(Boolean)
    : [];

  // Get trailer from videos (first YouTube trailer)
  const trailer = (Array.isArray(videos.results) ? videos.results : [])
    .find(video => 
      video.site === 'YouTube' && 
      (video.type === 'Trailer' || video.type === 'Teaser')
    )?.key || '';

  // Get cast (top 10)
  const cast = Array.isArray(credits.cast) ? credits.cast.slice(0, 10).map(c => c.name) : [];

  // Get director
  const director = (Array.isArray(credits.crew) ? credits.crew : [])
    .find(person => person.job === 'Director')?.name || '';

  const payload = {
    tmdb_id: Number(movie.id),
    title: String(movie.title || movie.original_title || '').trim(),
    original_title: String(movie.original_title || movie.title || '').trim(),
    description: String(movie.overview || '').trim(),
    overview: String(movie.overview || '').trim(),
    poster_url: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : '',
    poster_srcset: movie.poster_path
      ? `https://image.tmdb.org/t/p/w185${movie.poster_path} 185w, https://image.tmdb.org/t/p/w342${movie.poster_path} 342w, https://image.tmdb.org/t/p/w500${movie.poster_path} 500w`
      : '',
    banner_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : '',
    banner_srcset: movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w300${movie.backdrop_path} 300w, https://image.tmdb.org/t/p/w780${movie.backdrop_path} 780w, https://image.tmdb.org/t/p/w1280${movie.backdrop_path} 1280w`
      : '',
    release_year: toInteger(String(movie.release_date || '').slice(0, 4), 0),
    release_date: movie.release_date || '',
    runtime: toInteger(movie.runtime, 0),
    country: movie.origin_country && Array.isArray(movie.origin_country) && movie.origin_country.length > 0 
      ? movie.origin_country[0] 
      : '',
    language: movie.original_language || '',
    genres,
    rating: movie.vote_average > 0 ? String(movie.vote_average.toFixed(1)) : '',
    cast,
    director,
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer}` : '',
    popularity: Number(movie.popularity || 0)
  };

  console.log('AUDIT buildTmdbMoviePayload result:', JSON.stringify(payload, null, 2));
  return payload;
};

const getPopular = async (req, res, next) => {
  try {
    const type = req.params.type === 'tv' ? 'tv' : 'movie';
    const page = req.query.page || '1';
    const data = await tmdbFetch(`/${type}/popular?page=${page}`);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
};

const listMovies = async (_req, res, next) => {
  try {
    const movies = await selectMany('movies', {
      filters: [{ type: 'eq', column: 'status', value: 'published' }],
      order: { column: 'created_at', ascending: false }
    });
    const serialized = movies.map((movie) => {
      // Add srcset here for movies from DB
      if (movie.poster_url && movie.poster_url.includes('/p/w500/')) {
        const posterPath = movie.poster_url.split('/p/w500/')[1];
        movie.poster_srcset = `https://image.tmdb.org/t/p/w185/${posterPath} 185w, https://image.tmdb.org/t/p/w342/${posterPath} 342w, ${movie.poster_url} 500w`;
      }

      const result = serializeMovie(movie);
      return result;
    });
    return res.json({ movies: serialized });
  } catch (error) {
    return next(error);
  }
};

const getMovie = async (req, res, next) => {
  try {
    const movie = await selectOne('movies', { filters: [{ type: 'eq', column: 'id', value: req.params.movieId }] });

    if (!movie) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    console.log('AUDIT getMovie RAW:', JSON.stringify(movie, null, 2));
    const serialized = serializeMovie(movie);
    console.log('AUDIT getMovie SERIALIZED:', JSON.stringify(serialized, null, 2));
    return res.json({ movie: serialized });
  } catch (error) {
    return next(error);
  }
};

const getMovieByTmdbId = async (req, res, next) => {
  try {
    const tmdbId = Number(req.params.tmdbId || req.query.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ message: 'tmdbId inválido' });
    }

    const movie = await selectOne('movies', { filters: [{ type: 'eq', column: 'tmdb_id', value: tmdbId }] });
    console.log('AUDIT getMovieByTmdbId Supabase result:', JSON.stringify(movie, null, 2));
    if (movie) {
      return res.json(serializeMovie(movie));
    }

    const tmdbPayload = await buildTmdbMoviePayload(tmdbId);
    console.log('AUDIT getMovieByTmdbId TMDb fallback payload:', JSON.stringify(tmdbPayload, null, 2));
    if (!tmdbPayload) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    return res.json({ ...serializeMovie({ ...tmdbPayload, id: null }), tmdb: true });
  } catch (error) {
    return next(error);
  }
};

const deleteMovie = async (req, res, next) => {
  try {
    const movie = await selectOne('movies', {
      filters: [{ type: 'eq', column: 'id', value: req.params.movieId }]
    });

    if (!movie) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    await deleteRows('movies', [{ type: 'eq', column: 'id', value: req.params.movieId }]);
    return res.json({ message: 'Película eliminada correctamente' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listMovies,
  getMovie,
  getMovieByTmdbId,
  deleteMovie,
  getPopular,
  serializeMovie,
  buildTmdbMoviePayload,
  tmdbFetch,
  toInteger,
  normalizeGenres,
  normalizeCast,
  parseServers,
  toBoolean
};
