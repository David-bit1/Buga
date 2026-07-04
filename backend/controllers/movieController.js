const fs = require('fs');
const {
  insertOne,
  selectMany,
  selectOne,
  updateRows,
  deleteRows
} = require('../services/supabaseRepository');
const { uploadFile, deleteFile } = require('../services/r2Service');

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
  value === true ||
  value === 'true' ||
  value === 1 ||
  value === '1' ||
  value === 'on';

const sanitizeFileName = (name) =>
  String(name || 'file')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-');

const cleanupUploadedFiles = async (files = {}) => {
  const allFiles = Object.values(files).flat();
  await Promise.all(allFiles.map((file) => fs.promises.unlink(file.path).catch(() => {})));
};

const buildAssetKey = (movieId, field, originalName) => {
  const safeName = sanitizeFileName(originalName);
  return `movies/${movieId}/${field}/${Date.now()}-${safeName}`;
};

const uploadAsset = async (file, movieId) => {
  if (!file) {
    return null;
  }

  const key = buildAssetKey(movieId, file.fieldname, file.originalname);
  const publicUrl = await uploadFile({
    key,
    body: fs.createReadStream(file.path),
    contentType: file.mimetype
  });

  return { url: publicUrl, key };
};

const deleteAssetKeys = async (keys = []) => {
  await Promise.all(keys.filter(Boolean).map((key) => deleteFile(key)));
};

const serializeMovie = (movie) => ({
  id: movie.id,
  title: movie.title,
  description: movie.description,
  genres: movie.genres || [],
  release_year: movie.release_year || 0,
  poster_url: movie.poster_url || '',
  banner_url: movie.banner_url || '',
  video_url: movie.video_url || '',
  subtitle_url: movie.subtitle_url || '',
  featured: Boolean(movie.featured),
  status: movie.status,
  processing_status: movie.processing_status,
  video_source: movie.video_source,
  created_by: movie.created_by,
  created_at: movie.created_at,
  updated_at: movie.updated_at
});

const listMovies = async (_req, res, next) => {
  try {
    const movies = await selectMany('movies', {
      order: { column: 'created_at', ascending: false }
    });
    return res.json({ movies: movies.map(serializeMovie) });
  } catch (error) {
    return next(error);
  }
};

const getMovie = async (req, res, next) => {
  try {
    const movie = await selectOne('movies', {
      filters: [{ type: 'eq', column: 'id', value: req.params.movieId }]
    });

    if (!movie) {
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    return res.json({ movie: serializeMovie(movie) });
  } catch (error) {
    return next(error);
  }
};

const uploadMovie = async (req, res, next) => {
  let assetUploads = [];

  try {
    const {
      title,
      description = '',
      genres = '',
      release_year = 0,
      featured = false,
      status = 'published'
    } = req.body;

    if (!title) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ message: 'El título es obligatorio' });
    }

    const posterFile = req.files?.poster?.[0] || null;
    const bannerFile = req.files?.banner?.[0] || null;
    const videoFile = req.files?.video?.[0] || null;

    if (!posterFile || !bannerFile || !videoFile) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ message: 'Debes subir poster, banner y video' });
    }

    const movieId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const posterAsset = await uploadAsset(posterFile, movieId);
    const bannerAsset = await uploadAsset(bannerFile, movieId);
    const videoAsset = await uploadAsset(videoFile, movieId);
    const subtitleFile = req.files?.subtitles?.[0] || req.files?.subtitle?.[0] || null;
    const subtitleAsset = subtitleFile ? await uploadAsset(subtitleFile, movieId) : null;

    assetUploads = [posterAsset, bannerAsset, videoAsset, subtitleAsset];

    const movie = await insertOne('movies', {
      title: String(title).trim(),
      description: String(description || '').trim(),
      genres: normalizeGenres(genres),
      release_year: toInteger(release_year, 0),
      poster_url: posterAsset.url,
      banner_url: bannerAsset.url,
      video_url: videoAsset.url,
      subtitle_url: subtitleAsset?.url || '',
      poster_key: posterAsset.key,
      banner_key: bannerAsset.key,
      video_key: videoAsset.key,
      subtitle_key: subtitleAsset?.key || '',
      video_source: 'r2',
      source_file: videoAsset.url,
      processing_status: 'idle',
      featured: toBoolean(featured),
      status: String(status || 'published'),
      created_by: req.user?.id || null
    });

    await cleanupUploadedFiles(req.files);

    return res.status(201).json({
      message: 'Película subida correctamente',
      movie: serializeMovie(movie)
    });
  } catch (error) {
    await cleanupUploadedFiles(req.files).catch(() => {});
    await deleteAssetKeys(assetUploads.map((asset) => asset?.key));
    return next(error);
  }
};

const updateMovie = async (req, res, next) => {
  let updatedAssets = [];

  try {
    const movie = await selectOne('movies', {
      filters: [{ type: 'eq', column: 'id', value: req.params.movieId }]
    });

    if (!movie) {
      await cleanupUploadedFiles(req.files);
      return res.status(404).json({ message: 'Película no encontrada' });
    }

    const {
      title,
      description,
      genres,
      release_year,
      featured,
      status
    } = req.body;

    const updatePayload = {};

    if (title !== undefined) updatePayload.title = String(title).trim();
    if (description !== undefined) updatePayload.description = String(description).trim();
    if (genres !== undefined) updatePayload.genres = normalizeGenres(genres);
    if (release_year !== undefined) updatePayload.release_year = toInteger(release_year, movie.release_year);
    if (featured !== undefined) updatePayload.featured = toBoolean(featured);
    if (status !== undefined) updatePayload.status = String(status);

    const posterFile = req.files?.poster?.[0] || null;
    const bannerFile = req.files?.banner?.[0] || null;
    const videoFile = req.files?.video?.[0] || null;
    const subtitleFile = req.files?.subtitles?.[0] || req.files?.subtitle?.[0] || null;

    if (posterFile) {
      const posterAsset = await uploadAsset(posterFile, movie.id);
      updatedAssets.push(posterAsset);
      updatePayload.poster_url = posterAsset.url;
      updatePayload.poster_key = posterAsset.key;
    }

    if (bannerFile) {
      const bannerAsset = await uploadAsset(bannerFile, movie.id);
      updatedAssets.push(bannerAsset);
      updatePayload.banner_url = bannerAsset.url;
      updatePayload.banner_key = bannerAsset.key;
    }

    if (videoFile) {
      const videoAsset = await uploadAsset(videoFile, movie.id);
      updatedAssets.push(videoAsset);
      updatePayload.video_url = videoAsset.url;
      updatePayload.video_key = videoAsset.key;
      updatePayload.source_file = videoAsset.url;
    }

    if (subtitleFile) {
      const subtitleAsset = await uploadAsset(subtitleFile, movie.id);
      updatedAssets.push(subtitleAsset);
      updatePayload.subtitle_url = subtitleAsset.url;
      updatePayload.subtitle_key = subtitleAsset.key;
    }

    if (Object.keys(updatePayload).length === 0) {
      await cleanupUploadedFiles(req.files);
      return res.status(400).json({ message: 'No se enviaron datos para actualizar' });
    }

    const updatedRows = await updateRows(
      'movies',
      [{ type: 'eq', column: 'id', value: req.params.movieId }],
      updatePayload
    );

    await cleanupUploadedFiles(req.files);
    await deleteAssetKeys([
      posterFile ? movie.poster_key : null,
      bannerFile ? movie.banner_key : null,
      videoFile ? movie.video_key : null,
      subtitleFile ? movie.subtitle_key : null
    ]);

    return res.json({
      message: 'Película actualizada correctamente',
      movie: serializeMovie(updatedRows[0] || movie)
    });
  } catch (error) {
    await cleanupUploadedFiles(req.files).catch(() => {});
    await deleteAssetKeys(updatedAssets.map((asset) => asset?.key));
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

    await deleteAssetKeys([
      movie.poster_key,
      movie.banner_key,
      movie.video_key,
      movie.subtitle_key
    ]);

    await deleteRows('movies', [{ type: 'eq', column: 'id', value: req.params.movieId }]);

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
