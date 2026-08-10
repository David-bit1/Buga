const express = require('express');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const {
  adminListSeries,
  getSeries,
  createSeries,
  updateSeries,
  deleteSeries,
  listSeasons,
  getSeason,
  createSeason,
  updateSeason,
  deleteSeason,
  listEpisodes,
  getEpisode,
  createEpisode,
  updateEpisode,
  deleteEpisode
} = require('../controllers/seriesController');

const router = express.Router();

router.use(protect, requireAdmin);

// Series
router.get('/series', adminListSeries);
router.post('/series', createSeries);
router.get('/series/:seriesId', getSeries);
router.put('/series/:seriesId', updateSeries);
router.delete('/series/:seriesId', deleteSeries);

// Seasons
router.get('/series/:seriesId/seasons', listSeasons);
router.post('/series/:seriesId/seasons', createSeason);
router.get('/series/:seriesId/seasons/:seasonId', getSeason);
router.put('/series/:seriesId/seasons/:seasonId', updateSeason);
router.delete('/series/:seriesId/seasons/:seasonId', deleteSeason);

// Episodes
router.get('/series/:seriesId/seasons/:seasonId/episodes', listEpisodes);
router.post('/series/:seriesId/seasons/:seasonId/episodes', createEpisode);
router.get('/series/:seriesId/seasons/:seasonId/episodes/:episodeId', getEpisode);
router.put('/series/:seriesId/seasons/:seasonId/episodes/:episodeId', updateEpisode);
router.delete('/series/:seriesId/seasons/:seasonId/episodes/:episodeId', deleteEpisode);

module.exports = router;