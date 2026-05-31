const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const {
  selectOne,
  insertOne,
  updateRows
} = require('../services/supabaseRepository');
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
  id: movie.id,
  tmdbId: movie.tmdb_id,
  title: movie.title,
  overview: movie.overview,
  poster: movie.poster,
  backdrop: movie.backdrop,
  releaseDate: movie.release_date,
  runtime: movie.runtime,
  genres: movie.genres,
  videoSource: movie.video_source,
  featured: movie.featured,
  status: movie.status,
  processingStatus: movie.processing_status,
  sourceFile: movie.source_file,
  hlsDirectory: movie.hls_directory,
  hlsManifest: movie.hls_manifest,
  hlsQualities: movie.hls_qualities,
  createdBy: movie.created_by,
  createdAt: movie.created_at,
  updatedAt: movie.updated_at
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

    let movie = await selectOne('movies', {
      filters: [{ type: 'eq', column: 'tmdb_id', value: Number(tmdbId) }]
    });

    if (!movie) {
      movie = await insertOne('movies', {
        tmdb_id: Number(tmdbId),
        title,
        overview,
        poster,
        backdrop,
        release_date: releaseDate,
        runtime: Number(runtime || 0),
        genres: parseGenres(genres),
        featured: Boolean(featured),
        status,
        created_by: req.user.id,
        processing_status: 'processing'
      });
    } else {
      const [updatedMovie] = await updateRows(
        'movies',
        [{ type: 'eq', column: 'id', value: movie.id }],
        {
          tmdb_id: Number(tmdbId),
          title,
          overview,
          poster,
          backdrop,
          release_date: releaseDate,
          runtime: Number(runtime || 0),
          genres: parseGenres(genres),
          featured: Boolean(featured),
          status,
          processing_status: 'processing',
          created_by: req.user.id
        }
      );
      movie = updatedMovie;
    }

    const packageData = await generateHlsPackage({
      movieKey: movie.tmdb_id,
      inputPath: req.file.path
    });

    const [processedMovie] = await updateRows(
      'movies',
      [{ type: 'eq', column: 'id', value: movie.id }],
      {
        source_file: packageData.sourceFile,
        hls_directory: packageData.hlsDirectory,
        hls_manifest: packageData.hlsManifest,
        hls_qualities: packageData.hlsQualities,
        processing_status: 'ready',
        video_source: packageData.sourceFile
      }
    );

    await fs.unlink(req.file.path).catch(() => {});

    return res.status(201).json({
      message: 'Video procesado a HLS correctamente',
      movie: sanitizeMovie(processedMovie),
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
    const movie = await selectOne('movies', {
      filters: [{ type: 'eq', column: 'tmdb_id', value: tmdbId }]
    });

    if (!movie || movie.processing_status !== 'ready') {
      return res.status(404).json({ message: 'El stream todavía no está listo' });
    }

    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const manifestUrl = `/api/videos/${tmdbId}/master.m3u8${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const fallbackMp4 = movie.video_source ? `/api/videos/${tmdbId}/file/${encodeURIComponent(path.basename(movie.video_source))}${token ? `?token=${encodeURIComponent(token)}` : ''}` : '';

    return res.json({
      message: 'Stream listo',
      tmdbId,
      title: movie.title,
      processingStatus: movie.processing_status,
      manifestUrl,
      fallbackMp4,
      qualities: movie.hls_qualities || []
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
