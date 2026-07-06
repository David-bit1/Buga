const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const {
  selectOne
} = require('../services/supabaseRepository');
const { getManifestPath, getAssetPath, transformPlaylist, HLS_QUALITIES } = require('../services/hlsService');

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
  getStreamInfo,
  getMasterPlaylist,
  getVideoAsset
};

