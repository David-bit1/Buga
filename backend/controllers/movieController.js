const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const Movie = require('../models/Movie');
const { connectMongo } = require('../config/mongo');

const normalizeGenres = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value) =>
  value === true ||
  value === 'true' ||
  value === 1 ||
  value === '1' ||
  value === 'on';

const buildPublicPath = (file) => {
  if (!file) {
    return '';
  }

  const folder = file.fieldname === 'poster'
    ? 'posters'
    : file.fieldname === 'banner'
      ? 'banners'
      : 'videos';

  return `/uploads/movies/${folder}/${file.filename}`;
};

const serializeMovie = (movie) => ({
  id: movie._id,
  title: movie.title,
  description: movie.description,
  genres: movie.genres || [],
  year: movie.year,
  duration: movie.duration,
  classification: movie.classification,
  posterPath: movie.posterPath || '',
  bannerPath: movie.bannerPath || '',
  videoPath: movie.videoPath || '',
  featured: Boolean(movie.featured),
  status: movie.status,
  createdBy: movie.createdBy,
  createdAt: movie.createdAt,
  updatedAt: movie.updatedAt
});

const removeFileIfExists = async (filePath) => {
  if (!filePath) {
    return;
  }

  const absolutePath = path.join(__dirname, '..', filePath.replace(/^\/+/, ''));
  await fs.unlink(absolutePath).catch(() => {});
};

const cleanupUploadedFiles = async (files = {}) => {
  const allFiles = Object.values(files).flat();
  await Promise.all(allFiles.map((file) => fs.unlink(file.path).catch(() => {})));
};

const ensureMongo = async () => {
  await connectMongo();
};

const isValidMovieId = (movieId) => mongoose.Types.ObjectId.isValid(movieId);

const listMovies = async (_req, res, next) => {
  try {
    await ensureMongo();
    const movies = await Movie.find().sort({ createdAt: -1 }).lean();
    return res.json({ movies: movies.map(serializeMovie) });
  } catch (error) {
    return next(error);
  }
};

const getMovie = async (req, res, next) => {
  try {
    await ensureMongo();
    if (!isValidMovieId(req.params.movieId)) {
      return res.status(400).json({ message: 'ID de película inválido' });
    }
    const movie = await Movie.findById(req.params.movieId).lean();
    if (!movie) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    return res.json({ movie: serializeMovie(movie) });
  } catch (error) {
    return next(error);
  }
};

const uploadMovie = async (req, res, next) => {
  try {
    await ensureMongo();

    const {
      title,
      description = '',
      genres = '',
      year,
      duration = 0,
      classification = 'PG-13',
      featured = false,
      status = 'published'
    } = req.body;

    if (!title || !year) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ message: 'Título y año son obligatorios' });
    }

    const posterFile = req.files?.poster?.[0] || null;
    const bannerFile = req.files?.banner?.[0] || null;
    const videoFile = req.files?.video?.[0] || null;

    if (!posterFile || !bannerFile || !videoFile) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ message: 'Debes subir poster, banner y video' });
    }

    const movie = await Movie.create({
      title: String(title).trim(),
      description: String(description).trim(),
      genres: normalizeGenres(genres),
      year: toNumber(year),
      duration: toNumber(duration),
      classification: String(classification || 'PG-13').trim(),
      posterPath: buildPublicPath(posterFile),
      bannerPath: buildPublicPath(bannerFile),
      videoPath: buildPublicPath(videoFile),
      featured: toBoolean(featured),
      status,
      createdBy: String(req.user?.id || '')
    });

    return res.status(201).json({
      message: 'Película subida correctamente',
      movie: serializeMovie(movie)
    });
  } catch (error) {
    await cleanupUploadedFiles(req.files).catch(() => {});
    return next(error);
  }
};

const updateMovie = async (req, res, next) => {
  try {
    await ensureMongo();
    if (!isValidMovieId(req.params.movieId)) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ message: 'ID de película inválido' });
    }

    const movie = await Movie.findById(req.params.movieId);
    if (!movie) {
      await cleanupUploadedFiles(req.files);
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    const {
      title,
      description,
      genres,
      year,
      duration,
      classification,
      featured,
      status
    } = req.body;

    if (title !== undefined) movie.title = String(title).trim();
    if (description !== undefined) movie.description = String(description).trim();
    if (genres !== undefined) movie.genres = normalizeGenres(genres);
    if (year !== undefined) movie.year = toNumber(year, movie.year);
    if (duration !== undefined) movie.duration = toNumber(duration, movie.duration);
    if (classification !== undefined) movie.classification = String(classification).trim();
    if (featured !== undefined) movie.featured = toBoolean(featured);
    if (status !== undefined) movie.status = String(status);

    const posterFile = req.files?.poster?.[0] || null;
    const bannerFile = req.files?.banner?.[0] || null;
    const videoFile = req.files?.video?.[0] || null;

    if (posterFile) {
      await removeFileIfExists(movie.posterPath);
      movie.posterPath = buildPublicPath(posterFile);
    }

    if (bannerFile) {
      await removeFileIfExists(movie.bannerPath);
      movie.bannerPath = buildPublicPath(bannerFile);
    }

    if (videoFile) {
      await removeFileIfExists(movie.videoPath);
      movie.videoPath = buildPublicPath(videoFile);
    }

    await movie.save();

    return res.json({
      message: 'Película actualizada correctamente',
      movie: serializeMovie(movie)
    });
  } catch (error) {
    await cleanupUploadedFiles(req.files).catch(() => {});
    return next(error);
  }
};

const deleteMovie = async (req, res, next) => {
  try {
    await ensureMongo();
    if (!isValidMovieId(req.params.movieId)) {
      return res.status(400).json({ message: 'ID de película inválido' });
    }

    const movie = await Movie.findByIdAndDelete(req.params.movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    await Promise.all([
      removeFileIfExists(movie.posterPath),
      removeFileIfExists(movie.bannerPath),
      removeFileIfExists(movie.videoPath)
    ]);

    return res.json({ message: 'Película eliminada correctamente' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listMovies,
  getMovie,
  uploadMovie,
  updateMovie,
  deleteMovie
};
