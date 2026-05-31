const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const AdminMovie = require('../models/AdminMovie');
const { generateHlsPackage, getManifestPath, getAssetPath, transformPlaylist, HLS_QUALITIES } = require('../services/hlsService');

const uploadStorage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    const tempRoot = path.join(__dirname, '..', 'uploads', 'tmp');
    fsSync.mkdirSync(tempRoot, { recursive: true });
    callback(null, tempRoot);
  },
  filename: (_req, file, callback) => {
    const safeName = String(file.originalname || 'video.mp4')
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-');
    callback(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage: uploadStorage,
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('video/')) {
      callback(new Error('Solo se permiten archivos de video'));
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 1024 * 1024 * 1024
  }
});

const parseGenres = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name, index) => ({ id: index + 1, name }));

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
  processingStatus: movie.processingStatus,
  sourceFile: movie.sourceFile,
  hlsDirectory: movie.hlsDirectory,
  hlsManifest: movie.hlsManifest,
  hlsQualities: movie.hlsQualities,
  createdBy: movie.createdBy,
  createdAt: movie.createdAt,
  updatedAt: movie.updatedAt
});

const uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Debes subir un archivo de video' });
    }

    const {
      tmdbId,
      title,
      overview = '',
      poster = '',
      backdrop = '',
      releaseDate = '',
      runtime = 0,
      genres = '',
      featured = false,
      status = 'published'
    } = req.body;

    if (!tmdbId || !title) {
      return res.status(400).json({ message: 'tmdbId y title son obligatorios' });
    }

    let movie = await AdminMovie.findOne({ tmdbId: Number(tmdbId) });
    if (!movie) {
      movie = await AdminMovie.create({
        tmdbId: Number(tmdbId),
        title,
        overview,
        poster,
        backdrop,
        releaseDate,
        runtime: Number(runtime || 0),
        genres: parseGenres(genres),
        featured: Boolean(featured),
        status,
        createdBy: req.user.id,
        processingStatus: 'processing'
      });
    } else {
      movie.title = title;
      movie.overview = overview;
      movie.poster = poster;
      movie.backdrop = backdrop;
      movie.releaseDate = releaseDate;
      movie.runtime = Number(runtime || 0);
      movie.genres = parseGenres(genres);
      movie.featured = Boolean(featured);
      movie.status = status;
      movie.processingStatus = 'processing';
      movie.createdBy = req.user.id;
      await movie.save();
    }

    const packageData = await generateHlsPackage({
      movieKey: movie.tmdbId,
      inputPath: req.file.path
    });

    movie.sourceFile = packageData.sourceFile;
    movie.hlsDirectory = packageData.hlsDirectory;
    movie.hlsManifest = packageData.hlsManifest;
    movie.hlsQualities = packageData.hlsQualities;
    movie.processingStatus = 'ready';
    movie.videoSource = packageData.sourceFile;
    await movie.save();

    await fs.unlink(req.file.path).catch(() => {});

    return res.status(201).json({
      message: 'Video procesado a HLS correctamente',
      movie: sanitizeMovie(movie),
      qualities: HLS_QUALITIES
    });
  } catch (error) {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    console.error('uploadVideo error', error);
    return next(error);
  }
};

const getStreamInfo = async (req, res, next) => {
  try {
    const tmdbId = Number(req.params.tmdbId);
    const movie = await AdminMovie.findOne({ tmdbId });

    if (!movie || movie.processingStatus !== 'ready') {
      return res.status(404).json({ message: 'El stream todavía no está listo' });
    }

    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const manifestUrl = `/api/videos/${tmdbId}/master.m3u8${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const fallbackMp4 = movie.videoSource ? `/api/videos/${tmdbId}/file/${encodeURIComponent(path.basename(movie.videoSource))}${token ? `?token=${encodeURIComponent(token)}` : ''}` : '';

    return res.json({
      message: 'Stream listo',
      tmdbId,
      title: movie.title,
      processingStatus: movie.processingStatus,
      manifestUrl,
      fallbackMp4,
      qualities: movie.hlsQualities || []
    });
  } catch (error) {
    return next(error);
  }
};

const getMasterPlaylist = async (req, res, next) => {
  try {
    const tmdbId = Number(req.params.tmdbId);
    const headerToken = String(req.headers.authorization || '').startsWith('Bearer ')
      ? String(req.headers.authorization).slice(7)
      : String(req.headers.authorization || '');
    const token = typeof req.query.token === 'string' ? req.query.token : headerToken;
    const manifestPath = getManifestPath(tmdbId);

    const playlist = await fs.readFile(manifestPath, 'utf8');
    const transformed = transformPlaylist(playlist, tmdbId, token);

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(transformed);
  } catch (error) {
    return next(error);
  }
};

const getVideoAsset = async (req, res, next) => {
  try {
    const tmdbId = Number(req.params.tmdbId);
    const assetParts = req.params[0] || '';
    const assetPath = getAssetPath(tmdbId, assetParts);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(assetPath);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  upload,
  uploadVideo,
  getStreamInfo,
  getMasterPlaylist,
  getVideoAsset
};
