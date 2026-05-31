const Profile = require('../models/Profile');
const { getRecommendationsForProfile, recordEvent } = require('../services/recommendationService');

const ensureProfileOwned = async (userId, profileId) => {
  const profile = await Profile.findOne({ _id: profileId, user: userId });
  if (!profile) {
    const error = new Error('Perfil no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return profile;
};

const getRecommendations = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const profileId = String(req.query.profileId || '').trim();
    const limit = Number(req.query.limit || 12);

    if (!profileId) {
      return res.status(400).json({ message: 'profileId es obligatorio' });
    }

    await ensureProfileOwned(userId, profileId);
    const data = await getRecommendationsForProfile({
      userId,
      profileId,
      limit: Number.isFinite(limit) ? Math.max(6, Math.min(limit, 24)) : 12
    });

    return res.json({
      message: 'Recomendaciones generadas correctamente',
      ...data
    });
  } catch (error) {
    return next(error);
  }
};

const recordRecommendationEvent = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { profileId, ...payload } = req.body || {};

    if (!profileId) {
      return res.status(400).json({ message: 'profileId es obligatorio' });
    }

    await ensureProfileOwned(userId, profileId);
    const preferences = await recordEvent({
      userId,
      profileId,
      payload
    });

    return res.json({
      message: 'Preferencias actualizadas correctamente',
      profileId,
      updatedAt: preferences.lastInteractionAt,
      counts: {
        favorites: preferences.favoriteMovieIds.length,
        history: preferences.watchHistory.length,
        continueWatching: preferences.continueWatching.length
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getRecommendations,
  recordRecommendationEvent
};
