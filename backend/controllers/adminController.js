const { insertOne, selectMany, selectOne, updateRows, deleteRows, upsertOne } = require('../services/supabaseRepository');
const { parseServers } = require('../services/serverNormalizer');
const { buildTmdbMoviePayload, toInteger, normalizeGenres, normalizeCast } = require('../controllers/movieController');

const toNullableTmdbId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getRoleFromEmail = (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const adminEmails = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(normalizedEmail) ? 'admin' : 'user';
};

const sanitizeMovie = (movie) => ({
  id: movie.id,
  tmdbId: movie.tmdb_id,
  title: movie.title,
  original_title: movie.original_title,
  description: movie.description,
  overview: movie.overview,
  poster_url: movie.poster_url,
  banner_url: movie.banner_url,
  poster_srcset: movie.poster_srcset,
  banner_srcset: movie.banner_srcset,
  release_year: movie.release_year,
  release_date: movie.release_date,
  runtime: movie.runtime,
  country: movie.country,
  language: movie.language,
  genres: normalizeGenres(movie.genres || []),
  rating: movie.rating,
  cast: normalizeCast(movie.cast || []),
  director: movie.director,
  trailer: movie.trailer,
  popularity: movie.popularity,
  servers: movie.servers || [],
  featured: Boolean(movie.featured),
  status: movie.status,
  content_type: movie.content_type,
  creator_name: movie.creator_name,
  rights_holder: movie.rights_holder,
  license_info: movie.license_info,
  source_url: movie.source_url,
  createdBy: movie.created_by,
  createdAt: movie.created_at,
  updatedAt: movie.updated_at
});

const sanitizeGenre = (genre) => ({
  id: genre.id,
  tmdbId: genre.tmdb_id,
  name: genre.name,
  slug: genre.slug,
  color: genre.color,
  description: genre.description,
  active: Boolean(genre.active),
  createdAt: genre.created_at,
  updatedAt: genre.updated_at
});

const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.username,
  email: user.email,
  role: getRoleFromEmail(user.email),
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

const USER_LIST_SELECT = 'id, username, email, created_at';

const ensureAdminSetting = async (key, fallback = {}) => {
  const existing = await selectOne('admin_settings', {
    filters: [{ type: 'eq', column: 'key', value: key }]
  });

  if (existing) {
    return existing;
  }

  return insertOne('admin_settings', { key, value: fallback });
};

const getDashboard = async (_req, res, next) => {
  try {
    const [userCount, profileCount, movieCount, genreCount, preferenceCount, allUsers, recentUsers, recentMovies] =
      await Promise.all([
        countRows('users'),
        countRows('profiles'),
        countRows('movies'),
        countRows('genres'),
        countRows('user_preferences'),
        selectMany('users', { select: USER_LIST_SELECT }),
        selectMany('users', { select: USER_LIST_SELECT, order: { column: 'created_at', ascending: false }, limit: 5 }),
        selectMany('movies', { order: { column: 'created_at', ascending: false }, limit: 5 })
      ]);

    const adminEmails = String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const resolvedAdminCount = allUsers.reduce(
      (total, user) => total + (adminEmails.includes(String(user.email || '').toLowerCase()) ? 1 : 0),
      0
    );

    const settings = await Promise.all([
      ensureAdminSetting('catalog', { featuredLimit: 10, trendingLimit: 8, allowUserUploads: false }),
      ensureAdminSetting('ui', { theme: 'morado-negro', accent: '#8a4dff' })
    ]);

    return res.json({
      stats: {
        users: userCount,
        admins: resolvedAdminCount,
        profiles: profileCount,
        movies: movieCount,
        genres: genreCount,
        preferences: preferenceCount
      },
      recentUsers: recentUsers.map(sanitizeUser),
      recentMovies: recentMovies.map(sanitizeMovie),
      settings: Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
    });
  } catch (error) {
    return next(error);
  }
};

const listMovies = async (_req, res, next) => {
  try {
    const movies = await selectMany('movies', { order: { column: 'created_at', ascending: false } });
    console.log('Admin listMovies from Supabase:', JSON.stringify(movies, null, 2));
    return res.json({ movies: movies.map(sanitizeMovie) });
  } catch (error) {
    return next(error);
  }
};

const createMovie = async (req, res, next) => {
  try {
    const { tmdbId, title, servers } = req.body;
    console.log('AUDIT ADMIN REQUEST BODY', JSON.stringify(req.body, null, 2));

    if (!title && !tmdbId) {
      return res.status(400).json({ message: 'Se requiere un título o un TMDb ID.' });
    }

    let tmdbPayload = null;
    try {
      if (tmdbId) {
        tmdbPayload = await buildTmdbMoviePayload(Number(tmdbId));
      }
    } catch (error) {
      console.warn('Admin createMovie - TMDB sync failed:', error.message);
    }

    const finalTitle = String(req.body.title || tmdbPayload?.title || '').trim();
    if (!finalTitle) {
      return res.status(400).json({ message: 'No se pudo determinar un título para la película.' });
    }

    const insertPayload = {
      tmdb_id: toNullableTmdbId(req.body.tmdbId ?? tmdbId),
      title: finalTitle,
      original_title: String(req.body.original_title || tmdbPayload?.original_title || '').trim(),
      description: String(req.body.description || tmdbPayload?.description || '').trim(),
      overview: String(req.body.overview || req.body.description || tmdbPayload?.overview || '').trim(),
      poster_url: String(req.body.poster_url || tmdbPayload?.poster_url || '').trim(),
      banner_url: String(req.body.banner_url || tmdbPayload?.banner_url || '').trim(),
      poster_srcset: String(req.body.poster_srcset || tmdbPayload?.poster_srcset || '').trim(),
      banner_srcset: String(req.body.banner_srcset || tmdbPayload?.banner_srcset || '').trim(),
      release_year: toInteger(req.body.release_year || tmdbPayload?.release_year, null),
      runtime: toInteger(req.body.runtime || tmdbPayload?.runtime, 0),
      country: String(req.body.country || tmdbPayload?.country || '').trim(),
      language: String(req.body.language || tmdbPayload?.language || '').trim(),
      genres: normalizeGenres(req.body.genres || tmdbPayload?.genres || []),
      rating: String(req.body.rating || tmdbPayload?.rating || '').trim(),
      cast: normalizeCast(req.body.cast || tmdbPayload?.cast || []),
      director: String(req.body.director || tmdbPayload?.director || '').trim(),
      trailer: String(req.body.trailer || tmdbPayload?.trailer || '').trim(),
      servers: parseServers(servers || []),
      featured: Boolean(req.body.featured),
      status: String(req.body.status || 'published'),
      created_by: req.user.id,
      popularity: tmdbPayload?.popularity || 0,
      content_type: String(req.body.content_type || 'independent').trim(),
      creator_name: String(req.body.creator_name || '').trim(),
      rights_holder: String(req.body.rights_holder || '').trim(),
      license_info: String(req.body.license_info || '').trim(),
      source_url: String(req.body.source_url || '').trim(),
    };

    console.log('AUDIT FINAL INSERT PAYLOAD', JSON.stringify(insertPayload, null, 2));

    const movie = await insertOne('movies', insertPayload);
    console.log('AUDIT SUPABASE RESULT', JSON.stringify(movie, null, 2));
    const savedMovie = await selectOne('movies', { filters: [{ type: 'eq', column: 'id', value: movie.id }] });
    console.log('MOVIE AFTER SAVE', JSON.stringify(savedMovie, null, 2));

    return res.status(201).json({
      message: 'Película creada correctamente',
      movie: sanitizeMovie(savedMovie || movie)
    });
  } catch (error) {
    if (String(error.code || '').includes('23505') || String(error.message || '').includes('duplicate')) {
      return res.status(409).json({ message: 'Ya existe una película con ese TMDB ID' });
    }
    console.error('ADMIN CREATE MOVIE FAILED:', {
      message: error.message,
      details: error.details,
      code: error.code,
      stack: error.stack
    });
    return next(error);
  }
};

const updateMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    console.log('AUDIT ADMIN REQUEST BODY', JSON.stringify(req.body, null, 2));
    const movie = await selectOne('movies', {
      filters: [{ type: 'eq', column: 'id', value: movieId }]
    });

    if (!movie) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    const updatePayload = {};
    const fields = [
      'tmdbId', 'title', 'original_title', 'description', 'overview', 'poster_url', 'banner_url',
      'poster_srcset', 'banner_srcset',
      'release_year', 'runtime', 'country', 'language', 'rating', 'director', 'trailer',
      'servers', 'featured', 'status', 'popularity',
      'content_type', 'creator_name', 'rights_holder', 'license_info', 'source_url'
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        const map = { tmdbId: 'tmdb_id' };
        const target = map[field] || field;
        let value = req.body[field];

        if (['runtime', 'release_year', 'popularity'].includes(field)) {
          value = toInteger(value, movie[target]);
        } else if (field === 'tmdbId') {
          value = toNullableTmdbId(value);
        } else if (field === 'featured') {
          value = Boolean(value);
        } else if (field === 'content_type') {
          value = String(value || 'independent').trim();
        } else if (typeof value === 'string') {
          value = value.trim();
        }

        updatePayload[target] = value;
      }
    }

    if (req.body.genres !== undefined) {
      updatePayload.genres = normalizeGenres(req.body.genres);
    }

    if (req.body.cast !== undefined) {
      updatePayload.cast = normalizeCast(req.body.cast);
    }


    if (req.body.servers !== undefined) {
      updatePayload.servers = parseServers(req.body.servers);
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ message: 'No se enviaron datos para actualizar' });
    }

    console.log('AUDIT FINAL UPDATE PAYLOAD', JSON.stringify(updatePayload, null, 2));
    const [updatedMovie] = await updateRows('movies', [{ type: 'eq', column: 'id', value: movieId }], updatePayload);
    console.log('AUDIT SUPABASE RESULT', JSON.stringify(updatedMovie, null, 2));
    const savedMovie = await selectOne('movies', { filters: [{ type: 'eq', column: 'id', value: movieId }] });
    console.log('MOVIE AFTER SAVE', JSON.stringify(savedMovie, null, 2));
    return res.json({
      message: 'Película actualizada correctamente',
      movie: sanitizeMovie(savedMovie || updatedMovie)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    const deleted = await deleteRows('movies', [{ type: 'eq', column: 'id', value: movieId }]);

    if (!deleted.length) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    return res.json({ message: 'Película eliminada correctamente' });
  } catch (error) {
    return next(error);
  }
};

const listGenres = async (_req, res, next) => {
  try {
    const genres = await selectMany('genres', { order: { column: 'created_at', ascending: false } });
    return res.json({ genres: genres.map(sanitizeGenre) });
  } catch (error) {
    return next(error);
  }
};

const createGenre = async (req, res, next) => {
  try {
    const { tmdbId = null, name, color = '#8a4dff', description = '', active = true } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'El nombre del género es obligatorio' });
    }

    const slug = slugify(name);
    const genre = await insertOne('genres', {
      tmdb_id: tmdbId ? Number(tmdbId) : null,
      name,
      slug,
      color,
      description,
      active: Boolean(active)
    });

    return res.status(201).json({
      message: 'Género creado correctamente',
      genre: sanitizeGenre(genre)
    });
  } catch (error) {
    if (String(error.code || '').includes('23505') || String(error.message || '').includes('duplicate')) {
      return res.status(409).json({ message: 'Ya existe un género con ese slug' });
    }
    return next(error);
  }
};

const updateGenre = async (req, res, next) => {
  try {
    const { genreId } = req.params;
    const genre = await selectOne('genres', {
      filters: [{ type: 'eq', column: 'id', value: genreId }]
    });

    if (!genre) {
      return res.status(404).json({ message: 'Género no encontrado' });
    }

    const payload = {};
    if (req.body.name) {
      payload.name = req.body.name;
      payload.slug = slugify(req.body.name);
    }

    if (req.body.tmdbId !== undefined) {
      payload.tmdb_id = req.body.tmdbId ? Number(req.body.tmdbId) : null;
    }

    if (req.body.color) payload.color = req.body.color;
    if (req.body.description !== undefined) payload.description = req.body.description;
    if (typeof req.body.active === 'boolean') payload.active = req.body.active;

    const [updatedGenre] = await updateRows('genres', [{ type: 'eq', column: 'id', value: genreId }], payload);
    return res.json({
      message: 'Género actualizado correctamente',
      genre: sanitizeGenre(updatedGenre)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteGenre = async (req, res, next) => {
  try {
    const { genreId } = req.params;
    const deleted = await deleteRows('genres', [{ type: 'eq', column: 'id', value: genreId }]);

    if (!deleted.length) {
      return res.status(404).json({ message: 'Género no encontrado' });
    }

    return res.json({ message: 'Género eliminado correctamente' });
  } catch (error) {
    return next(error);
  }
};

const listUsers = async (_req, res, next) => {
  try {
    const users = await selectMany('users', { select: USER_LIST_SELECT, order: { column: 'created_at', ascending: false } });
    return res.json({ users: users.map(sanitizeUser) });
  } catch (error) {
    return next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await selectOne('users', {
      select: 'id, username, email, created_at',
      filters: [{ type: 'eq', column: 'id', value: userId }]
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const payload = {};
    if (req.body.username) payload.username = req.body.username;
    if (req.body.name) payload.username = req.body.name;

    const [updatedUser] = await updateRows('users', [{ type: 'eq', column: 'id', value: userId }], payload);
    return res.json({
      message: 'Usuario actualizado correctamente',
      user: sanitizeUser(updatedUser)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({ message: 'No puedes eliminar tu propio usuario desde el panel' });
    }

    const deleted = await deleteRows('users', [{ type: 'eq', column: 'id', value: userId }]);
    if (!deleted.length) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    return next(error);
  }
};

const getSettings = async (_req, res, next) => {
  try {
    const settings = await Promise.all([
      ensureAdminSetting('catalog', { featuredLimit: 10, trendingLimit: 8, allowUserUploads: false }),
      ensureAdminSetting('ui', { theme: 'morado-negro', accent: '#8a4dff' })
    ]);

    return res.json({
      settings: Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
    });
  } catch (error) {
    return next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const catalog = await ensureAdminSetting('catalog', { featuredLimit: 10, trendingLimit: 8, allowUserUploads: false });
    const ui = await ensureAdminSetting('ui', { theme: 'morado-negro', accent: '#8a4dff' });

    if (payload.catalog && typeof payload.catalog === 'object') {
      const [updatedCatalog] = await updateRows(
        'admin_settings',
        [{ type: 'eq', column: 'key', value: 'catalog' }],
        { value: { ...catalog.value, ...payload.catalog } }
      );
      catalog.value = updatedCatalog.value;
    }

    if (payload.ui && typeof payload.ui === 'object') {
      const [updatedUi] = await updateRows(
        'admin_settings',
        [{ type: 'eq', column: 'key', value: 'ui' }],
        { value: { ...ui.value, ...payload.ui } }
      );
      ui.value = updatedUi.value;
    }

    return res.json({
      message: 'Configuración actualizada correctamente',
      settings: {
        catalog: catalog.value,
        ui: ui.value
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
  listMovies,
  createMovie,
  updateMovie,
  deleteMovie,
  listGenres,
  createGenre,
  updateGenre,
  deleteGenre,
  listUsers,
  updateUser,
  deleteUser,
  getSettings,
  updateSettings
};
