const express = require('express');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const { uploadMovieImages } = require('../middleware/uploadMiddleware');
const {
  listMovies,
  getMovie,
  getMovieByTmdbId,
  createMovie,
  updateMovie,
  deleteMovie
} = require('../controllers/movieController');

const router = express.Router();

router.get('/tmdb/:tmdbId', getMovieByTmdbId);
router.get('/public/:tmdbId', getMovieByTmdbId);

router.use(protect, requireAdmin);

router.get('/', listMovies);
router.get('/:movieId', getMovie);
router.post('/', createMovie);
router.post('/upload', uploadMovieImages, createMovie);
router.put('/:movieId', uploadMovieImages, updateMovie);
router.delete('/:movieId', deleteMovie);

module.exports = router;
