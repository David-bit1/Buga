const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI no está definida en .env');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB conectado');
};

module.exports = connectDB;
