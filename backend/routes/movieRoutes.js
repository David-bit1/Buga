const express = require('express');
const {
  listMovies,
  getMovie,
  getMovieByTmdbId,
  getPopular
} = require('../controllers/movieController');

const router = express.Router();

// Public routes
router.get('/popular/:type', getPopular);
router.get('/tmdb/:tmdbId', getMovieByTmdbId);
router.get('/', listMovies);
router.get('/:movieId', getMovie);

module.exports = router;
