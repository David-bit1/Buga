const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadRoot = path.join(__dirname, '..', 'uploads', 'movies');
const uploadFolders = {
  poster: path.join(uploadRoot, 'posters'),
  banner: path.join(uploadRoot, 'banners'),
  fallback: path.join(uploadRoot, 'tmp')
};

Object.values(uploadFolders).forEach((folderPath) => {
  fs.mkdirSync(folderPath, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (_req, file, callback) => {
    const destination = uploadFolders[file.fieldname] || uploadFolders.fallback;
    callback(null, destination);
  },
  filename: (_req, file, callback) => {
    const safeName = String(file.originalname || 'file')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-');

    callback(null, `${Date.now()}-${safeName}`);
  }
});

const movieUpload = multer({
  storage,
  fileFilter: (_req, file, callback) => {
    const isImage = file.fieldname === 'poster' || file.fieldname === 'banner';

    if (isImage && !file.mimetype.startsWith('image/')) {
      callback(new Error('Los posters y banners deben ser imágenes'));
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 1024 * 1024 * 5
  }
});

const uploadMovieImages = movieUpload.fields([{ name: 'poster', maxCount: 1 }, { name: 'banner', maxCount: 1 }]);

module.exports = {
  movieUpload,
  uploadMovieImages
};
