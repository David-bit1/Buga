const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    genres: {
      type: [String],
      default: []
    },
    year: {
      type: Number,
      required: true
    },
    duration: {
      type: Number,
      default: 0
    },
    classification: {
      type: String,
      default: 'PG-13'
    },
    posterPath: {
      type: String,
      default: ''
    },
    bannerPath: {
      type: String,
      default: ''
    },
    videoPath: {
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
    createdBy: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

movieSchema.index({ title: 1, year: 1 });

module.exports = mongoose.models.Movie || mongoose.model('Movie', movieSchema);
