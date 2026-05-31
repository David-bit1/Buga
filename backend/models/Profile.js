const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'El nombre del perfil es obligatorio'],
      trim: true,
      minlength: 1,
      maxlength: 32
    },
    avatar: {
      type: String,
      default: 'neon'
    },
    themeColor: {
      type: String,
      default: '#8a4dff'
    },
    isKids: {
      type: Boolean,
      default: false
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

profileSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Profile', profileSchema);
