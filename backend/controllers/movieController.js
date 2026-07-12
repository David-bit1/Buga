const { insertOne, selectMany, selectOne, updateRows, deleteRows } = require('../services/supabaseRepository');

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'b24af203b14e23f8c91844baae37cfab';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
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

const parseServers = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry) {
          return null;
        }

        if (typeof entry === 'string') {
          return { name: 'Servidor 1', type: 'iframe', url: entry.trim() };
        }

        const url = String(entry.url || entry.link || entry.value || '').trim();
        if (!url) {
          return null;
        }

        return {
          name: String(entry.name || entry.label || 'Servidor').trim() || 'Servidor',
          type: String(entry.type || 'iframe').toLowerCase().trim() || 'iframe',
          url,
          status: String(entry.status || 'active'),
          order: Number(entry.order || 0)
        };
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return parseServers(parsed);
    } catch {
      return trimmed
        .split(/\n|\r/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((url, index) => ({
          name: `Servidor ${index + 1}`,
          type: 'iframe',
          url,
          status: 'active',
          order: index
        }));
    }
  }

  return [];
};

const serializeMovie = (movie) => {
  return {
    id: movie.id,
    tmdb_id: movie.tmdb_id || null,
    title: movie.title,
    original_title: movie.original_title || '',
    description: movie.description || '',
    overview: movie.overview || '',
    poster_url: movie.poster_url || '',
    banner_url: movie.banner_url || '',
    release_year: movie.release_year || 0,
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
};

const tmdbFetch = async (path) => {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', TMDB_LANGUAGE);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB respondió con ${response.status}`);
  }

  return response.json();
};

const buildTmdbMoviePayload = async (tmdbId) => {
  if (!tmdbId) {
    return null;
  }

  const movie = await tmdbFetch(`/movie/${tmdbId}`);
  const credits = await tmdbFetch(`/movie/${tmdbId}/credits`);
  const videos = await tmdbFetch(`/movie/${tmdbId}/videos`);

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

  return {
    tmdb_id: Number(movie.id),
    title: String(movie.title || movie.original_title || '').trim(),
    original_title: String(movie.original_title || movie.title || '').trim(),
    description: String(movie.overview || '').trim(),
    overview: String(movie.overview || '').trim(),
    poster_url: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : '',
    banner_url: movie.backdrop_path ? `${TMDB_IMAGE_BASE}${movie.backdrop_path}` : '',
    release_year: toInteger(String(movie.release_date || '').slice(0, 4), 0),
    runtime: toInteger(movie.runtime, 0),
    country: movie.origin_country && Array.isArray(movie.origin_country) && movie.origin_country.length > 0 
      ? movie.origin_country[0] 
      : '',
    language: movie.original_language || '',
    genres,
    rating: '',
    cast,
    director,
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer}` : '',
    popularity: Number(movie.popularity || 0)
  };
};

const listMovies = async (_req, res, next) => {
  try {
    const movies = await selectMany('movies', { order: { column: 'created_at', ascending: false } });
    return res.json({ movies: movies.map(serializeMovie) });
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

    return res.json({ movie: serializeMovie(movie) });
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
    if (movie) {
      return res.json({ movie: serializeMovie(movie) });
    }

    const tmdbPayload = await buildTmdbMoviePayload(tmdbId);
    if (!tmdbPayload) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    return res.json({ movie: { ...serializeMovie({ ...tmdbPayload, id: null }), tmdb: true } });
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
      poster_url = '',
      banner_url = '',
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
    }

    const normalizedGenres = normalizeGenres(genres);
    const normalizedCast = normalizeCast(cast);
    const parsedServers = parseServers(servers);

    const movie = await insertOne('movies', {
      tmdb_id: toInteger(req.body.tmdbId || tmdb_id, null),
      title: resolvedTitle,
      original_title: String(original_title || tmdbPayload?.original_title || '').trim(),
      description: String(description || tmdbPayload?.description || '').trim(),
      overview: String(overview || tmdbPayload?.overview || '').trim(),
      poster_url: String(poster_url || tmdbPayload?.poster_url || '').trim(),
      banner_url: String(banner_url || tmdbPayload?.banner_url || '').trim(),
      release_year: toInteger(release_year || tmdbPayload?.release_year || 0, 0),
      runtime: toInteger(runtime || tmdbPayload?.runtime || 0, 0),
      country: String(country || '').trim(),
      language: String(language || '').trim(),
      genres: normalizedGenres.length ? normalizedGenres : (tmdbPayload?.genres || []),
      rating: String(rating || '').trim(),
      cast: normalizedCast.length ? normalizedCast : [],
      director: String(director || '').trim(),
      trailer: String(trailer || tmdbPayload?.trailer || '').trim(),
      servers: JSON.stringify(parsedServers.length ? parsedServers : []),
      servers: parsedServers,
      featured: toBoolean(featured),
      status: String(status || 'published'),
      popularity: toInteger(tmdbPayload?.popularity || 0, 0),
      created_by: req.user?.id || null
    });

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
      poster_url,
      banner_url,
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
      updatePayload.servers = JSON.stringify(parsedServers);
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
  deleteMovie
};
