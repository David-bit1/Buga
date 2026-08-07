(function () {
const UPLOAD_SHARED = window.BugaShared;
const MOVIES_API = '/api/movies';
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
const movieOriginalTitle = document.getElementById('movieOriginalTitle');
const movieCountry = document.getElementById('movieCountry');
const movieLanguage = document.getElementById('movieLanguage');
const movieRating = document.getElementById('movieRating');
const movieCast = document.getElementById('movieCast');
const movieDirector = document.getElementById('movieDirector');
const movieTrailer = document.getElementById('movieTrailer');
const movieOverview = document.getElementById('movieOverview');
const movieReleaseDate = document.getElementById('movieReleaseDate');
const moviePopularity = document.getElementById('moviePopularity');
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
const createServerRow = (name = '', type = 'iframe', url = '', status = 'active', order = 0) => {
    const row = document.createElement('div');
    row.className = 'admin-server-row';
    row.innerHTML = `
        <label><span>Nombre</span><input type="text" class="server-name" placeholder="Servidor 1" value="${name}"></label>
        <label><span>Tipo</span><select class="server-type">
            <option value="iframe" ${type === 'iframe' ? 'selected' : ''}>iframe</option>
            <option value="embed" ${type === 'embed' ? 'selected' : ''}>embed</option>
            <option value="m3u8" ${type === 'm3u8' ? 'selected' : ''}>m3u8</option>
            <option value="mp4" ${type === 'mp4' ? 'selected' : ''}>mp4</option>
        </select></label>
        <label><span>Enlace/Código</span><input type="text" class="server-url" placeholder="https://..." value="${url}"></label>
        <label><span>Estado</span><select class="server-status">
            <option value="active" ${status === 'active' ? 'selected' : ''}>Activo</option>
            <option value="inactive" ${status === 'inactive' ? 'selected' : ''}>Inactivo</option>
        </select></label>
        <label><span>Orden</span><input type="number" class="server-order" value="${order}" min="0"></label>
        <button class="admin-secondary" type="button">Eliminar</button>
    `;

    row.querySelector('button').addEventListener('click', () => {
        row.remove();
        if (!serverRows?.querySelector('.admin-server-row')) {
            createServerRow('Servidor 1', 'iframe', '', 'active', 0);
        }
    });

    serverRows?.appendChild(row);
};

const resetServerRows = (servers = []) => {
    if (!serverRows) {
        return;
    }

    serverRows.innerHTML = '';
    const fallbackSources = servers.length ? servers : [{ name: 'Servidor 1', type: 'iframe', url: '', status: 'active', order: 0 }];
    fallbackSources.forEach((source) => {
        const row = document.createElement('div');
        row.className = 'admin-server-row';
        row.innerHTML = `
            <label><span>Nombre</span><input type="text" class="server-name" placeholder="Servidor 1" value="${source.name || ''}"></label>
            <label><span>Tipo</span><select class="server-type">
                <option value="iframe" ${source.type === 'iframe' ? 'selected' : ''}>iframe</option>
                <option value="embed" ${source.type === 'embed' ? 'selected' : ''}>embed</option>
                <option value="m3u8" ${source.type === 'm3u8' ? 'selected' : ''}>m3u8</option>
                <option value="mp4" ${source.type === 'mp4' ? 'selected' : ''}>mp4</option>
            </select></label>
            <label><span>Enlace/Código</span><input type="text" class="server-url" placeholder="https://... o código iframe" value="${source.url || ''}"></label>
            <label><span>Estado</span><select class="server-status">
                <option value="active" ${source.status === 'active' ? 'selected' : ''}>Activo</option>
                <option value="inactive" ${source.status === 'inactive' ? 'selected' : ''}>Inactivo</option>
            </select></label>
            <label><span>Orden</span><input type="number" class="server-order" value="${source.order || 0}" min="0"></label>
            <button class="admin-secondary" type="button">Eliminar</button>
        `;
        
        // Add remove button functionality
        const removeBtn = row.querySelector('.admin-secondary');
        removeBtn.addEventListener('click', () => {
            row.remove();
            // Ensure at least one server row remains
            if (serverRows.querySelectorAll('.admin-server-row').length === 0) {
                resetServerRows([{ name: 'Servidor 1', type: 'iframe', url: '', status: 'active', order: 0 }]);
            }
        });
        
        serverRows.appendChild(row);
    });
};

const getServerRows = () => {
    if (!serverRows) {
        return [];
    }

    return Array.from(serverRows.querySelectorAll('.admin-server-row'))
        .map((row) => ({
            name: row.querySelector('.server-name')?.value?.trim() || '',
            type: row.querySelector('.server-type')?.value || 'iframe',
            url: row.querySelector('.server-url')?.value?.trim() || '',
            status: row.querySelector('.server-status')?.value || 'active',
            order: parseInt(row.querySelector('.server-order')?.value) || 0
        }))
        .filter((server) => server.name && server.url);
};

const fillForm = (movie) => {
    movieIdInput.value = movie?.id || '';
    movieTmdbId.value = movie?.tmdb_id || movie?.tmdbId || '';
    movieTitle.value = movie?.title || '';
    movieDescription.value = movie?.description || movie?.overview || '';
    movieOriginalTitle.value = movie?.original_title || '';
    movieGenres.value = Array.isArray(movie?.genres) ? movie.genres.map((item) => typeof item === 'string' ? item : item.name || '').filter(Boolean).join(', ') : '';
    movieYear.value = movie?.release_year || movie?.year || '';
    movieDuration.value = movie?.runtime || movie?.duration || '';
    movieCountry.value = movie?.country || '';
    movieLanguage.value = movie?.language || '';
    movieRating.value = movie?.rating || '';
    movieCast.value = Array.isArray(movie?.cast) ? movie.cast.map((item) => typeof item === 'string' ? item : item.name || '').filter(Boolean).join(', ') : '';
    movieDirector.value = movie?.director || '';
    movieTrailer.value = movie?.trailer || '';
    movieOverview.value = movie?.overview || '';
    movieReleaseDate.value = movie?.release_date || '';
    moviePopularity.value = movie?.popularity || '';
    moviePosterUrl.value = movie?.poster_url || '';
    movieBannerUrl.value = movie?.banner_url || '';
    movieFeatured.checked = Boolean(movie?.featured);
    resetServerRows(Array.isArray(movie?.servers) ? movie.servers : []);
    formTitle.textContent = movie ? 'Editar película' : 'Nueva película';
    movieSubmit.textContent = movie ? 'Actualizar película' : 'Guardar película';
};

const clearForm = () => {
    uploadForm?.reset();
    movieIdInput.value = '';
    movieTmdbId.value = '';
    movieTitle.value = '';
    movieDescription.value = '';
    movieOriginalTitle.value = '';
    movieGenres.value = '';
    movieYear.value = '';
    movieDuration.value = '';
    movieCountry.value = '';
    movieLanguage.value = '';
    movieRating.value = '';
    movieCast.value = '';
    movieDirector.value = '';
    movieTrailer.value = '';
    movieOverview.value = '';
    movieReleaseDate.value = '';
    moviePopularity.value = '';
    moviePosterUrl.value = '';
    movieBannerUrl.value = '';
    movieFeatured.checked = false;
    resetServerRows([{ name: 'Servidor 1', type: 'iframe', url: '', status: 'active', order: 0 }]);
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
                <td>${movie.release_year || '—'}</td>
                <td>${Array.isArray(movie.servers) ? movie.servers.length : 0}</td>
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

    const originalButtonText = movieSubmit.textContent;
    movieSubmit.disabled = true;
    movieSubmit.textContent = 'Buscando película...';

    try {
        notify({ type: 'info', title: 'Buscando película...', message: `Consultando TMDb para ID ${tmdbId}` });

        // Usamos fetchJson para incluir las cabeceras de autenticación
        const data = await fetchJson(`/api/movies/tmdb/${encodeURIComponent(tmdbId)}`);

        // La API devuelve { movie: ... }
        const movie = data.movie;

        if (!movie || !(movie.tmdb_id || movie.id)) {
            notify({ type: 'error', title: 'Película no encontrada', message: `No se encontró película con ID ${tmdbId} en TMDb.` });
            return;
        }

        // Sobrescribimos los campos con los datos de TMDb
        if (movieTitle) movieTitle.value = movie.title || '';
        if (movieOriginalTitle) movieOriginalTitle.value = movie.original_title || '';
        if (movieOverview) movieOverview.value = movie.overview || '';
        if (movieDescription) movieDescription.value = movie.description || movie.overview || '';
        if (movieYear) movieYear.value = movie.release_year || '';
        if (movieDuration) movieDuration.value = movie.runtime || '';
        if (movieReleaseDate) movieReleaseDate.value = movie.release_date || '';
        if (movieCountry) movieCountry.value = movie.country || '';
        if (movieLanguage) movieLanguage.value = movie.language || '';
        if (movieRating) movieRating.value = movie.rating || '';
        if (movieCast) movieCast.value = Array.isArray(movie.cast) ? movie.cast.join(', ') : '';
        if (movieDirector) movieDirector.value = movie.director || '';
        if (movieTrailer) movieTrailer.value = movie.trailer || '';
        if (moviePopularity) moviePopularity.value = movie.popularity || '';
        if (moviePosterUrl) moviePosterUrl.value = movie.poster_url || '';
        if (movieBannerUrl) movieBannerUrl.value = movie.banner_url || '';
        if (movieGenres && Array.isArray(movie.genres)) movieGenres.value = movie.genres.map(g => g.name || g).join(', ');

        notify({
            type: 'success',
            title: 'Película encontrada',
            message: movie.title || 'La información se completó automáticamente.'
        });
    } catch (error) {
        console.warn('TMDb autofill failed', error);
        notify({ type: 'error', title: 'Error al autocompletar', message: error.message || 'No se pudo obtener la información.' });
    } finally {
        movieSubmit.disabled = false;
        movieSubmit.textContent = originalButtonText;
    }
};

const handleSubmit = async (event) => {
    event.preventDefault();

    // Collect server data from the form
    const serverRowsElements = serverRows.querySelectorAll('.admin-server-row');
    const servers = [];
    
    serverRowsElements.forEach((row, index) => {
        const nameInput = row.querySelector('.server-name');
        const typeSelect = row.querySelector('.server-type');
        const urlInput = row.querySelector('.server-url');
        const statusSelect = row.querySelector('.server-status');
        const orderInput = row.querySelector('.server-order');
        
        if (nameInput && typeSelect && urlInput && statusSelect && orderInput) {
            const name = nameInput.value.trim();
            const type = typeSelect.value;
            const url = urlInput.value.trim();
            const status = statusSelect.value;
            const order = parseInt(orderInput.value) || 0;
            
            // Only add server if it has a name and URL
            if (name && url) {
                servers.push({
                    name: name,
                    type: type,
                    url: url,
                    status: status,
                    order: order
                });
            }
        }
    });

    const payload = {
        tmdbId: movieTmdbId.value ? Number(movieTmdbId.value) : null,
        title: movieTitle.value.trim(),
        original_title: movieOriginalTitle.value.trim(),
        description: movieDescription.value.trim(),
        overview: movieOverview.value.trim(),
        poster_url: moviePosterUrl.value.trim(),
        banner_url: movieBannerUrl.value.trim(),
        release_year: movieYear.value ? Number(movieYear.value) : 0,
        runtime: movieDuration.value ? Number(movieDuration.value) : 0,
        country: movieCountry.value.trim(),
        language: movieLanguage.value.trim(),
        genres: movieGenres.value.trim().split(',').map(g => g.trim()).filter(g => g.length > 0),
        rating: movieRating.value.trim(),
        cast: movieCast.value.trim().split(',').map(c => c.trim()).filter(c => c.length > 0),
        director: movieDirector.value.trim(),
        trailer: movieTrailer.value.trim(),
        servers: servers,
        featured: movieFeatured.checked,
        status: movieStatus.value,
        popularity: moviePopularity.value ? parseFloat(moviePopularity.value) : 0
    };

    if (!payload.title) {
        notify({ type: 'error', title: 'Título obligatorio', message: 'Ingresa un título o usa el ID de TMDb.' });
        return;
    }

    if (servers.length === 0) {
        notify({ type: 'error', title: 'Sin servidores', message: 'Agrega al menos un servidor de reproducción.' });
        return;
    }

    movieSubmit.disabled = true;
    movieSubmit.textContent = movieIdInput.value ? 'Actualizando...' : 'Guardando...';

    try {
        const endpoint = movieIdInput.value ? `${MOVIES_API}/${movieIdInput.value}` : MOVIES_API;
        const method = movieIdInput.value ? 'PUT' : 'POST';
        await fetchJson(endpoint, {
            method,
            body: JSON.stringify(payload)
        });

        notify({
            type: 'success',
            title: movieIdInput.value ? 'Película actualizada' : 'Película guardada',
            message: movieTitle.value.trim()
        });
        clearForm();
        await loadMovies();
    } catch (error) {
        notify({ type: 'error', title: 'No se pudo guardar', message: error.message || 'Intenta nuevamente.' });
    } finally {
        movieSubmit.disabled = false;
        movieSubmit.textContent = movieIdInput.value ? 'Actualizar película' : 'Guardar película';
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
    movieTmdbId?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Evita que el formulario se envíe por error
            autoFillFromTmdb();
        }
    });

    addServerButton?.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'admin-server-row';
        row.innerHTML = `
            <label><span>Nombre</span><input type="text" class="server-name" placeholder="Servidor 1" value="Servidor 1"></label>
            <label><span>Tipo</span><select class="server-type">
                <option value="iframe">iframe</option>
                <option value="embed">embed</option>
                <option value="m3u8">m3u8</option>
                <option value="mp4">mp4</option>
            </select></label>
            <label><span>Enlace/Código</span><input type="text" class="server-url" placeholder="https://... o código iframe"></label>
            <label><span>Estado</span><select class="server-status">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
            </select></label>
            <label><span>Orden</span><input type="number" class="server-order" value="0" min="0"></label>
            <button class="admin-secondary" type="button">Eliminar</button>
        `;
        
        // Add remove button functionality
        const removeBtn = row.querySelector('.admin-secondary');
        removeBtn.addEventListener('click', () => {
            row.remove();
            // Ensure at least one server row remains
            if (serverRows.querySelectorAll('.admin-server-row').length === 0) {
                addServerButton.click();
            }
        });
        
        serverRows.appendChild(row);
    });
    uploadForm?.addEventListener('submit', handleSubmit);
    movieTable?.addEventListener('click', handleTableAction);
    clearFormButton?.addEventListener('click', clearForm);

    showLoader();
    await loadMovies();
    hideLoader();
};

bootstrap();
})();
