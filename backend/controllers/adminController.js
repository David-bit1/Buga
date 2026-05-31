const mongoose = require('mongoose');
const User = require('../models/User');
const Profile = require('../models/Profile');
const AdminMovie = require('../models/AdminMovie');
const Genre = require('../models/Genre');
const AdminSetting = require('../models/AdminSetting');
const UserPreferences = require('../models/UserPreferences');

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const sanitizeMovie = (movie) => ({
  id: movie._id,
  tmdbId: movie.tmdbId,
  title: movie.title,
  overview: movie.overview,
  poster: movie.poster,
  backdrop: movie.backdrop,
  releaseDate: movie.releaseDate,
  runtime: movie.runtime,
  genres: movie.genres,
  videoSource: movie.videoSource,
  featured: movie.featured,
  status: movie.status,
  createdBy: movie.createdBy,
  createdAt: movie.createdAt,
  updatedAt: movie.updatedAt
});

const sanitizeGenre = (genre) => ({
  id: genre._id,
  tmdbId: genre.tmdbId,
  name: genre.name,
  slug: genre.slug,
  color: genre.color,
  description: genre.description,
  active: genre.active,
  createdAt: genre.createdAt,
  updatedAt: genre.updatedAt
});

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role || 'user',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const ensureAdminSetting = async (key, fallback = {}) => {
  let setting = await AdminSetting.findOne({ key });
  if (!setting) {
    setting = await AdminSetting.create({ key, value: fallback });
  }

  return setting;
};

const getDashboard = async (_req, res, next) => {
  try {
    const [userCount, adminCount, profileCount, movieCount, genreCount, preferenceCount, recentUsers, recentMovies] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'admin' }),
        Profile.countDocuments(),
        AdminMovie.countDocuments(),
        Genre.countDocuments(),
        UserPreferences.countDocuments(),
        User.find().sort({ createdAt: -1 }).limit(5),
        AdminMovie.find().sort({ createdAt: -1 }).limit(5)
      ]);

    const settings = await Promise.all([
      ensureAdminSetting('catalog', { featuredLimit: 10, trendingLimit: 8, allowUserUploads: false }),
      ensureAdminSetting('ui', { theme: 'morado-negro', accent: '#8a4dff' })
    ]);

    return res.json({
      stats: {
        users: userCount,
        admins: adminCount,
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
    const movies = await AdminMovie.find().sort({ createdAt: -1 });
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

    const movie = await AdminMovie.create({
      tmdbId: Number(tmdbId),
      title,
      overview,
      poster,
      backdrop,
      releaseDate,
      runtime: Number(runtime || 0),
      genres: Array.isArray(genres) ? genres : [],
      videoSource,
      featured: Boolean(featured),
      status,
      createdBy: req.user.id
    });

    return res.status(201).json({
      message: 'Película creada correctamente',
      movie: sanitizeMovie(movie)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ya existe una película con ese TMDB ID' });
    }
    return next(error);
  }
};

const updateMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({ message: 'Película inválida' });
    }

    const movie = await AdminMovie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    const fields = ['tmdbId', 'title', 'overview', 'poster', 'backdrop', 'releaseDate', 'runtime', 'videoSource', 'featured', 'status'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        movie[field] = field === 'runtime' || field === 'tmdbId' ? Number(req.body[field]) : req.body[field];
      }
    });

    if (Array.isArray(req.body.genres)) {
      movie.genres = req.body.genres;
    }

    await movie.save();
    return res.json({
      message: 'Película actualizada correctamente',
      movie: sanitizeMovie(movie)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({ message: 'Película inválida' });
    }

    const movie = await AdminMovie.findByIdAndDelete(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    return res.json({ message: 'Película eliminada correctamente' });
  } catch (error) {
    return next(error);
  }
};

const listGenres = async (_req, res, next) => {
  try {
    const genres = await Genre.find().sort({ createdAt: -1 });
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
    const genre = await Genre.create({
      tmdbId: tmdbId ? Number(tmdbId) : null,
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
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ya existe un género con ese slug' });
    }
    return next(error);
  }
};

const updateGenre = async (req, res, next) => {
  try {
    const { genreId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(genreId)) {
      return res.status(400).json({ message: 'Género inválido' });
    }

    const genre = await Genre.findById(genreId);
    if (!genre) {
      return res.status(404).json({ message: 'Género no encontrado' });
    }

    if (req.body.name) {
      genre.name = req.body.name;
      genre.slug = slugify(req.body.name);
    }

    if (req.body.tmdbId !== undefined) {
      genre.tmdbId = req.body.tmdbId ? Number(req.body.tmdbId) : null;
    }

    if (req.body.color) genre.color = req.body.color;
    if (req.body.description !== undefined) genre.description = req.body.description;
    if (typeof req.body.active === 'boolean') genre.active = req.body.active;

    await genre.save();
    return res.json({
      message: 'Género actualizado correctamente',
      genre: sanitizeGenre(genre)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteGenre = async (req, res, next) => {
  try {
    const { genreId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(genreId)) {
      return res.status(400).json({ message: 'Género inválido' });
    }

    const genre = await Genre.findByIdAndDelete(genreId);
    if (!genre) {
      return res.status(404).json({ message: 'Género no encontrado' });
    }

    return res.json({ message: 'Género eliminado correctamente' });
  } catch (error) {
    return next(error);
  }
};

const listUsers = async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    return res.json({ users: users.map(sanitizeUser) });
  } catch (error) {
    return next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Usuario inválido' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (req.body.name) user.name = req.body.name;
    if (req.body.role && ['user', 'admin'].includes(req.body.role)) user.role = req.body.role;

    await user.save();
    return res.json({
      message: 'Usuario actualizado correctamente',
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Usuario inválido' });
    }

    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({ message: 'No puedes eliminar tu propio usuario desde el panel' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await Promise.all([
      Profile.deleteMany({ user: userId }),
      UserPreferences.deleteMany({ user: userId })
    ]);

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
      catalog.value = { ...catalog.value, ...payload.catalog };
      await catalog.save();
    }

    if (payload.ui && typeof payload.ui === 'object') {
      ui.value = { ...ui.value, ...payload.ui };
      await ui.save();
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
