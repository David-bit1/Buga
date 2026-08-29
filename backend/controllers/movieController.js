const { insertOne, selectMany, selectOne, updateRows, deleteRows } = require('../services/supabaseRepository');
const { parseServers } = require('../services/serverNormalizer');
const {
  tmdbFetch,
  buildTmdbMoviePayload,
  buildTmdbSeriesPayload,
  toInteger,
  TMDB_IMAGE_BASE,
  TMDB_IMAGE_BASE_W780,
  TMDB_REQUEST_TIMEOUT_MS,
  TMDB_LANGUAGE,
  TMDB_API_KEY,
  TMDB_BASE_URL,
  requestWithTimeout
} = require('../utils/tmdb');

const normalizeGenres = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return String(item).trim();
        }

        if (item && typeof item === 'object') {
          return String(item.name || item.title || item.label || item.value || '').trim();
        }

        return '';
      })
      .filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeCast = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return String(item).trim();
        }

        if (item && typeof item === 'object') {
          return String(item.name || item.title || item.label || item.value || '').trim();
        }

        return '';
      })
      .filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const hasMeaningfulValue = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0;
  }

  return value !== undefined && value !== null;
};

const preferFallbackValue = (primary, fallback) => (hasMeaningfulValue(primary) ? primary : fallback);

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
    const page = Math.max(1, parseInt(_req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(_req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const movies = await selectMany('movies', {
      filters: [{ type: 'eq', column: 'status', value: 'published' }],
      order: { column: 'created_at', ascending: false },
      limit,
      offset
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
    console.log('[BUGA GET RESPONSE]', JSON.stringify({ movies: serialized, page, limit }, null, 2));
    return res.json({ movies: serialized, page, limit });
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
    console.log('[BUGA GET RESPONSE]', JSON.stringify({ movie: serialized }, null, 2));
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
    console.log('[BUGA SUPABASE SELECT ROW]', JSON.stringify(movie, null, 2));
    const tmdbPayload = await buildTmdbMoviePayload(tmdbId);
    console.log('[BUGA TMDB FALLBACK PAYLOAD]', JSON.stringify(tmdbPayload, null, 2));
    if (!tmdbPayload) {
      if (!movie) {
        return res.status(404).json({ message: 'Película no encontrada' });
      }

      return res.json({ movie: serializeMovie(movie), tmdb: false });
    }

    const serializedStoredMovie = movie ? serializeMovie(movie) : null;
    const serializedTmdbMovie = serializeMovie({ ...tmdbPayload, id: movie?.id || null });

    const mergedMovie = serializedStoredMovie
      ? {
          ...serializedTmdbMovie,
          ...serializedStoredMovie,
          title: preferFallbackValue(serializedStoredMovie.title, serializedTmdbMovie.title),
          original_title: preferFallbackValue(serializedStoredMovie.original_title, serializedTmdbMovie.original_title),
          description: preferFallbackValue(serializedStoredMovie.description, serializedTmdbMovie.description),
          overview: preferFallbackValue(serializedStoredMovie.overview, serializedTmdbMovie.overview),
          poster_url: preferFallbackValue(serializedStoredMovie.poster_url, serializedTmdbMovie.poster_url),
          banner_url: preferFallbackValue(serializedStoredMovie.banner_url, serializedTmdbMovie.banner_url),
          poster_srcset: preferFallbackValue(serializedStoredMovie.poster_srcset, serializedTmdbMovie.poster_srcset),
          banner_srcset: preferFallbackValue(serializedStoredMovie.banner_srcset, serializedTmdbMovie.banner_srcset),
          release_year: preferFallbackValue(serializedStoredMovie.release_year, serializedTmdbMovie.release_year),
          release_date: preferFallbackValue(serializedStoredMovie.release_date, serializedTmdbMovie.release_date),
          runtime: preferFallbackValue(serializedStoredMovie.runtime, serializedTmdbMovie.runtime),
          country: preferFallbackValue(serializedStoredMovie.country, serializedTmdbMovie.country),
          language: preferFallbackValue(serializedStoredMovie.language, serializedTmdbMovie.language),
          genres: preferFallbackValue(serializedStoredMovie.genres, serializedTmdbMovie.genres),
          rating: preferFallbackValue(serializedStoredMovie.rating, serializedTmdbMovie.rating),
          cast: preferFallbackValue(serializedStoredMovie.cast, serializedTmdbMovie.cast),
          director: preferFallbackValue(serializedStoredMovie.director, serializedTmdbMovie.director),
          trailer: preferFallbackValue(serializedStoredMovie.trailer, serializedTmdbMovie.trailer),
          popularity: preferFallbackValue(serializedStoredMovie.popularity, serializedTmdbMovie.popularity)
        }
      : serializedTmdbMovie;

    console.log('[BUGA GET RESPONSE]', JSON.stringify({
      movie: mergedMovie,
      tmdb: !movie
    }, null, 2));
    return res.json({
      movie: mergedMovie,
      tmdb: !movie
    });
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
