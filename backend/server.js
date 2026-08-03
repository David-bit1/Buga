require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const movieRoutes = require('./routes/movieRoutes');
const adminRoutes = require('./routes/adminRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const { protect, requireAdmin: admin } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map(origin => origin.trim()).filter(Boolean);
if (allowedOrigins.length === 0) {
  allowedOrigins.push('*'); // Fallback to allow all if not specified
}

app.use(cors({
  origin: (origin, callback) => {
    callback(null, allowedOrigins.includes('*') || allowedOrigins.includes(origin));
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug logs for route imports
console.log('authRoutes:', authRoutes);
console.log('profileRoutes:', profileRoutes);
console.log('movieRoutes:', movieRoutes);
console.log('adminRoutes:', adminRoutes);
console.log('recommendationRoutes:', recommendationRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', protect, profileRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/admin', protect, admin, adminRoutes);
app.use('/api/recommendations', protect, recommendationRoutes);

// --- Static Files ---
// Serve the frontend directory from the root. This must be AFTER all API routes.
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Error Handling Middleware (simple version)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Fallback to index.html for Single Page Application (SPA) behavior
// This MUST be the last GET route.
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
