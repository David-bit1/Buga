const mongoose = require('mongoose');

let connectionPromise = null;

const connectMongo = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI es obligatorio para el sistema de subida de películas');
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true
    });
  }

  await connectionPromise;
  return mongoose.connection;
};

module.exports = { connectMongo };
