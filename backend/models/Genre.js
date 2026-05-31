const mongoose = require('mongoose');

const genreSchema = new mongoose.Schema(
  {
    tmdbId: {
      type: Number,
      default: null
    },
    name: {
      type: String,
      required: [true, 'El nombre del género es obligatorio'],
      trim: true
    },
    slug: {
      type: String,
      required: [true, 'El slug es obligatorio'],
      trim: true,
      lowercase: true,
      unique: true,
      index: true
    },
    color: {
      type: String,
      default: '#8a4dff'
    },
    description: {
      type: String,
      default: ''
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Genre', genreSchema);
