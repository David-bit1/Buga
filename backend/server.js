const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const videoRoutes = require('./routes/videoRoutes');
const movieRoutes = require('./routes/movieRoutes');
const { connectMongo } = require('./config/mongo');

const app = express();
const port = process.env.PORT || 3000;
const allowedOrigins = String(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (origin.endsWith('.vercel.app')) {
    return true;
  }

  return false;
};

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  }
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/movies', movieRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', (_req, res) => {
  res.status(404).json({
    message: 'Ruta API no encontrada'
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: error.message || 'Error interno del servidor'
  });
});

const start = async () => {
  try {
    if (process.env.MONGO_URI) {
      await connectMongo();
    } else {
      console.warn('MONGO_URI no configurado; el sistema de subida de películas quedará deshabilitado hasta configurarlo.');
    }

    app.listen(port, () => {
      console.log(`Buga backend corriendo en http://localhost:${port}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el backend:', error.message);
    process.exit(1);
  }
};

start();
