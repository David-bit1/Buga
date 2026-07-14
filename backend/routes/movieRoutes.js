const express = require('express');
const {
  listMovies,
  getMovie,
  getMovieByTmdbId,
  getPopular,
  buildTmdbMoviePayload,
  serializeMovie
} = require('../controllers/movieController');
const { selectOne, selectMany } = require('../services/supabaseRepository');

const router = express.Router();

// Public routes
router.get('/popular/:type', getPopular);
router.get('/tmdb/:tmdbId', getMovieByTmdbId);
router.get('/', listMovies);
router.get('/:movieId', getMovie);

router.get('/debug/tmdb/:tmdbId', async (req, res, next) => {
  try {
    const tmdbId = Number(req.params.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ message: 'tmdbId inválido' });
    }

    const tmdbPayload = await buildTmdbMoviePayload(tmdbId);
    const existingMovie = await selectOne('movies', { filters: [{ type: 'eq', column: 'tmdb_id', value: tmdbId }] });
    const allMovies = await selectMany('movies', { order: { column: 'created_at', ascending: false } });
    const serializedList = allMovies.map(serializeMovie);

    res.json({
      tmdbPayload,
      existingMovie: existingMovie || null,
      serializedExisting: existingMovie ? serializeMovie(existingMovie) : null,
      listMoviesResponse: serializedList
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
