const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getStreamInfo,
  getMasterPlaylist,
  getVideoAsset
} = require('../controllers/videoController');

const router = express.Router();

// Legacy HLS streaming endpoints (kept for backward compatibility with existing HLS content)
router.get('/:tmdbId/stream', protect, getStreamInfo);
router.get('/:tmdbId/master.m3u8', protect, getMasterPlaylist);
router.get('/:tmdbId/file/*', protect, getVideoAsset);

module.exports = router;
