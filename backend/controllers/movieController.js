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

const toInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const toBoolean = (value) =>
  value === true || value === 'true' || value === 1 || value === '1' || value === 'on';

const parsePlaybackSources = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry) {
          return null;
        }

        if (typeof entry === 'string') {
          return { name: 'Servidor', url: entry.trim() };
        }

        const url = String(entry.url || entry.link || entry.value || '').trim();
        if (!url) {
          return null;
        }

        return {
          name: String(entry.name || entry.label || 'Servidor').trim() || 'Servidor',
          url
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
      return parsePlaybackSources(parsed);
    } catch {
      return trimmed
        .split(/\n|\r/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((url) => ({ name: 'Servidor', url }));
    }
  }

  return [];
};

const serializeMovie = (movie) => {
  const playbackSources = parsePlaybackSources(movie?.source_file || movie?.video_source || movie?.video_url || '');
  const fallbackPrimaryUrl = movie?.video_url || movie?.source_file || '';
  const primaryPlayback = playbackSources[0]?.url || fallbackPrimaryUrl;

  return {
    id: movie.id,
    tmdb_id: movie.tmdb_id || null,
    title: movie.title,
    description: movie.description || movie.overview || '',
    genres: movie.genres || [],
    release_year: movie.release_year || movie.release_year || 0,
    runtime: movie.runtime || 0,
    poster_url: movie.poster_url || movie.poster || '',
    banner_url: movie.banner_url || movie.backdrop || '',
    video_url: primaryPlayback,
    playback_sources: playbackSources,
    featured: Boolean(movie.featured),
    status: movie.status,
    processing_status: movie.processing_status,
    video_source: movie.video_source,
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
  const genres = Array.isArray(movie.genres)
    ? movie.genres.map((genre) => genre.name).filter(Boolean)
    : [];
  const posterUrl = movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : '';
  const bannerUrl = movie.backdrop_path ? `${TMDB_IMAGE_BASE}${movie.backdrop_path}` : '';

  return {
    tmdb_id: Number(tmdbId),
    title: String(movie.title || movie.original_title || '').trim(),
    description: String(movie.overview || '').trim(),
    release_year: toInteger(String(movie.release_date || '').slice(0, 4), 0),
    runtime: toInteger(movie.runtime, 0),
    genres,
    poster_url: posterUrl,
    banner_url: bannerUrl
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
      description = '',
      genres = '',
      release_year = 0,
      runtime = 0,
      poster_url = '',
      banner_url = '',
      playback_sources = [],
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
    const resolvedPlaybackSources = parsePlaybackSources(playback_sources);
    const primaryPlaybackUrl = resolvedPlaybackSources[0]?.url || '';

    const movie = await insertOne('movies', {
      tmdb_id: toInteger(req.body.tmdbId || tmdb_id, null),
      title: resolvedTitle,
      description: String(description || tmdbPayload?.description || '').trim(),
      genres: normalizedGenres.length ? normalizedGenres : (tmdbPayload?.genres || []),
      release_year: toInteger(release_year || tmdbPayload?.release_year || 0, 0),
      runtime: toInteger(runtime || tmdbPayload?.runtime || 0, 0),
      poster_url: String(poster_url || tmdbPayload?.poster_url || '').trim(),
      banner_url: String(banner_url || tmdbPayload?.banner_url || '').trim(),
      video_url: primaryPlaybackUrl,
      video_source: 'external',
      source_file: JSON.stringify(resolvedPlaybackSources),
      processing_status: 'ready',
      featured: toBoolean(featured),
      status: String(status || 'published'),
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
      description,
      genres,
      release_year,
      runtime,
      poster_url,
      banner_url,
      playback_sources,
      featured,
      status
    } = req.body;

    const updatePayload = {};

    if (title !== undefined) updatePayload.title = String(title).trim();
    if (description !== undefined) updatePayload.description = String(description).trim();
    if (genres !== undefined) updatePayload.genres = normalizeGenres(genres);
    if (release_year !== undefined) updatePayload.release_year = toInteger(release_year, movie.release_year);
    if (runtime !== undefined) updatePayload.runtime = toInteger(runtime, movie.runtime);
    if (poster_url !== undefined) updatePayload.poster_url = String(poster_url).trim();
    if (banner_url !== undefined) updatePayload.banner_url = String(banner_url).trim();
    if (playback_sources !== undefined) {
      const resolvedPlaybackSources = parsePlaybackSources(playback_sources);
      updatePayload.video_url = resolvedPlaybackSources[0]?.url || '';
      updatePayload.video_source = 'external';
      updatePayload.source_file = JSON.stringify(resolvedPlaybackSources);
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
