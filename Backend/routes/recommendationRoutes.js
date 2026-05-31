const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getRecommendations,
  recordRecommendationEvent
} = require('../controllers/recommendationController');

const router = express.Router();

router.use(protect);

router.get('/', getRecommendations);
router.post('/events', recordRecommendationEvent);

module.exports = router;
