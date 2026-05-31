const mongoose = require('mongoose');

const movieGenreSchema = new mongoose.Schema(
  {
    id: Number,
    name: String
  },
  { _id: false }
);

const adminMovieSchema = new mongoose.Schema(
  {
    tmdbId: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'El título es obligatorio'],
      trim: true
    },
    overview: {
      type: String,
      default: ''
    },
    poster: {
      type: String,
      default: ''
    },
    backdrop: {
      type: String,
      default: ''
    },
    releaseDate: {
      type: String,
      default: ''
    },
    runtime: {
      type: Number,
      default: 0
    },
    genres: {
      type: [movieGenreSchema],
      default: []
    },
    videoSource: {
      type: String,
      default: ''
    },
    featured: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published'
    },
    processingStatus: {
      type: String,
      enum: ['idle', 'processing', 'ready', 'error'],
      default: 'idle'
    },
    sourceFile: {
      type: String,
      default: ''
    },
    hlsDirectory: {
      type: String,
      default: ''
    },
    hlsManifest: {
      type: String,
      default: ''
    },
    hlsQualities: {
      type: [
        {
          label: String,
          height: Number,
          bandwidth: Number,
          playlist: String
        }
      ],
      default: []
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminMovie', adminMovieSchema);
