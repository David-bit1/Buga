const mongoose = require('mongoose');

const preferenceItemSchema = new mongoose.Schema(
  {
    movieId: {
      type: Number,
      required: true
    },
    title: {
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
    genres: {
      type: [
        {
          id: Number,
          name: String
        }
      ],
      default: []
    },
    progress: {
      type: Number,
      default: 0
    },
    currentTime: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 0
    },
    runtime: {
      type: Number,
      default: 0
    },
    lastViewed: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const scoreItemSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      default: ''
    },
    score: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const userPreferencesSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: true,
      index: true
    },
    favoriteMovieIds: {
      type: [Number],
      default: []
    },
    watchHistory: {
      type: [preferenceItemSchema],
      default: []
    },
    continueWatching: {
      type: [preferenceItemSchema],
      default: []
    },
    recentMovieIds: {
      type: [Number],
      default: []
    },
    genreScores: {
      type: [scoreItemSchema],
      default: []
    },
    actorScores: {
      type: [scoreItemSchema],
      default: []
    },
    directorScores: {
      type: [scoreItemSchema],
      default: []
    },
    lastInteractionAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

userPreferencesSchema.index({ user: 1, profile: 1 }, { unique: true });

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);
