const mongoose = require('mongoose');
const Profile = require('../models/Profile');

const MAX_PROFILES_PER_USER = Number(process.env.MAX_PROFILES_PER_USER || 5);

const DEFAULT_AVATARS = [
  { key: 'neon', themeColor: '#8a4dff' },
  { key: 'violet', themeColor: '#c06cff' },
  { key: 'midnight', themeColor: '#4f6fff' },
  { key: 'ember', themeColor: '#ff7a59' },
  { key: 'aurora', themeColor: '#27d6a9' },
  { key: 'gold', themeColor: '#f0b34c' }
];

const sanitizeProfile = (profile) => ({
  id: profile._id,
  user: profile.user,
  name: profile.name,
  avatar: profile.avatar,
  themeColor: profile.themeColor,
  isKids: profile.isKids,
  isDefault: profile.isDefault,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt
});

const getDefaultAvatar = (index = 0) => DEFAULT_AVATARS[index % DEFAULT_AVATARS.length];

const ensureInitialProfile = async (userId) => {
  const existingProfiles = await Profile.countDocuments({ user: userId });

  if (existingProfiles > 0) {
    return null;
  }

  const avatar = getDefaultAvatar(0);
  return Profile.create({
    user: userId,
    name: 'Perfil 1',
    avatar: avatar.key,
    themeColor: avatar.themeColor,
    isDefault: true
  });
};

const getProfiles = async (req, res, next) => {
  try {
    const { id: userId } = req.user;

    await ensureInitialProfile(userId);

    const profiles = await Profile.find({ user: userId }).sort({ createdAt: 1 });

    return res.json({
      limit: MAX_PROFILES_PER_USER,
      count: profiles.length,
      profiles: profiles.map(sanitizeProfile)
    });
  } catch (error) {
    return next(error);
  }
};

const createProfile = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { name, avatar, themeColor, isKids = false } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'El nombre del perfil es obligatorio' });
    }

    const profileCount = await Profile.countDocuments({ user: userId });
    if (profileCount >= MAX_PROFILES_PER_USER) {
      return res.status(403).json({ message: 'Llegaste al límite de perfiles permitidos' });
    }

    const normalizedName = String(name).trim();
    const duplicate = await Profile.findOne({
      user: userId,
      name: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    });

    if (duplicate) {
      return res.status(409).json({ message: 'Ya existe un perfil con ese nombre' });
    }

    const selectedAvatar = DEFAULT_AVATARS.find((item) => item.key === avatar) || getDefaultAvatar(profileCount);
    const profile = await Profile.create({
      user: userId,
      name: normalizedName,
      avatar: selectedAvatar.key,
      themeColor: themeColor || selectedAvatar.themeColor,
      isKids: Boolean(isKids),
      isDefault: profileCount === 0
    });

    return res.status(201).json({
      message: 'Perfil creado correctamente',
      profile: sanitizeProfile(profile)
    });
  } catch (error) {
    return next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { profileId } = req.params;
    const { name, avatar, themeColor, isKids } = req.body;

    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ message: 'Perfil inválido' });
    }

    const profile = await Profile.findOne({ _id: profileId, user: userId });
    if (!profile) {
      return res.status(404).json({ message: 'Perfil no encontrado' });
    }

    if (name) {
      profile.name = String(name).trim();
    }

    if (avatar) {
      const selectedAvatar = DEFAULT_AVATARS.find((item) => item.key === avatar);
      if (selectedAvatar) {
        profile.avatar = selectedAvatar.key;
        profile.themeColor = themeColor || selectedAvatar.themeColor;
      }
    }

    if (typeof themeColor === 'string' && themeColor.trim()) {
      profile.themeColor = themeColor.trim();
    }

    if (typeof isKids === 'boolean') {
      profile.isKids = isKids;
    }

    await profile.save();

    return res.json({
      message: 'Perfil actualizado correctamente',
      profile: sanitizeProfile(profile)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteProfile = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { profileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ message: 'Perfil inválido' });
    }

    const profile = await Profile.findOne({ _id: profileId, user: userId });
    if (!profile) {
      return res.status(404).json({ message: 'Perfil no encontrado' });
    }

    if (profile.isDefault) {
      const fallbackProfile = await Profile.findOne({ user: userId, _id: { $ne: profileId } }).sort({ createdAt: 1 });
      if (fallbackProfile) {
        fallbackProfile.isDefault = true;
        await fallbackProfile.save();
      }
    }

    await profile.deleteOne();

    return res.json({ message: 'Perfil eliminado correctamente' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  DEFAULT_AVATARS,
  MAX_PROFILES_PER_USER,
  sanitizeProfile,
  ensureInitialProfile,
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile
};
