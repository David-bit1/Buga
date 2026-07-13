const express = require('express');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
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
router.put('/:movieId', updateMovie);
router.delete('/:movieId', deleteMovie);

module.exports = router;

module.exports = router;
