const {
  selectMany,
  selectOne,
  countRows,
  insertOne,
  updateRows,
  deleteRows,
  upsertOne
} = require('../services/supabaseRepository');

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
  overview: movie.overview,
  poster: movie.poster,
  backdrop: movie.backdrop,
  releaseDate: movie.release_date,
  runtime: movie.runtime,
  genres: movie.genres || [],
  videoSource: movie.video_source,
  featured: Boolean(movie.featured),
  status: movie.status,
  processingStatus: movie.processing_status,
  sourceFile: movie.source_file,
  hlsDirectory: movie.hls_directory,
  hlsManifest: movie.hls_manifest,
  hlsQualities: movie.hls_qualities || [],
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
    return res.json({ movies: movies.map(sanitizeMovie) });
  } catch (error) {
    return next(error);
  }
};

const createMovie = async (req, res, next) => {
  try {
    const {
      tmdbId,
      title,
      overview,
      poster,
      backdrop,
      releaseDate,
      runtime,
      genres = [],
      videoSource,
      featured = false,
      status = 'published'
    } = req.body;

    if (!tmdbId || !title) {
      return res.status(400).json({ message: 'tmdbId y título son obligatorios' });
    }

    const movie = await insertOne('movies', {
      tmdb_id: Number(tmdbId),
      title,
      overview,
      poster,
      backdrop,
      release_date: releaseDate,
      runtime: Number(runtime || 0),
      genres: Array.isArray(genres) ? genres : [],
      video_source: videoSource,
      featured: Boolean(featured),
      status,
      created_by: req.user.id
    });

    return res.status(201).json({
      message: 'Película creada correctamente',
      movie: sanitizeMovie(movie)
    });
  } catch (error) {
    if (String(error.code || '').includes('23505') || String(error.message || '').includes('duplicate')) {
      return res.status(409).json({ message: 'Ya existe una película con ese TMDB ID' });
    }
    return next(error);
  }
};

const updateMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    const movie = await selectOne('movies', {
      filters: [{ type: 'eq', column: 'id', value: movieId }]
    });

    if (!movie) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    const payload = {};
    const fields = ['tmdbId', 'title', 'overview', 'poster', 'backdrop', 'releaseDate', 'runtime', 'videoSource', 'featured', 'status', 'processingStatus', 'sourceFile', 'hlsDirectory', 'hlsManifest'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        const map = {
          tmdbId: 'tmdb_id',
          releaseDate: 'release_date',
          videoSource: 'video_source',
          processingStatus: 'processing_status',
          sourceFile: 'source_file',
          hlsDirectory: 'hls_directory',
          hlsManifest: 'hls_manifest'
        };
        const target = map[field] || field;
        payload[target] = field === 'runtime' || field === 'tmdbId' ? Number(req.body[field]) : req.body[field];
      }
    });

    if (Array.isArray(req.body.genres)) {
      payload.genres = req.body.genres;
    }

    const [updatedMovie] = await updateRows('movies', [{ type: 'eq', column: 'id', value: movieId }], payload);
    return res.json({
      message: 'Película actualizada correctamente',
      movie: sanitizeMovie(updatedMovie)
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
