const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile
} = require('../controllers/profileController');

const router = express.Router();

router.use(protect);

router.get('/', getProfiles);
router.post('/', createProfile);
router.put('/:profileId', updateProfile);
router.delete('/:profileId', deleteProfile);

module.exports = router;
