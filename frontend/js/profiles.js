(function () {
const PROFILES_API_BASE = window.BugaEndpoints?.profilesBase || 'https://buga.onrender.com/api/profiles';
const PROFILE_AVATARS = [
  { key: 'neon', label: 'Neon', icon: 'N', color: '#8a4dff' },
  { key: 'violet', label: 'Violet', icon: 'V', color: '#c06cff' },
  { key: 'midnight', label: 'Midnight', icon: 'M', color: '#4f6fff' },
  { key: 'ember', label: 'Ember', icon: 'E', color: '#ff7a59' },
  { key: 'aurora', label: 'Aurora', icon: 'A', color: '#27d6a9' },
  { key: 'gold', label: 'Gold', icon: 'G', color: '#f0b34c' }
];

const profilesGrid = document.getElementById('profilesGrid');
const profilesLimitLabel = document.getElementById('profilesLimitLabel');
const createProfileShortcut = document.getElementById('createProfileShortcut');
const manageProfilesGrid = document.getElementById('manageProfilesGrid');
const manageProfilesLimitLabel = document.getElementById('manageProfilesLimitLabel');
const profileForm = document.getElementById('profileForm');
const profileFormId = document.getElementById('profileFormId');
const profileName = document.getElementById('profileName');
const profileThemeColor = document.getElementById('profileThemeColor');
const profileAvatar = document.getElementById('profileAvatar');
const avatarPicker = document.getElementById('avatarPicker');
const profileKids = document.getElementById('profileKids');
const profileSubmit = document.getElementById('profileSubmit');
const profileCancel = document.getElementById('profileCancel');
const pageLoader = document.getElementById('pageLoader');

let profilesCache = [];
let profileLimit = 5;
let editingProfileId = '';

const requireAuth = () => {
  if (!window.BugaAuth?.getAuthToken?.()) {
    window.location.href = '/pages/login.html';
    return false;
  }

  return true;
};

const profileAuthFetch = (url, options = {}) => {
  const token = window.BugaAuth?.getAuthToken?.();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers
  });
};

const authFetchWithTimeout = (url, options = {}, label = 'request') =>
  Promise.race([
    profileAuthFetch(url, options),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timeout`)), window.BugaConfig?.requestTimeoutMs || 9000);
    })
  ]);

const notify = (options) => window.BugaToast?.show?.(options);

const showLoader = () => {
  document.body.classList.add('is-loading');
  pageLoader?.setAttribute('aria-busy', 'true');
};

const hideLoader = () => {
  document.body.classList.remove('is-loading');
  pageLoader?.setAttribute('aria-busy', 'false');
};

const getAvatar = (avatarKey) => PROFILE_AVATARS.find((item) => item.key === avatarKey) || PROFILE_AVATARS[0];

const createAvatarMarkup = (avatarKey, color, size = '') => {
  const avatar = getAvatar(avatarKey);
  return `<div class="profile-avatar ${size}" style="background:${color || avatar.color}">${avatar.icon}</div>`;
};

const renderAvatarPicker = () => {
  if (!avatarPicker) {
    return;
  }

  avatarPicker.innerHTML = PROFILE_AVATARS.map((avatar) => `
    <button class="avatar-option ${avatar.key === 'neon' ? 'is-active' : ''}" type="button" data-avatar-key="${avatar.key}" data-avatar-color="${avatar.color}">
      <span style="background:${avatar.color}">${avatar.icon}</span>
      <strong>${avatar.label}</strong>
    </button>
  `).join('');
};

const setActiveAvatar = (avatarKey) => {
  if (profileAvatar) {
    profileAvatar.value = avatarKey;
  }

  avatarPicker?.querySelectorAll('.avatar-option').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.avatarKey === avatarKey);
  });
};

const formatProfileMeta = (profile) => {
  const badges = [];
  if (profile.isDefault) badges.push('Principal');
  if (profile.isKids) badges.push('Kids');
  badges.push(profile.avatar || 'neon');
  return badges.join(' • ');
};

const renderProfiles = () => {
  if (profilesGrid) {
    const activeProfile = window.BugaAuth?.getActiveProfile?.();
    const createCard = profilesCache.length < profileLimit
      ? `
        <button class="profile-create-card" type="button" id="openManageProfiles">
          <div class="profile-create-plus">+</div>
          <h3>Agregar perfil</h3>
          <p>Crear hasta ${profileLimit} perfiles por cuenta.</p>
        </button>
      `
      : '';

    profilesGrid.innerHTML = [
      ...profilesCache.map((profile) => `
        <article class="profile-card ${activeProfile?.id === profile.id ? 'is-active' : ''}" data-profile-id="${profile.id}">
          ${createAvatarMarkup(profile.avatar, profile.themeColor)}
          <h3>${profile.name}</h3>
          <p>${formatProfileMeta(profile)}</p>
        </article>
      `),
      createCard
    ].filter(Boolean).join('');
  }

  if (manageProfilesGrid) {
    const activeProfile = window.BugaAuth?.getActiveProfile?.();
    manageProfilesGrid.innerHTML = profilesCache.map((profile) => `
      <article class="manage-profile-item ${activeProfile?.id === profile.id ? 'is-active' : ''}" data-profile-item="${profile.id}">
        ${createAvatarMarkup(profile.avatar, profile.themeColor, 'small')}
        <div>
          <h3>${profile.name}</h3>
          <p>${formatProfileMeta(profile)}</p>
        </div>
        <div class="manage-actions">
          <button class="profile-mini-btn" type="button" data-edit-profile="${profile.id}">Editar</button>
          <button class="profile-mini-btn" type="button" data-delete-profile="${profile.id}">Eliminar</button>
        </div>
      </article>
    `).join('') || '<div class="manage-empty">Todavía no hay perfiles.</div>';
  }

  const limitText = `${profilesCache.length}/${profileLimit} perfiles`;
  if (profilesLimitLabel) profilesLimitLabel.textContent = limitText;
  if (manageProfilesLimitLabel) manageProfilesLimitLabel.textContent = limitText;
};

const fetchProfiles = async () => {
  console.log('Auth state:', {
    page: window.location.pathname,
    loading: true,
    token: Boolean(window.BugaAuth?.getAuthToken?.()),
    user: window.BugaAuth?.getAuthSession?.()?.user || null
  });

  const response = await authFetchWithTimeout(PROFILES_API_BASE, {}, 'profiles');
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'No se pudieron cargar los perfiles');
    error.status = response.status;
    throw error;
  }

  profileLimit = Number(data.limit || 5);
  profilesCache = Array.isArray(data.profiles) ? data.profiles : [];
  return data;
};

const selectProfile = (profile) => {
  window.BugaAuth?.setActiveProfile?.(profile);
  notify({
    type: 'success',
    title: 'Perfil seleccionado',
    message: `Ahora estás viendo Buga como ${profile.name}.`,
    key: `select:${profile.id}`
  });
  window.setTimeout(() => {
    window.location.href = '/index.html';
  }, 350);
};

const openEditProfile = (profile) => {
  editingProfileId = profile.id;
  if (profileFormId) profileFormId.value = profile.id;
  if (profileName) profileName.value = profile.name;
  if (profileThemeColor) profileThemeColor.value = profile.themeColor || '#8a4dff';
  if (profileKids) profileKids.checked = Boolean(profile.isKids);
  setActiveAvatar(profile.avatar || 'neon');
  if (profileSubmit) profileSubmit.textContent = 'Guardar cambios';
  if (profileCancel) profileCancel.hidden = false;
  notify({
    type: 'info',
    title: 'Editando perfil',
    message: `Ahora puedes modificar ${profile.name}.`,
    key: `edit:${profile.id}`
  });
};

const resetForm = () => {
  editingProfileId = '';
  if (profileFormId) profileFormId.value = '';
  if (profileName) profileName.value = '';
  if (profileThemeColor) profileThemeColor.value = '#8a4dff';
  if (profileKids) profileKids.checked = false;
  setActiveAvatar('neon');
  if (profileSubmit) profileSubmit.textContent = 'Crear perfil';
  if (profileCancel) profileCancel.hidden = true;
};

const submitProfileForm = async (event) => {
  event.preventDefault();

  const payload = {
    name: profileName.value.trim(),
    avatar: profileAvatar.value,
    themeColor: profileThemeColor.value,
    isKids: Boolean(profileKids.checked)
  };

  if (!payload.name) {
    notify({ type: 'error', title: 'Nombre requerido', message: 'Escribe un nombre para el perfil.' });
    return;
  }

  const isEditing = Boolean(editingProfileId);
  try {
    const response = await profileAuthFetch(`${PROFILES_API_BASE}${isEditing ? `/${editingProfileId}` : ''}`, {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || 'No se pudo guardar el perfil');
      error.status = response.status;
      throw error;
    }

    notify({
      type: 'success',
      title: isEditing ? 'Perfil actualizado' : 'Perfil creado',
      message: data.profile ? `${data.profile.name} quedó listo.` : 'Listo.'
    });

    await refreshProfiles();
    resetForm();
  } catch (error) {
    notify({
      type: 'error',
      title: 'No se pudo guardar',
      message: error.message || 'Revisa tu conexión e inténtalo otra vez.'
    });
  }
};

const deleteProfile = async (profileId) => {
  const profile = profilesCache.find((item) => String(item.id) === String(profileId));
  if (!profile) {
    return;
  }

  if (!window.confirm(`¿Eliminar el perfil ${profile.name}?`)) {
    return;
  }

  try {
    const response = await profileAuthFetch(`${PROFILES_API_BASE}/${profileId}`, { method: 'DELETE' });
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || 'No se pudo eliminar el perfil');
      error.status = response.status;
      throw error;
    }

    const activeProfile = window.BugaAuth?.getActiveProfile?.();
    if (activeProfile?.id === profileId) {
      const fallback = profilesCache.find((item) => String(item.id) !== String(profileId));
      if (fallback) {
        window.BugaAuth?.setActiveProfile?.(fallback);
      } else {
        window.BugaAuth?.clearActiveProfile?.();
      }
    }

    notify({ type: 'success', title: 'Perfil eliminado', message: `${profile.name} se quitó correctamente.` });
    await refreshProfiles();
  } catch (error) {
    notify({
      type: 'error',
      title: 'No se pudo eliminar',
      message: error.message || 'Revisa tu conexión e inténtalo otra vez.'
    });
  }
};

const refreshProfiles = async () => {
  let failSafeId = null;

  showLoader();
  failSafeId = window.setTimeout(() => {
    console.warn('Profiles loader fail-safe activated');
    hideLoader();
  }, 12000);

  try {
    await fetchProfiles();
    renderProfiles();
  } catch (error) {
    console.warn('Profiles failed', error);
    notify({ type: 'error', title: 'No se pudieron cargar los perfiles', message: error.message || 'Revisa tu conexión.' });
    if (error.status === 401 || error.status === 403) {
      window.location.href = '/pages/login.html';
    }
  } finally {
    window.clearTimeout(failSafeId);
    hideLoader();
    console.log('Loading:', false);
    console.log('User:', window.BugaAuth?.getAuthSession?.()?.user || null);
  }
};

const wireEvents = () => {
  renderAvatarPicker();
  setActiveAvatar('neon');

  avatarPicker?.addEventListener('click', (event) => {
    const avatarButton = event.target.closest('[data-avatar-key]');
    if (!avatarButton) {
      return;
    }
    setActiveAvatar(avatarButton.dataset.avatarKey);
  });

  profilesGrid?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-profile-id]');
    const createCard = event.target.closest('#openManageProfiles');

    if (createCard) {
      window.location.href = '/pages/manage-profiles.html';
      return;
    }

    if (card) {
      const profile = profilesCache.find((item) => String(item.id) === card.dataset.profileId);
      if (profile) {
        selectProfile(profile);
      }
    }
  });

  manageProfilesGrid?.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-profile]');
    const deleteButton = event.target.closest('[data-delete-profile]');

    if (editButton) {
      const profile = profilesCache.find((item) => String(item.id) === editButton.dataset.editProfile);
      if (profile) {
        openEditProfile(profile);
      }
      return;
    }

    if (deleteButton) {
      deleteProfile(deleteButton.dataset.deleteProfile);
    }
  });

  profileForm?.addEventListener('submit', submitProfileForm);

  profileCancel?.addEventListener('click', resetForm);

  createProfileShortcut?.addEventListener('click', () => {
    window.location.href = '/pages/manage-profiles.html';
  });
};

const bootstrap = async () => {
  if (!requireAuth()) {
    return;
  }

  wireEvents();
  await refreshProfiles();
};

document.addEventListener('DOMContentLoaded', bootstrap);
})();
