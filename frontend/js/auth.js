const API_BASE = '/api/auth';
const AUTH_STORAGE_KEY = 'buga-auth';
const ACTIVE_PROFILE_KEY = 'buga-active-profile';
const TOAST_FLASH_KEY = 'buga-toast-flash';

const toastIcons = {
    success: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"></path>
        </svg>
    `,
    error: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 8v5"></path>
            <path d="M12 17h.01"></path>
            <circle cx="12" cy="12" r="9"></circle>
        </svg>
    `,
    info: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 10v6"></path>
            <path d="M12 7h.01"></path>
        </svg>
    `
};

const toastTitles = {
    success: 'Éxito',
    error: 'Error',
    info: 'Info'
};

let toastIdCounter = 0;
const toastEntries = new Map();

const ensureToastHost = () => {
    let host = document.getElementById('toastHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'toastHost';
        host.className = 'toast-container';
        host.setAttribute('aria-live', 'polite');
        host.setAttribute('aria-atomic', 'false');
        document.body.appendChild(host);
    }

    return host;
};

const removeToast = (toastId) => {
    const entry = toastEntries.get(toastId);
    if (!entry) {
        return;
    }

    window.clearTimeout(entry.timerId);
    entry.element.classList.remove('is-visible');

    window.setTimeout(() => {
        entry.element.remove();
        toastEntries.delete(toastId);
    }, 220);
};

const syncToastStack = () => {
    const host = ensureToastHost();
    const visibleToasts = [...host.children];

    while (visibleToasts.length > 4) {
        const oldest = visibleToasts.shift();
        const toastId = oldest?.dataset.toastId;
        if (toastId && toastEntries.has(toastId)) {
            removeToast(toastId);
        }
    }
};

const showBugaToast = (options = {}) => {
    const type = ['success', 'error', 'info'].includes(options.type) ? options.type : 'info';
    const title = options.title || toastTitles[type];
    const message = options.message || '';
    const duration = Number.isFinite(options.duration) ? options.duration : 3600;
    const key = options.key || `${type}:${title}:${message}`;
    const host = ensureToastHost();

    for (const [toastId, entry] of toastEntries.entries()) {
        if (entry.key === key) {
            window.clearTimeout(entry.timerId);
            entry.element.classList.add('is-visible');
            entry.element.querySelector('.toast-title').textContent = title;
            entry.element.querySelector('.toast-message').textContent = message;
            entry.timerId = window.setTimeout(() => removeToast(toastId), duration);
            return entry.element;
        }
    }

    const toastId = `toast-${++toastIdCounter}`;
    const toast = document.createElement('article');
    toast.className = `toast-card toast-${type}`;
    toast.dataset.toastId = toastId;
    toast.innerHTML = `
        <div class="toast-glyph" aria-hidden="true">${toastIcons[type]}</div>
        <div class="toast-copy">
            <strong class="toast-title">${title}</strong>
            <p class="toast-message">${message}</p>
        </div>
        <button class="toast-close" type="button" aria-label="Cerrar notificación">×</button>
        <span class="toast-progress"></span>
    `;

    toast.querySelector('.toast-close')?.addEventListener('click', () => removeToast(toastId));
    host.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('is-visible');
    });

    const progressBar = toast.querySelector('.toast-progress');
    if (progressBar) {
      progressBar.style.animationDuration = `${duration}ms`;
    }

    const timerId = window.setTimeout(() => removeToast(toastId), duration);
    toastEntries.set(toastId, { element: toast, timerId, key });
    syncToastStack();

    return toast;
};

const pushToastFlash = (payload) => {
    sessionStorage.setItem(TOAST_FLASH_KEY, JSON.stringify(payload));
};

const consumeToastFlash = () => {
    try {
        const payload = JSON.parse(sessionStorage.getItem(TOAST_FLASH_KEY) || 'null');
        sessionStorage.removeItem(TOAST_FLASH_KEY);
        return payload;
    } catch {
        sessionStorage.removeItem(TOAST_FLASH_KEY);
        return null;
    }
};

const getAuthSession = () => {
    try {
        return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    } catch {
        return null;
    }
};

const setAuthSession = (session) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

const clearAuthSession = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
};

const getAuthToken = () => getAuthSession()?.token || '';

const getActiveProfile = () => {
    try {
        return JSON.parse(localStorage.getItem(ACTIVE_PROFILE_KEY) || 'null');
    } catch {
        return null;
    }
};

const setActiveProfile = (profile) => {
    localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
};

const clearActiveProfile = () => {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
};

const getProfileStorageKey = (baseKey) => {
    const session = getAuthSession();
    const profile = getActiveProfile();
    const userScope = session?.user?.id || session?.user?._id || 'guest';
    const profileScope = profile?.id || 'global';
    return `${baseKey}:${userScope}:${profileScope}`;
};

const preferenceEventCooldowns = new Map();

const recordPreferenceEvent = async (payload = {}) => {
    const session = getAuthSession();
    const profile = getActiveProfile();

    if (!session?.token || !profile?.id) {
        return null;
    }

    const movie = payload.movie || {};
    const movieId = Number(payload.movieId ?? movie.id);
    if (!Number.isFinite(movieId)) {
        return null;
    }

    const type = String(payload.type || 'view').trim();
    const cooldownKey = `${profile.id}:${type}:${movieId}`;
    const isWatchEvent = type === 'watch';
    const cooldownWindow = isWatchEvent ? 15000 : 0;
    const previousSync = preferenceEventCooldowns.get(cooldownKey) || 0;

    if (!payload.force && cooldownWindow > 0 && Date.now() - previousSync < cooldownWindow) {
        return null;
    }

    preferenceEventCooldowns.set(cooldownKey, Date.now());

    try {
        const response = await authFetch('/api/recommendations/events', {
            method: 'POST',
            body: JSON.stringify({
                profileId: profile.id,
                type,
                movieId,
                action: payload.action,
                progress: payload.progress,
                currentTime: payload.currentTime,
                duration: payload.duration,
                runtime: payload.runtime,
                ended: Boolean(payload.ended),
                movie: {
                    id: movieId,
                    title: movie.title || payload.title || '',
                    poster: movie.poster || payload.poster || '',
                    backdrop: movie.backdrop || payload.backdrop || '',
                    genres: Array.isArray(movie.genres) ? movie.genres : Array.isArray(payload.genres) ? payload.genres : [],
                    release_date: movie.release_date || payload.release_date || '',
                    runtime: movie.runtime || payload.runtime || 0
                }
            })
        });

        const data = await readResponseData(response);
        if (!response.ok) {
            throw new Error(data.message || 'No se pudieron guardar las preferencias');
        }

        window.dispatchEvent(new CustomEvent('buga:preferences-updated', {
            detail: {
                profileId: profile.id,
                type,
                movieId,
                data
            }
        }));

        return data;
    } catch (error) {
        console.warn('No se pudo sincronizar preferencias', error);
        return null;
    }
};

const authFetch = (url, options = {}) => {
    const token = getAuthToken();
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

const readResponseData = async (response) => {
    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return {
            message: text
        };
    }
};

const showAuthError = (form, message) => {
    const errorBox = form.querySelector('.auth-error');
    if (errorBox) {
        errorBox.textContent = message;
    }
};

const setLoading = (form, loading) => {
    const button = form.querySelector('button[type="submit"]');
    if (!button) {
        return;
    }

    button.disabled = loading;
    button.textContent = loading ? 'Procesando…' : button.dataset.defaultLabel || button.textContent;
};

const saveSession = (payload) => {
    setAuthSession(payload);
};

const sanitizeName = (name) => String(name || '').trim().split(/\s+/)[0] || 'Perfil';

const createProfileDropdown = (chip) => {
    let dropdown = document.querySelector('.auth-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'auth-dropdown';
        dropdown.hidden = true;
        document.body.appendChild(dropdown);
    }

    const session = getAuthSession();
    const isAdmin = session?.user?.role === 'admin';
    dropdown.innerHTML = `
        <button type="button" data-auth-action="profiles">Seleccionar perfil</button>
        <button type="button" data-auth-action="manage-profiles">Administrar perfiles</button>
        ${isAdmin ? '<button type="button" data-auth-action="admin">Panel de admin</button>' : ''}
        <button type="button" data-auth-action="logout">Cerrar sesión</button>
    `;

    const rect = chip.getBoundingClientRect();
    dropdown.style.top = `${window.scrollY + rect.bottom + 10}px`;
    dropdown.style.left = `${Math.max(12, Math.min(window.innerWidth - 228, window.scrollX + rect.right - 220))}px`;
    dropdown.hidden = false;

    return dropdown;
};

const hideProfileDropdown = () => {
    const dropdown = document.querySelector('.auth-dropdown');
    if (dropdown) {
        dropdown.hidden = true;
    }
};

const updateNavbarAuth = () => {
    const chips = document.querySelectorAll('.profile-chip');
    const session = getAuthSession();
    const activeProfile = getActiveProfile();

    chips.forEach((chip) => {
        chip.classList.add('profile-chip-auth');

        if (!session?.user) {
            chip.innerHTML = `
                <svg class="profile-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="8" r="4"></circle>
                    <path d="M 12 14 A 7 7 0 0 0 5 21 H 19 A 7 7 0 0 0 12 14 Z"></path>
                </svg>
                <span>Ingresar</span>
            `;
            chip.setAttribute('aria-label', 'Iniciar sesión');
            chip.dataset.authState = 'guest';
            chip.onclick = () => {
                window.location.href = '/pages/login.html';
            };
            return;
        }

        const profileLabel = activeProfile?.name || 'Perfiles';
        const profileColor = activeProfile?.themeColor || '#8a4dff';
        const avatarInitial = String(profileLabel || session.user.name || 'P').trim().charAt(0).toUpperCase();
        chip.innerHTML = `
            <span class="profile-badge" style="background:${profileColor}">${avatarInitial}</span>
            <span>${sanitizeName(profileLabel)}</span>
        `;
        chip.setAttribute('aria-label', activeProfile ? `Perfil activo ${activeProfile.name}` : `Elegir perfil de ${session.user.name}`);
        chip.dataset.authState = 'logged';
        chip.onclick = (event) => {
            event.stopPropagation();
            const existing = document.querySelector('.auth-dropdown:not([hidden])');
            if (existing) {
                hideProfileDropdown();
                return;
            }
            createProfileDropdown(chip);
        };
    });
};

const handleLogout = () => {
    clearAuthSession();
    clearActiveProfile();
    hideProfileDropdown();
    updateNavbarAuth();
    window.location.href = '/index.html';
};

const fetchCurrentUser = async () => {
    const session = getAuthSession();
    if (!session?.token) {
        updateNavbarAuth();
        return;
    }

    try {
        const response = await authFetch(`${API_BASE}/me`);
        const data = await readResponseData(response);
        if (!response.ok) {
            throw new Error(data.message || 'Sesión inválida');
        }

        saveSession({ ...session, user: data.user });
    } catch {
        clearAuthSession();
    } finally {
        updateNavbarAuth();
    }
};

const handleAuthForm = async (form) => {
    const mode = form.dataset.authForm;
    const endpoint = mode === 'register' ? '/register' : '/login';
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    showAuthError(form, '');
    setLoading(form, true);

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await readResponseData(response);

        if (!response.ok) {
            throw new Error(data.message || 'No se pudo completar la operación');
        }

        saveSession({ token: data.token, user: data.user });
        pushToastFlash({
            type: 'success',
            title: mode === 'register' ? 'Cuenta creada' : 'Sesión iniciada',
            message: mode === 'register'
                ? 'Tu cuenta premium quedó lista.'
                : 'Bienvenido de vuelta a Buga.'
        });
        window.location.href = '/pages/profiles.html';
    } catch (error) {
        showAuthError(form, error.message || 'Ocurrió un error');
        showBugaToast({
            type: 'error',
            title: 'No se pudo iniciar sesión',
            message: error.message || 'Revisa tus datos e inténtalo de nuevo.'
        });
    } finally {
        setLoading(form, false);
    }
};

const bootstrapForms = () => {
    const forms = document.querySelectorAll('[data-auth-form]');

    forms.forEach((form) => {
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton && !submitButton.dataset.defaultLabel) {
            submitButton.dataset.defaultLabel = submitButton.textContent.trim();
        }

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            handleAuthForm(form);
        });
    });
};

const bootstrapDropdown = () => {
    document.addEventListener('click', (event) => {
        const dropdown = document.querySelector('.auth-dropdown:not([hidden])');
        if (!dropdown) {
            return;
        }

        if (event.target.closest('.profile-chip')) {
            return;
        }

        if (event.target.closest('[data-auth-action="logout"]')) {
            handleLogout();
            return;
        }

        if (event.target.closest('[data-auth-action="profiles"]')) {
            hideProfileDropdown();
            window.location.href = '/pages/profiles.html';
            return;
        }

        if (event.target.closest('[data-auth-action="manage-profiles"]')) {
            hideProfileDropdown();
            window.location.href = '/pages/manage-profiles.html';
            return;
        }

        if (event.target.closest('[data-auth-action="admin"]')) {
            hideProfileDropdown();
            window.location.href = '/pages/admin.html';
            return;
        }

        if (!dropdown.contains(event.target)) {
            hideProfileDropdown();
        }
    });
};

const bootstrapAuthPages = async () => {
    bootstrapForms();
    await fetchCurrentUser();
    bootstrapDropdown();
};

document.addEventListener('DOMContentLoaded', () => {
    updateNavbarAuth();
    (async () => {
        await bootstrapAuthPages();
        const flashToast = consumeToastFlash();
        if (flashToast) {
            showBugaToast(flashToast);
        }
        const hasSession = Boolean(getAuthSession()?.token);
        const isAuthPage = document.body.classList.contains('auth-page');
        const isProfilesPage = document.body.classList.contains('profiles-page');
        const isAdminPage = document.body.classList.contains('admin-page');

        if (hasSession && isAuthPage) {
            window.location.href = '/pages/profiles.html';
            return;
        }

        if (hasSession && !isProfilesPage && !isAdminPage && !getActiveProfile()) {
            window.location.href = '/pages/profiles.html';
        }
    })();
});

window.BugaAuth = {
    getAuthSession,
    getAuthToken,
    setAuthSession,
    clearAuthSession,
    authFetch,
    getActiveProfile,
    setActiveProfile,
    clearActiveProfile,
    getProfileStorageKey,
    recordPreferenceEvent,
    updateNavbarAuth,
    fetchCurrentUser
};

window.BugaToast = {
    show: showBugaToast,
    success: (message, title = 'Éxito', options = {}) => showBugaToast({ ...options, type: 'success', title, message }),
    error: (message, title = 'Error', options = {}) => showBugaToast({ ...options, type: 'error', title, message }),
    info: (message, title = 'Info', options = {}) => showBugaToast({ ...options, type: 'info', title, message })
};
