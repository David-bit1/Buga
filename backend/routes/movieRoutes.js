const express = require('express');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const { uploadMovieFiles } = require('../middleware/uploadMiddleware');
const {
  listMovies,
  getMovie,
  uploadMovie,
  updateMovie,
  deleteMovie
} = require('../controllers/movieController');

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/', listMovies);
router.get('/:movieId', getMovie);
router.post('/upload', uploadMovieFiles, uploadMovie);
router.put('/:movieId', uploadMovieFiles, updateMovie);
router.delete('/:movieId', deleteMovie);

module.exports = router;
