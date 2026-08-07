const { insertOne, selectMany, selectOne, updateRows, deleteRows } = require('../services/supabaseRepository');
const { parseServers } = require('../services/serverNormalizer');

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'b24af203b14e23f8c91844baae37cfab';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY || TMDB_API_KEY === 'b24af203b14e23f8c91844baae37cfab') {
  console.error('CRITICAL: TMDB_API_KEY is not configured or is using the default placeholder. TMDb requests will fail.');
}

const TMDB_LANGUAGE = 'es-ES';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

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

  const result = {
    id: movie.id,
    tmdb_id: movie.tmdb_id || null,
    title: movie.title,
    original_title: movie.original_title || movie.title || '',
    description: movie.overview || movie.description || '',
    overview: movie.overview || '',
    poster_url: movie.poster_url || '',
    banner_url: movie.banner_url || '',
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
    banner_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : '',
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
    const movies = await selectMany('movies', { order: { column: 'created_at', ascending: false } });
    console.log('AUDIT listMovies RAW:', JSON.stringify(movies, null, 2));
    const serialized = movies.map((movie) => {
      const result = serializeMovie(movie);
      console.log('AUDIT serializeMovie RAW:', JSON.stringify(movie, null, 2), 'SERIALIZED:', JSON.stringify(result, null, 2));
      return result;
    });
    console.log('AUDIT listMovies RESPONSE:', JSON.stringify(serialized, null, 2));
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

const createMovie = async (req, res, next) => {
  try {
    const {
      tmdb_id,
      title,
      original_title = '',
      description = '',
      overview = '',
      poster_url,
      banner_url,
      release_year = 0,
      runtime = 0,
      country = '',
      language = '',
      genres = '',
      rating = '',
      cast = '',
      director = '',
      trailer = '',
      servers = [],
      featured = false,
      status = 'published'
    } = req.body;

    const resolvedTitle = String(title || '').trim();
    if (!resolvedTitle) {
      return res.status(400).json({ message: 'El título es obligatorio' });
    }

    let tmdbPayload = null;
    if (tmdb_id || req.body.tmdbId) {
      tmdbPayload = await buildTmdbMoviePayload(req.body.tmdbId || tmdb_id);
      console.log('AUDIT createMovie TMDb payload:', JSON.stringify(tmdbPayload, null, 2));
    }

    const normalizedGenres = normalizeGenres(genres);
    const normalizedCast = normalizeCast(cast);
    const parsedServers = parseServers(servers);

    const insertPayload = {
      tmdb_id: toInteger(req.body.tmdbId || tmdb_id, null),
      title: resolvedTitle,
      original_title: String(original_title || tmdbPayload?.original_title || '').trim(),
      description: String(description || tmdbPayload?.description || '').trim(),
      overview: String(overview || tmdbPayload?.overview || '').trim(),
      poster_url: String(req.body.poster_url || tmdbPayload?.poster_url || '').trim(),
      banner_url: String(req.body.banner_url || tmdbPayload?.banner_url || '').trim(),
      release_year: toInteger(release_year || tmdbPayload?.release_year || 0, 0),
      runtime: toInteger(runtime || tmdbPayload?.runtime || 0, 0),
      country: String(country || '').trim(),
      language: String(language || '').trim(),
      genres: normalizedGenres.length ? normalizedGenres : (tmdbPayload?.genres || []),
      rating: String(rating || '').trim(),
      cast: normalizedCast.length ? normalizedCast : [],
      director: String(director || '').trim(),
      trailer: String(trailer || tmdbPayload?.trailer || '').trim(),
      servers: parsedServers,
      featured: toBoolean(featured),
      status: String(status || 'published'),
      popularity: toInteger(tmdbPayload?.popularity || 0, 0),
      created_by: req.user?.id || null
    };
    console.log('AUDIT createMovie INSERT payload:', JSON.stringify(insertPayload, null, 2));

    const movie = await insertOne('movies', insertPayload);
    console.log('AUDIT createMovie INSERT result:', JSON.stringify(movie, null, 2));

    return res.status(201).json({ message: 'Película guardada correctamente', movie: serializeMovie(movie) });
  } catch (error) {
    if (String(error.code || '').includes('23505') || String(error.message || '').includes('duplicate')) {
      return res.status(409).json({ message: 'Ya existe una película con ese TMDB ID' });
    }
    return next(error);
  }
};

const updateMovie = async (req, res, next) => {
  try {
    const movie = await selectOne('movies', {
      filters: [{ type: 'eq', column: 'id', value: req.params.movieId }]
    });

    if (!movie) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    const {
      title,
      original_title,
      description,
      overview,
      poster_url, // Use correct field name
      banner_url, // Use correct field name
      release_year,
      runtime,
      country,
      language,
      genres,
      rating,
      cast,
      director,
      trailer,
      servers,
      featured,
      status
    } = req.body;

    const updatePayload = {};

    if (title !== undefined) updatePayload.title = String(title).trim();
    if (original_title !== undefined) updatePayload.original_title = String(original_title).trim();
    if (description !== undefined) updatePayload.description = String(description).trim();
    if (overview !== undefined) updatePayload.overview = String(overview).trim();
    if (poster_url !== undefined) updatePayload.poster_url = String(poster_url).trim();
    if (banner_url !== undefined) updatePayload.banner_url = String(banner_url).trim();
    if (release_year !== undefined) updatePayload.release_year = toInteger(release_year, movie.release_year);
    if (runtime !== undefined) updatePayload.runtime = toInteger(runtime, movie.runtime);
    if (country !== undefined) updatePayload.country = String(country).trim();
    if (language !== undefined) updatePayload.language = String(language).trim();
    if (genres !== undefined) updatePayload.genres = normalizeGenres(genres);
    if (rating !== undefined) updatePayload.rating = String(rating).trim();
    if (cast !== undefined) updatePayload.cast = normalizeCast(cast);
    if (director !== undefined) updatePayload.director = String(director).trim();
    if (trailer !== undefined) updatePayload.trailer = String(trailer).trim();
    if (servers !== undefined) {
      const parsedServers = parseServers(servers);
      updatePayload.servers = parsedServers;
    }
    if (featured !== undefined) updatePayload.featured = toBoolean(featured);
    if (status !== undefined) updatePayload.status = String(status);

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ message: 'No se enviaron datos para actualizar' });
    }

    const updatedRows = await updateRows('movies', [{ type: 'eq', column: 'id', value: req.params.movieId }], updatePayload);

    return res.json({ message: 'Película actualizada correctamente', movie: serializeMovie(updatedRows[0] || movie) });
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
  createMovie,
  updateMovie,
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
