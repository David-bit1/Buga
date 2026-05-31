const ADMIN_API = '/api/admin';

const adminSidebar = document.getElementById('adminSidebar');
const adminLogout = document.getElementById('adminLogout');
const adminRefresh = document.getElementById('adminRefresh');
const pageLoader = document.getElementById('pageLoader');

const adminStats = document.getElementById('adminStats');
const recentUsers = document.getElementById('recentUsers');
const recentMovies = document.getElementById('recentMovies');

const moviesTable = document.getElementById('moviesTable');
const usersTable = document.getElementById('usersTable');
const genresTable = document.getElementById('genresTable');

const movieForm = document.getElementById('movieForm');
const movieId = document.getElementById('movieId');
const movieTmdbId = document.getElementById('movieTmdbId');
const movieTitle = document.getElementById('movieTitle');
const movieOverview = document.getElementById('movieOverview');
const moviePoster = document.getElementById('moviePoster');
const movieBackdrop = document.getElementById('movieBackdrop');
const movieReleaseDate = document.getElementById('movieReleaseDate');
const movieRuntime = document.getElementById('movieRuntime');
const movieGenres = document.getElementById('movieGenres');
const movieVideoSource = document.getElementById('movieVideoSource');
const movieUpload = document.getElementById('movieUpload');
const movieFeatured = document.getElementById('movieFeatured');
const movieStatus = document.getElementById('movieStatus');
const movieSubmit = document.getElementById('movieSubmit');
const clearMovieFormButton = document.getElementById('clearMovieForm');

const genreForm = document.getElementById('genreForm');
const genreId = document.getElementById('genreId');
const genreName = document.getElementById('genreName');
const genreTmdbId = document.getElementById('genreTmdbId');
const genreColor = document.getElementById('genreColor');
const genreActive = document.getElementById('genreActive');
const genreDescription = document.getElementById('genreDescription');
const genreSubmit = document.getElementById('genreSubmit');
const clearGenreFormButton = document.getElementById('clearGenreForm');

const settingsForm = document.getElementById('settingsForm');
const settingFeaturedLimit = document.getElementById('settingFeaturedLimit');
const settingTrendingLimit = document.getElementById('settingTrendingLimit');
const settingUserUploads = document.getElementById('settingUserUploads');
const settingTheme = document.getElementById('settingTheme');
const settingAccent = document.getElementById('settingAccent');

let dashboardCache = null;
let moviesCache = [];
let usersCache = [];
let genresCache = [];
let settingsCache = { catalog: {}, ui: {} };

const authFetch = (url, options = {}) => window.BugaAuth?.authFetch?.(url, options) || fetch(url, options);
const notify = (options) => window.BugaToast?.show?.(options);
const authMultipartFetch = (url, formData) => {
    const token = window.BugaAuth?.getAuthToken?.();
    const headers = {};

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
        method: 'POST',
        headers,
        body: formData
    });
};

const requireAdmin = () => {
    const session = window.BugaAuth?.getAuthSession?.();
    if (!session?.token) {
        window.location.href = 'login.html';
        return false;
    }

    if (session.user?.role !== 'admin') {
        window.location.href = 'index.html';
        return false;
    }

    return true;
};

const showLoader = () => {
    document.body.classList.add('is-loading');
    pageLoader?.setAttribute('aria-busy', 'true');
};

const hideLoader = () => {
    document.body.classList.remove('is-loading');
    pageLoader?.setAttribute('aria-busy', 'false');
};

const escapeText = (value) =>
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const slugify = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const setActiveSection = (sectionName) => {
    document.querySelectorAll('[data-admin-section]').forEach((section) => {
        section.classList.toggle('is-active', section.dataset.adminSection === sectionName);
    });

    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.adminTab === sectionName);
    });
};

const renderStats = (stats = {}) => {
    if (!adminStats) {
        return;
    }

    const cards = [
        { label: 'Usuarios', value: stats.users || 0 },
        { label: 'Admins', value: stats.admins || 0 },
        { label: 'Perfiles', value: stats.profiles || 0 },
        { label: 'Películas', value: stats.movies || 0 },
        { label: 'Géneros', value: stats.genres || 0 },
        { label: 'Preferencias', value: stats.preferences || 0 }
    ];

    adminStats.innerHTML = cards.map((item) => `
        <article class="admin-stat">
            <strong>${item.value}</strong>
            <span>${escapeText(item.label)}</span>
        </article>
    `).join('');
};

const renderRecentLists = () => {
    recentUsers.innerHTML = (dashboardCache?.recentUsers || []).map((user) => `
        <div class="admin-list-item">
            <div>
                <strong>${escapeText(user.name)}</strong>
                <p>${escapeText(user.email)}</p>
            </div>
            <span class="admin-pill ${user.role}">${escapeText(user.role)}</span>
        </div>
    `).join('') || '<p class="admin-empty">Sin usuarios recientes.</p>';

    recentMovies.innerHTML = (dashboardCache?.recentMovies || []).map((movie) => `
        <div class="admin-list-item">
            <div>
                <strong>${escapeText(movie.title)}</strong>
                <p>TMDB ${escapeText(movie.tmdbId)}</p>
            </div>
            <span class="admin-pill ${movie.status}">${escapeText(movie.status)}</span>
        </div>
    `).join('') || '<p class="admin-empty">Sin películas recientes.</p>';
};

const renderMoviesTable = () => {
    if (!moviesTable) {
        return;
    }

    moviesTable.innerHTML = moviesCache.map((movie) => `
        <tr>
            <td>
                <strong>${escapeText(movie.title)}</strong>
                <div class="admin-small">${escapeText(movie.genres?.map((genre) => genre.name).join(' • ') || 'Sin géneros')}</div>
            </td>
            <td>${escapeText(movie.tmdbId)}</td>
            <td><span class="admin-pill ${movie.status}">${escapeText(movie.status)}</span></td>
            <td>
                <div class="admin-row-actions">
                    <button class="admin-secondary" type="button" data-edit-movie="${movie.id}">Editar</button>
                    <button class="admin-secondary" type="button" data-delete-movie="${movie.id}">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4">No hay películas cargadas.</td></tr>';
};

const renderUsersTable = () => {
    if (!usersTable) {
        return;
    }

    usersTable.innerHTML = usersCache.map((user) => `
        <tr>
            <td>${escapeText(user.name)}</td>
            <td>${escapeText(user.email)}</td>
            <td>
                <select data-user-role="${user.id}">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>user</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
                </select>
            </td>
            <td>
                <div class="admin-row-actions">
                    <button class="admin-secondary" type="button" data-save-user="${user.id}">Guardar</button>
                    <button class="admin-secondary" type="button" data-delete-user="${user.id}">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4">No hay usuarios disponibles.</td></tr>';
};

const renderGenresTable = () => {
    if (!genresTable) {
        return;
    }

    genresTable.innerHTML = genresCache.map((genre) => `
        <tr>
            <td><strong>${escapeText(genre.name)}</strong></td>
            <td>${escapeText(genre.slug)}</td>
            <td><span class="admin-pill ${genre.active ? 'published' : 'inactive'}">${genre.active ? 'active' : 'inactive'}</span></td>
            <td>
                <div class="admin-row-actions">
                    <button class="admin-secondary" type="button" data-edit-genre="${genre.id}">Editar</button>
                    <button class="admin-secondary" type="button" data-delete-genre="${genre.id}">Eliminar</button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4">No hay géneros creados.</td></tr>';
};

const fetchJson = async (url, options = {}) => {
    const response = await authFetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || 'La operación no pudo completarse');
        error.status = response.status;
        throw error;
    }
    return data;
};

const loadDashboard = async () => {
    const data = await fetchJson(`${ADMIN_API}/dashboard`);
    dashboardCache = data;
    settingsCache = data.settings || settingsCache;
    renderStats(data.stats);
    renderRecentLists();
    if (settingFeaturedLimit) settingFeaturedLimit.value = settingsCache.catalog?.featuredLimit || 10;
    if (settingTrendingLimit) settingTrendingLimit.value = settingsCache.catalog?.trendingLimit || 8;
    if (settingUserUploads) settingUserUploads.checked = Boolean(settingsCache.catalog?.allowUserUploads);
    if (settingTheme) settingTheme.value = settingsCache.ui?.theme || 'morado-negro';
    if (settingAccent) settingAccent.value = settingsCache.ui?.accent || '#8a4dff';
};

const loadMovies = async () => {
    const data = await fetchJson(`${ADMIN_API}/movies`);
    moviesCache = data.movies || [];
    renderMoviesTable();
};

const loadUsers = async () => {
    const data = await fetchJson(`${ADMIN_API}/users`);
    usersCache = data.users || [];
    renderUsersTable();
};

const loadGenres = async () => {
    const data = await fetchJson(`${ADMIN_API}/genres`);
    genresCache = data.genres || [];
    renderGenresTable();
};

const loadSettings = async () => {
    const data = await fetchJson(`${ADMIN_API}/settings`);
    settingsCache = data.settings || settingsCache;
};

const refreshAll = async () => {
    showLoader();
    try {
        await Promise.all([loadDashboard(), loadMovies(), loadUsers(), loadGenres(), loadSettings()]);
        notify({ type: 'success', title: 'Panel actualizado', message: 'Toda la información fue recargada.' });
    } catch (error) {
        console.warn(error);
        notify({ type: 'error', title: 'No se pudo actualizar', message: error.message || 'Revisa la conexión.' });
    } finally {
        hideLoader();
    }
};

const resetMovieForm = () => {
    movieId.value = '';
    movieTmdbId.value = '';
    movieTitle.value = '';
    movieOverview.value = '';
    moviePoster.value = '';
    movieBackdrop.value = '';
    movieReleaseDate.value = '';
    movieRuntime.value = '';
    movieGenres.value = '';
    movieVideoSource.value = '';
    if (movieUpload) {
        movieUpload.value = '';
    }
    movieFeatured.checked = false;
    movieStatus.value = 'published';
    movieSubmit.textContent = 'Guardar película';
};

const resetGenreForm = () => {
    genreId.value = '';
    genreName.value = '';
    genreTmdbId.value = '';
    genreColor.value = '#8a4dff';
    genreActive.value = 'true';
    genreDescription.value = '';
    genreSubmit.textContent = 'Guardar género';
};

const fillMovieForm = (movie) => {
    movieId.value = movie.id;
    movieTmdbId.value = movie.tmdbId || '';
    movieTitle.value = movie.title || '';
    movieOverview.value = movie.overview || '';
    moviePoster.value = movie.poster || '';
    movieBackdrop.value = movie.backdrop || '';
    movieReleaseDate.value = movie.releaseDate || '';
    movieRuntime.value = movie.runtime || '';
    movieGenres.value = Array.isArray(movie.genres) ? movie.genres.map((genre) => genre.name).join(', ') : '';
    movieVideoSource.value = movie.videoSource || '';
    if (movieUpload) {
        movieUpload.value = '';
    }
    movieFeatured.checked = Boolean(movie.featured);
    movieStatus.value = movie.status || 'published';
    movieSubmit.textContent = 'Actualizar película';
};

const fillGenreForm = (genre) => {
    genreId.value = genre.id;
    genreName.value = genre.name || '';
    genreTmdbId.value = genre.tmdbId || '';
    genreColor.value = genre.color || '#8a4dff';
    genreActive.value = String(Boolean(genre.active));
    genreDescription.value = genre.description || '';
    genreSubmit.textContent = 'Actualizar género';
};

const parseGenres = (value) =>
    String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((name, index) => ({
            id: index + 1,
            name
        }));

const handleMovieSubmit = async (event) => {
    event.preventDefault();

    const payload = {
        tmdbId: Number(movieTmdbId.value),
        title: movieTitle.value.trim(),
        overview: movieOverview.value.trim(),
        poster: moviePoster.value.trim(),
        backdrop: movieBackdrop.value.trim(),
        releaseDate: movieReleaseDate.value.trim(),
        runtime: Number(movieRuntime.value || 0),
        genres: parseGenres(movieGenres.value),
        videoSource: movieVideoSource.value.trim(),
        featured: Boolean(movieFeatured.checked),
        status: movieStatus.value
    };

    if (!payload.tmdbId || !payload.title) {
        notify({ type: 'error', title: 'Campos obligatorios', message: 'TMDB ID y título son requeridos.' });
        return;
    }

    try {
        const isEditing = Boolean(movieId.value);
        if (movieUpload?.files?.[0]) {
            const formData = new FormData();
            Object.entries(payload).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    formData.append(key, value.map((item) => item.name).join(', '));
                    return;
                }

                formData.append(key, value);
            });
            if (isEditing) {
                formData.append('movieId', movieId.value);
            }
            formData.append('video', movieUpload.files[0]);

            const response = await authMultipartFetch('/api/videos/upload', formData);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'No se pudo procesar el video');
            }
        } else {
            await fetchJson(`${ADMIN_API}/movies${isEditing ? `/${movieId.value}` : ''}`, {
                method: isEditing ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
        }
        notify({ type: 'success', title: isEditing ? 'Película actualizada' : 'Película creada', message: payload.title });
        resetMovieForm();
        await loadMovies();
        await loadDashboard();
    } catch (error) {
        notify({ type: 'error', title: 'No se pudo guardar', message: error.message || 'Intenta de nuevo.' });
    }
};

const handleGenreSubmit = async (event) => {
    event.preventDefault();

    const payload = {
        tmdbId: genreTmdbId.value ? Number(genreTmdbId.value) : null,
        name: genreName.value.trim(),
        color: genreColor.value,
        description: genreDescription.value.trim(),
        active: genreActive.value === 'true'
    };

    if (!payload.name) {
        notify({ type: 'error', title: 'Nombre requerido', message: 'Escribe un nombre para el género.' });
        return;
    }

    try {
        const isEditing = Boolean(genreId.value);
        await fetchJson(`${ADMIN_API}/genres${isEditing ? `/${genreId.value}` : ''}`, {
            method: isEditing ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
        });
        notify({ type: 'success', title: isEditing ? 'Género actualizado' : 'Género creado', message: payload.name });
        resetGenreForm();
        await loadGenres();
        await loadDashboard();
    } catch (error) {
        notify({ type: 'error', title: 'No se pudo guardar', message: error.message || 'Intenta de nuevo.' });
    }
};

const handleSettingsSubmit = async (event) => {
    event.preventDefault();

    const payload = {
        catalog: {
            featuredLimit: Number(settingFeaturedLimit.value || 10),
            trendingLimit: Number(settingTrendingLimit.value || 8),
            allowUserUploads: Boolean(settingUserUploads.checked)
        },
        ui: {
            theme: settingTheme.value.trim(),
            accent: settingAccent.value
        }
    };

    try {
        await fetchJson(`${ADMIN_API}/settings`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        notify({ type: 'success', title: 'Configuración guardada', message: 'Los ajustes quedaron actualizados.' });
    } catch (error) {
        notify({ type: 'error', title: 'No se pudo guardar', message: error.message || 'Intenta de nuevo.' });
    }
};

const handleTableActions = async (event) => {
    const editMovie = event.target.closest('[data-edit-movie]');
    const deleteMovie = event.target.closest('[data-delete-movie]');
    const saveUser = event.target.closest('[data-save-user]');
    const deleteUser = event.target.closest('[data-delete-user]');
    const editGenre = event.target.closest('[data-edit-genre]');
    const deleteGenre = event.target.closest('[data-delete-genre]');

    try {
        if (editMovie) {
            const movie = moviesCache.find((item) => String(item.id) === editMovie.dataset.editMovie);
            if (movie) fillMovieForm(movie);
        }

        if (deleteMovie) {
            await fetchJson(`${ADMIN_API}/movies/${deleteMovie.dataset.deleteMovie}`, { method: 'DELETE' });
            notify({ type: 'success', title: 'Película eliminada', message: 'Se quitó del catálogo.' });
            await loadMovies();
            await loadDashboard();
        }

        if (saveUser) {
            const userId = saveUser.dataset.saveUser;
            const roleSelect = document.querySelector(`[data-user-role="${userId}"]`);
            const role = roleSelect?.value || 'user';
            await fetchJson(`${ADMIN_API}/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ role })
            });
            notify({ type: 'success', title: 'Usuario actualizado', message: 'El rol se guardó correctamente.' });
            await loadUsers();
            await loadDashboard();
        }

        if (deleteUser) {
            if (!window.confirm('¿Eliminar este usuario?')) {
                return;
            }
            await fetchJson(`${ADMIN_API}/users/${deleteUser.dataset.deleteUser}`, { method: 'DELETE' });
            notify({ type: 'success', title: 'Usuario eliminado', message: 'Se retiró del sistema.' });
            await loadUsers();
            await loadDashboard();
        }

        if (editGenre) {
            const genre = genresCache.find((item) => String(item.id) === editGenre.dataset.editGenre);
            if (genre) fillGenreForm(genre);
        }

        if (deleteGenre) {
            await fetchJson(`${ADMIN_API}/genres/${deleteGenre.dataset.deleteGenre}`, { method: 'DELETE' });
            notify({ type: 'success', title: 'Género eliminado', message: 'Se retiró del catálogo.' });
            await loadGenres();
            await loadDashboard();
        }
    } catch (error) {
        notify({ type: 'error', title: 'Operación fallida', message: error.message || 'Revisa tu conexión.' });
    }
};

const bootstrap = async () => {
    if (!requireAdmin()) {
        return;
    }

    setActiveSection('dashboard');

    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
        button.addEventListener('click', () => setActiveSection(button.dataset.adminTab));
    });

    adminRefresh?.addEventListener('click', refreshAll);
    adminLogout?.addEventListener('click', () => {
        window.BugaAuth?.clearAuthSession?.();
        window.BugaAuth?.clearActiveProfile?.();
        window.location.href = 'login.html';
    });

    movieForm?.addEventListener('submit', handleMovieSubmit);
    genreForm?.addEventListener('submit', handleGenreSubmit);
    settingsForm?.addEventListener('submit', handleSettingsSubmit);
    clearMovieFormButton?.addEventListener('click', resetMovieForm);
    clearGenreFormButton?.addEventListener('click', resetGenreForm);

    moviesTable?.addEventListener('click', handleTableActions);
    usersTable?.addEventListener('click', handleTableActions);
    genresTable?.addEventListener('click', handleTableActions);

    resetMovieForm();
    resetGenreForm();
    await refreshAll();
};

document.addEventListener('DOMContentLoaded', bootstrap);
