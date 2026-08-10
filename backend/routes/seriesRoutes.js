const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  listSeries,
  getSeries,
  listSeasons,
  getSeason,
  listEpisodes,
  getEpisode
} = require('../controllers/seriesController');

const router = express.Router();

// Public routes
router.get('/series', listSeries);
router.get('/series/:seriesId', getSeries);
router.get('/series/:seriesId/seasons', listSeasons);
router.get('/series/:seriesId/seasons/:seasonId', getSeason);
router.get('/series/:seriesId/seasons/:seasonId/episodes', listEpisodes);
router.get('/series/:seriesId/seasons/:seasonId/episodes/:episodeId', getEpisode);

module.exports = router;