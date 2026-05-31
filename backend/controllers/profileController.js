const {
  selectMany,
  selectOne,
  countRows,
  insertOne,
  updateRows,
  deleteRows
} = require('../services/supabaseRepository');

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
  id: profile.id,
  user: profile.user_id,
  name: profile.name,
  avatar: profile.avatar,
  themeColor: profile.theme_color,
  isKids: Boolean(profile.is_kids),
  isDefault: Boolean(profile.is_default),
  createdAt: profile.created_at,
  updatedAt: profile.updated_at
});

const getDefaultAvatar = (index = 0) => DEFAULT_AVATARS[index % DEFAULT_AVATARS.length];

const ensureInitialProfile = async (userId) => {
  const existingProfiles = await countRows('profiles', [
    { type: 'eq', column: 'user_id', value: userId }
  ]);

  if (existingProfiles > 0) {
    return null;
  }

  const avatar = getDefaultAvatar(0);
  return insertOne('profiles', {
    user_id: userId,
    name: 'Perfil 1',
    avatar: avatar.key,
    theme_color: avatar.themeColor,
    is_kids: false,
    is_default: true
  });
};

const getProfiles = async (req, res, next) => {
  try {
    const { id: userId } = req.user;

    await ensureInitialProfile(userId);

    const profiles = await selectMany('profiles', {
      filters: [{ type: 'eq', column: 'user_id', value: userId }],
      order: { column: 'created_at', ascending: true }
    });

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

    const profileCount = await countRows('profiles', [
      { type: 'eq', column: 'user_id', value: userId }
    ]);

    if (profileCount >= MAX_PROFILES_PER_USER) {
      return res.status(403).json({ message: 'Llegaste al límite de perfiles permitidos' });
    }

    const normalizedName = String(name).trim();
    const duplicate = await selectOne('profiles', {
      filters: [
        { type: 'eq', column: 'user_id', value: userId },
        { type: 'ilike', column: 'name', value: normalizedName }
      ]
    });

    if (duplicate) {
      return res.status(409).json({ message: 'Ya existe un perfil con ese nombre' });
    }

    const selectedAvatar = DEFAULT_AVATARS.find((item) => item.key === avatar) || getDefaultAvatar(profileCount);
    const profile = await insertOne('profiles', {
      user_id: userId,
      name: normalizedName,
      avatar: selectedAvatar.key,
      theme_color: themeColor || selectedAvatar.themeColor,
      is_kids: Boolean(isKids),
      is_default: profileCount === 0
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

    const profile = await selectOne('profiles', {
      filters: [
        { type: 'eq', column: 'id', value: profileId },
        { type: 'eq', column: 'user_id', value: userId }
      ]
    });

    if (!profile) {
      return res.status(404).json({ message: 'Perfil no encontrado' });
    }

    const payload = {};

    if (name) {
      payload.name = String(name).trim();
    }

    if (avatar) {
      const selectedAvatar = DEFAULT_AVATARS.find((item) => item.key === avatar);
      if (selectedAvatar) {
        payload.avatar = selectedAvatar.key;
        payload.theme_color = themeColor || selectedAvatar.themeColor;
      }
    }

    if (typeof themeColor === 'string' && themeColor.trim()) {
      payload.theme_color = themeColor.trim();
    }

    if (typeof isKids === 'boolean') {
      payload.is_kids = isKids;
    }

    const [updatedProfile] = await updateRows(
      'profiles',
      [
        { type: 'eq', column: 'id', value: profileId },
        { type: 'eq', column: 'user_id', value: userId }
      ],
      payload
    );

    return res.json({
      message: 'Perfil actualizado correctamente',
      profile: sanitizeProfile(updatedProfile)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteProfile = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { profileId } = req.params;

    const profile = await selectOne('profiles', {
      filters: [
        { type: 'eq', column: 'id', value: profileId },
        { type: 'eq', column: 'user_id', value: userId }
      ]
    });

    if (!profile) {
      return res.status(404).json({ message: 'Perfil no encontrado' });
    }

    if (profile.is_default) {
      const fallbackProfile = await selectOne('profiles', {
        filters: [
          { type: 'eq', column: 'user_id', value: userId },
          { type: 'neq', column: 'id', value: profileId }
        ],
        order: { column: 'created_at', ascending: true }
      });

      if (fallbackProfile) {
        await updateRows(
          'profiles',
          [{ type: 'eq', column: 'id', value: fallbackProfile.id }],
          { is_default: true }
        );
      }
    }

    await deleteRows('profiles', [
      { type: 'eq', column: 'id', value: profileId },
      { type: 'eq', column: 'user_id', value: userId }
    ]);

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
