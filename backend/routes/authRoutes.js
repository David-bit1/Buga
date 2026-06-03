const express = require('express');
const { login, register, me } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, me);
router.all(['/register', '/login'], (_req, res) => {
  res.status(405).json({ message: 'Método no permitido. Usa POST.' });
});

module.exports = router;
