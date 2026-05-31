const express = require('express');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const {
  upload,
  uploadVideo,
  getStreamInfo,
  getMasterPlaylist,
  getVideoAsset
} = require('../controllers/videoController');

const router = express.Router();

router.post('/upload', protect, requireAdmin, upload.single('video'), uploadVideo);
router.get('/:tmdbId/stream', protect, getStreamInfo);
router.get('/:tmdbId/master.m3u8', protect, getMasterPlaylist);
router.get('/:tmdbId/file/*', protect, getVideoAsset);

module.exports = router;
