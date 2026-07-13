const express = require('express');
const {
  listMovies,
  getMovie,
  getMovieByTmdbId
} = require('../controllers/movieController');

const router = express.Router();

// Public routes
router.get('/tmdb/:tmdbId', getMovieByTmdbId);
router.get('/', listMovies);
router.get('/:movieId', getMovie);

module.exports = router;
