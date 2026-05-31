const express = require('express');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const {
  getDashboard,
  listMovies,
  createMovie,
  updateMovie,
  deleteMovie,
  listGenres,
  createGenre,
  updateGenre,
  deleteGenre,
  listUsers,
  updateUser,
  deleteUser,
  getSettings,
  updateSettings
} = require('../controllers/adminController');

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/dashboard', getDashboard);

router.route('/movies')
  .get(listMovies)
  .post(createMovie);

router.route('/movies/:movieId')
  .put(updateMovie)
  .delete(deleteMovie);

router.route('/genres')
  .get(listGenres)
  .post(createGenre);

router.route('/genres/:genreId')
  .put(updateGenre)
  .delete(deleteGenre);

router.route('/users')
  .get(listUsers);

router.route('/users/:userId')
  .put(updateUser)
  .delete(deleteUser);

router.route('/settings')
  .get(getSettings)
  .put(updateSettings);

module.exports = router;
