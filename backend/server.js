require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const movieRoutes = require('./routes/movieRoutes');
const adminRoutes = require('./routes/adminRoutes');
const seriesRoutes = require('./routes/seriesRoutes');
const adminSeriesRoutes = require('./routes/adminSeriesRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const { protect, requireAdmin: admin } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Setup
const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map(origin => origin.trim()).filter(Boolean);
if (allowedOrigins.length === 0) {
  allowedOrigins.push('*'); // Fallback to allow all if not specified
}

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin 'origin' (como Postman, apps móviles, o peticiones de servidor a servidor)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

    if (!isAllowed) {
      console.warn(`CORS: Origen denegado: ${origin}. Orígenes permitidos: ${allowedOrigins.join(', ')}`);
      return callback(new Error('El origen de esta petición no está permitido por la política de CORS.'));
    }

    callback(null, isAllowed);
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', protect, profileRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/admin', protect, admin, adminRoutes);
app.use('/api/admin', protect, admin, adminSeriesRoutes);
app.use('/api', seriesRoutes);
app.use('/api/recommendations', protect, recommendationRoutes);

// --- Static Files ---
// Serve the frontend directory from the root. This must be AFTER all API routes.
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
  
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Error interno del servidor' 
    : (err.message || 'Something broke!');
    
  res.status(status).json({ 
    message,
    ...(process.env.NODE_ENV !== 'production' && { code: err.code, details: err.details })
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Fallback to index.html for Single Page Application (SPA) behavior
// This MUST be the last GET route.
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
