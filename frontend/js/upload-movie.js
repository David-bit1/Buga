(function () {
const UPLOAD_SHARED = window.BugaShared;
const MOVIES_API = UPLOAD_SHARED.API_BASES.movies;
const uploadForm = document.getElementById('movieUploadForm');
const movieIdInput = document.getElementById('movieId');
const movieTmdbId = document.getElementById('movieTmdbId');
const movieTitle = document.getElementById('movieTitle');
const movieDescription = document.getElementById('movieDescription');
const movieGenres = document.getElementById('movieGenres');
const movieYear = document.getElementById('movieYear');
const movieDuration = document.getElementById('movieDuration');
const movieStatus = document.getElementById('movieStatus');
const movieFeatured = document.getElementById('movieFeatured');
const moviePosterUrl = document.getElementById('moviePosterUrl');
const movieBannerUrl = document.getElementById('movieBannerUrl');
const moviePosterFile = document.getElementById('moviePosterFile');
const movieBannerFile = document.getElementById('movieBannerFile');
const useTmdbImages = document.getElementById('useTmdbImages');
const serverRows = document.getElementById('serverRows');
const addServerButton = document.getElementById('addServerButton');
const movieTable = document.getElementById('moviesTable');
const clearFormButton = document.getElementById('clearForm');
const refreshMoviesButton = document.getElementById('refreshMovies');
const movieSubmit = document.getElementById('movieSubmit');
const formTitle = document.getElementById('formTitle');
const pageLoader = document.getElementById('pageLoader');

let moviesCache = [];

const notify = (options) => window.BugaToast?.show?.(options);

const requireAdmin = () => {
    const session = window.BugaAuth?.getAuthSession?.();
    if (!session?.token) {
        window.location.href = '/pages/login.html';
        return false;
    }

    if (session.user?.role !== 'admin') {
        window.location.href = '/index.html';
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

const authHeaders = () => {
    const token = window.BugaAuth?.getAuthToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const fetchJson = async (url, options = {}) => {
    const response = await UPLOAD_SHARED.requestWithTimeout(fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            ...authHeaders(),
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
        }
    }), UPLOAD_SHARED.REQUEST_TIMEOUT_MS, `upload movies ${options.method || 'GET'}`);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'La operación no pudo completarse');
    }

    return data;
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) {
        resolve('');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
});

const createServerRow = (name = '', url = '') => {
    const row = document.createElement('div');
    row.className = 'admin-server-row';
    row.innerHTML = `
        <label><span>Nombre</span><input type="text" class="server-name" placeholder="Servidor 1" value="${name}"></label>
        <label><span>Enlace</span><input type="url" class="server-url" placeholder="https://..." value="${url}"></label>
        <button class="admin-secondary" type="button">Eliminar</button>
    `;

    row.querySelector('button').addEventListener('click', () => {
        row.remove();
        if (!serverRows?.querySelector('.admin-server-row')) {
            createServerRow('Servidor 1', '');
        }
    });

    serverRows?.appendChild(row);
};

const resetServerRows = (sources = []) => {
    if (!serverRows) {
        return;
    }

    serverRows.innerHTML = '';
    const fallbackSources = sources.length ? sources : [{ name: 'Servidor 1', url: '' }];
    fallbackSources.forEach((source) => createServerRow(source.name || 'Servidor 1', source.url || ''));
};

const getServerRows = () => {
    if (!serverRows) {
        return [];
    }

    return Array.from(serverRows.querySelectorAll('.admin-server-row'))
        .map((row) => ({
            name: row.querySelector('.server-name')?.value?.trim() || '',
            url: row.querySelector('.server-url')?.value?.trim() || ''
        }))
        .filter((server) => server.name && server.url);
};

const fillForm = (movie) => {
    movieIdInput.value = movie?.id || '';
    movieTmdbId.value = movie?.tmdb_id || movie?.tmdbId || '';
    movieTitle.value = movie?.title || '';
    movieDescription.value = movie?.description || movie?.overview || '';
    movieGenres.value = Array.isArray(movie?.genres) ? movie.genres.map((item) => typeof item === 'string' ? item : item.name || '').filter(Boolean).join(', ') : '';
    movieYear.value = movie?.release_year || movie?.year || '';
    movieDuration.value = movie?.runtime || movie?.duration || '';
    movieStatus.value = movie?.status || 'published';
    movieFeatured.checked = Boolean(movie?.featured);
    moviePosterUrl.value = movie?.poster_url || '';
    movieBannerUrl.value = movie?.banner_url || '';
    moviePosterFile.value = '';
    movieBannerFile.value = '';
    useTmdbImages.checked = Boolean(movie?.useTmdbImages ?? true);
    resetServerRows(Array.isArray(movie?.playback_sources) ? movie.playback_sources : (movie?.video_url ? [{ name: 'Servidor 1', url: movie.video_url }] : []));
    formTitle.textContent = movie ? 'Editar película' : 'Nueva película';
    movieSubmit.textContent = movie ? 'Actualizar película' : 'Guardar película';
};

const clearForm = () => {
    uploadForm?.reset();
    movieIdInput.value = '';
    movieTmdbId.value = '';
    moviePosterUrl.value = '';
    movieBannerUrl.value = '';
    moviePosterFile.value = '';
    movieBannerFile.value = '';
    useTmdbImages.checked = true;
    resetServerRows([{ name: 'Servidor 1', url: '' }]);
    formTitle.textContent = 'Nueva película';
    movieSubmit.textContent = 'Guardar película';
};

const renderMovies = () => {
    if (!movieTable) {
        return;
    }

    movieTable.innerHTML = moviesCache.length
        ? moviesCache.map((movie) => `
            <tr>
                <td>
                    <strong>${movie.title}</strong>
                    <div class="admin-small">${movie.description ? movie.description.slice(0, 70) : 'Sin descripción'}</div>
                </td>
                <td>${movie.release_year || movie.year || '—'}</td>
                <td>${Array.isArray(movie.playback_sources) ? movie.playback_sources.length : 0}</td>
                <td><span class="admin-pill ${movie.status || 'published'}">${movie.status || 'published'}</span></td>
                <td>
                    <div class="admin-row-actions">
                        <button class="admin-secondary" type="button" data-edit-movie="${movie.id}">Editar</button>
                        <button class="admin-secondary" type="button" data-delete-movie="${movie.id}">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="5">Todavía no hay películas guardadas.</td></tr>';
};

const loadMovies = async () => {
    showLoader();
    try {
        const data = await fetchJson(MOVIES_API);
        moviesCache = Array.isArray(data.movies) ? data.movies : [];
        renderMovies();
    } catch (error) {
        notify({
            type: 'error',
            title: 'No se pudo cargar la biblioteca',
            message: error.message || 'Revisa la conexión con el backend.'
        });
    } finally {
        hideLoader();
    }
};

const autoFillFromTmdb = async () => {
    const tmdbId = movieTmdbId.value.trim();
    if (!tmdbId) {
        return;
    }

    try {
        const response = await fetch(`${MOVIES_API}/tmdb/${encodeURIComponent(tmdbId)}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.movie) {
            return;
        }

        const movie = data.movie;
        if (!movieTitle.value.trim()) {
            movieTitle.value = movie.title || '';
        }
        if (!movieDescription.value.trim()) {
            movieDescription.value = movie.description || '';
        }
        if (!movieGenres.value.trim()) {
            movieGenres.value = Array.isArray(movie.genres) ? movie.genres.join(', ') : '';
        }
        if (!movieYear.value) {
            movieYear.value = movie.release_year || '';
        }
        if (!movieDuration.value) {
            movieDuration.value = movie.runtime || '';
        }
        if (!moviePosterUrl.value && movie.poster_url) {
            moviePosterUrl.value = movie.poster_url;
        }
        if (!movieBannerUrl.value && movie.banner_url) {
            movieBannerUrl.value = movie.banner_url;
        }
        notify({
            type: 'info',
            title: 'Datos de TMDb cargados',
            message: movie.title || 'La información se completó automáticamente.'
        });
    } catch (error) {
        console.warn('TMDb autofill failed', error);
    }
};

const handleSubmit = async (event) => {
    event.preventDefault();

    const movieId = movieIdInput.value.trim();
    const title = movieTitle.value.trim();
    const description = movieDescription.value.trim();
    const genres = movieGenres.value.trim();
    const year = movieYear.value.trim();
    const duration = movieDuration.value.trim();
    const playbackSources = getServerRows();

    if (!title) {
        notify({ type: 'error', title: 'Título obligatorio', message: 'Ingresa un título o usa el ID de TMDb.' });
        return;
    }

    if (!playbackSources.length) {
        notify({ type: 'error', title: 'Sin enlaces', message: 'Agrega al menos un enlace de reproducción.' });
        return;
    }

    movieSubmit.disabled = true;
    movieSubmit.textContent = movieId ? 'Actualizando...' : 'Guardando...';

    try {
        const [posterDataUrl, bannerDataUrl] = await Promise.all([
            readFileAsDataUrl(moviePosterFile.files?.[0]),
            readFileAsDataUrl(movieBannerFile.files?.[0])
        ]);

        const payload = {
            tmdbId: movieTmdbId.value ? Number(movieTmdbId.value) : null,
            title,
            description,
            genres,
            release_year: year || null,
            runtime: duration || null,
            poster_url: moviePosterUrl.value.trim() || (posterDataUrl ? posterDataUrl : ''),
            banner_url: movieBannerUrl.value.trim() || (bannerDataUrl ? bannerDataUrl : ''),
            playback_sources: playbackSources,
            featured: movieFeatured.checked,
            status: movieStatus.value,
            useTmdbImages: Boolean(useTmdbImages.checked)
        };

        const endpoint = movieId ? `${MOVIES_API}/${movieId}` : MOVIES_API;
        const method = movieId ? 'PUT' : 'POST';
        await fetchJson(endpoint, {
            method,
            body: JSON.stringify(payload)
        });

        notify({
            type: 'success',
            title: movieId ? 'Película actualizada' : 'Película guardada',
            message: title
        });
        clearForm();
        await loadMovies();
    } catch (error) {
        notify({ type: 'error', title: 'No se pudo guardar', message: error.message || 'Intenta nuevamente.' });
    } finally {
        movieSubmit.disabled = false;
        movieSubmit.textContent = movieId ? 'Actualizar película' : 'Guardar película';
    }
};

const handleTableAction = async (event) => {
    const editButton = event.target.closest('[data-edit-movie]');
    const deleteButton = event.target.closest('[data-delete-movie]');

    if (editButton) {
        const movie = moviesCache.find((item) => item.id === editButton.dataset.editMovie);
        if (!movie) {
            return;
        }

        fillForm(movie);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (deleteButton) {
        const movieId = deleteButton.dataset.deleteMovie;
        const movie = moviesCache.find((item) => item.id === movieId);
        if (!movie) {
            return;
        }

        if (!window.confirm(`¿Eliminar "${movie.title}"?`)) {
            return;
        }

        try {
            await fetchJson(`${MOVIES_API}/${movieId}`, { method: 'DELETE' });
            notify({ type: 'success', title: 'Película eliminada', message: movie.title });
            await loadMovies();
        } catch (error) {
            notify({ type: 'error', title: 'No se pudo eliminar', message: error.message || 'Intenta nuevamente.' });
        }
    }
};

const bootstrap = async () => {
    if (!requireAdmin()) {
        return;
    }

    clearForm();
    movieTmdbId?.addEventListener('blur', autoFillFromTmdb);
    addServerButton?.addEventListener('click', () => createServerRow('Servidor 2', ''));
    uploadForm?.addEventListener('submit', handleSubmit);
    movieTable?.addEventListener('click', handleTableAction);
    clearFormButton?.addEventListener('click', clearForm);
    refreshMoviesButton?.addEventListener('click', loadMovies);

    showLoader();
    await loadMovies();
    hideLoader();
};

bootstrap();
})();
