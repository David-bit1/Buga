(function () {
const UPLOAD_SHARED = window.BugaShared;
const MOVIES_API = UPLOAD_SHARED.API_BASES.movies;
const uploadForm = document.getElementById('movieUploadForm');
const movieIdInput = document.getElementById('movieId');
const movieTitle = document.getElementById('movieTitle');
const movieDescription = document.getElementById('movieDescription');
const movieGenres = document.getElementById('movieGenres');
const movieYear = document.getElementById('movieYear');
const movieDuration = document.getElementById('movieDuration');
const movieClassification = document.getElementById('movieClassification');
const movieStatus = document.getElementById('movieStatus');
const movieFeatured = document.getElementById('movieFeatured');
const moviePoster = document.getElementById('moviePoster');
const movieBanner = document.getElementById('movieBanner');
const movieVideo = document.getElementById('movieVideo');
const posterMeta = document.getElementById('posterMeta');
const bannerMeta = document.getElementById('bannerMeta');
const videoMeta = document.getElementById('videoMeta');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const progressBox = document.querySelector('.upload-progress');
const movieTable = document.getElementById('moviesTable');
const clearFormButton = document.getElementById('clearForm');
const refreshMoviesButton = document.getElementById('refreshMovies');
const movieSubmit = document.getElementById('movieSubmit');
const formTitle = document.getElementById('formTitle');
const dropzones = document.querySelectorAll('.upload-dropzone');
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
            ...authHeaders()
        }
    }), UPLOAD_SHARED.REQUEST_TIMEOUT_MS, `upload movies ${options.method || 'GET'}`);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || 'La operación no pudo completarse');
    }

    return data;
};

const getFileMetaText = (file, fallback) => file ? file.name : fallback;

const updateDropzoneState = (input, metaElement, fallbackText) => {
    const dropzone = input.closest('.upload-dropzone');
    if (!dropzone) {
        return;
    }

    const hasFile = Boolean(input.files?.[0]);
    dropzone.classList.toggle('has-file', hasFile);
    metaElement.textContent = getFileMetaText(input.files?.[0], fallbackText);
};

const bindDropzone = (input, metaElement, fallbackText) => {
    const dropzone = input.closest('.upload-dropzone');
    if (!dropzone) {
        return;
    }

    dropzone.addEventListener('click', () => input.click());

    ['dragenter', 'dragover'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropzone.classList.add('is-dragover');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            dropzone.classList.remove('is-dragover');
        });
    });

    dropzone.addEventListener('drop', (event) => {
        const file = event.dataTransfer?.files?.[0];
        if (file) {
            input.files = event.dataTransfer.files;
            updateDropzoneState(input, metaElement, fallbackText);
        }
    });

    input.addEventListener('change', () => updateDropzoneState(input, metaElement, fallbackText));
};

const resetProgress = () => {
    if (progressBar) {
        progressBar.style.width = '0%';
    }

    if (progressLabel) {
        progressLabel.textContent = '0%';
    }

    if (progressBox) {
        progressBox.hidden = true;
    }
};

const fillForm = (movie) => {
    movieIdInput.value = movie?.id || '';
    movieTitle.value = movie?.title || '';
    movieDescription.value = movie?.description || '';
    movieGenres.value = Array.isArray(movie?.genres) ? movie.genres.join(', ') : '';
    movieYear.value = movie?.year || '';
    movieDuration.value = movie?.duration || '';
    movieClassification.value = movie?.classification || 'PG-13';
    movieStatus.value = movie?.status || 'published';
    movieFeatured.checked = Boolean(movie?.featured);
    moviePoster.value = '';
    movieBanner.value = '';
    movieVideo.value = '';
    posterMeta.textContent = movie?.posterPath ? `Actual: ${movie.posterPath}` : 'PNG/JPG recomendado';
    bannerMeta.textContent = movie?.bannerPath ? `Actual: ${movie.bannerPath}` : 'Imagen panorámica';
    videoMeta.textContent = movie?.videoPath ? `Actual: ${movie.videoPath}` : 'MP4 / MOV / WEBM';
    formTitle.textContent = movie ? 'Editar película' : 'Nueva película';
    movieSubmit.textContent = movie ? 'Actualizar película' : 'Subir película';
    resetProgress();
};

const clearForm = () => {
    fillForm(null);
    uploadForm?.reset();
    movieIdInput.value = '';
    posterMeta.textContent = 'PNG/JPG recomendado';
    bannerMeta.textContent = 'Imagen panorámica';
    videoMeta.textContent = 'MP4 / MOV / WEBM';
    dropzones.forEach((zone) => zone.classList.remove('has-file', 'is-dragover'));
    resetProgress();
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
                <td>${movie.year || '—'}</td>
                <td>${Array.isArray(movie.genres) ? movie.genres.join(' • ') : '—'}</td>
                <td><span class="admin-pill ${movie.status || 'published'}">${movie.status || 'published'}</span></td>
                <td>
                    <div class="admin-row-actions">
                        <button class="admin-secondary" type="button" data-edit-movie="${movie.id}">Editar</button>
                        <button class="admin-secondary" type="button" data-delete-movie="${movie.id}">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="5">Todavía no hay películas subidas.</td></tr>';
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

const submitViaXHR = (formData, movieId) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const endpoint = movieId ? `${MOVIES_API}/${movieId}` : `${MOVIES_API}/upload`;
    xhr.open(movieId ? 'PUT' : 'POST', endpoint);

    const token = window.BugaAuth?.getAuthToken?.();
    if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) {
            return;
        }

        const percent = Math.round((event.loaded / event.total) * 100);
        if (progressBox) {
            progressBox.hidden = false;
        }
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        if (progressLabel) {
            progressLabel.textContent = `${percent}%`;
        }
    });

    xhr.addEventListener('load', () => {
        let data = {};
        try {
            data = JSON.parse(xhr.responseText || '{}');
        } catch {
            data = {};
        }

        if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
            return;
        }

        reject(new Error(data.message || 'No se pudo subir la película'));
    });

    xhr.addEventListener('error', () => reject(new Error('Error de red al subir la película')));
    xhr.addEventListener('abort', () => reject(new Error('La subida fue cancelada')));
    xhr.send(formData);
});

const handleSubmit = async (event) => {
    event.preventDefault();

    const movieId = movieIdInput.value.trim();
    const title = movieTitle.value.trim();
    const description = movieDescription.value.trim();
    const genres = movieGenres.value.trim();
    const year = movieYear.value.trim();
    const duration = movieDuration.value.trim();
    const classification = movieClassification.value;

    if (!title || !description || !genres || !year || !duration || !classification) {
        notify({
            type: 'error',
            title: 'Campos obligatorios',
            message: 'Completa título, descripción, géneros, año, duración y clasificación.'
        });
        return;
    }

    const isEditing = Boolean(movieId);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('genres', genres);
    formData.append('year', year);
    formData.append('duration', duration);
    formData.append('classification', classification);
    formData.append('status', movieStatus.value);
    formData.append('featured', movieFeatured.checked ? 'true' : 'false');

    if (moviePoster.files?.[0]) {
        formData.append('poster', moviePoster.files[0]);
    }

    if (movieBanner.files?.[0]) {
        formData.append('banner', movieBanner.files[0]);
    }

    if (movieVideo.files?.[0]) {
        formData.append('video', movieVideo.files[0]);
    }

    if (!isEditing && (!moviePoster.files?.[0] || !movieBanner.files?.[0] || !movieVideo.files?.[0])) {
        notify({
            type: 'error',
            title: 'Archivos incompletos',
            message: 'Debes seleccionar poster, banner y video para crear una nueva película.'
        });
        return;
    }

    movieSubmit.disabled = true;
    movieSubmit.textContent = isEditing ? 'Actualizando...' : 'Subiendo...';
    if (progressBox) {
        progressBox.hidden = false;
    }

    try {
        await submitViaXHR(formData, movieId || null);
        notify({
            type: 'success',
            title: isEditing ? 'Película actualizada' : 'Película subida',
            message: title
        });
        clearForm();
        await loadMovies();
    } catch (error) {
        notify({
            type: 'error',
            title: 'No se pudo subir',
            message: error.message || 'Intenta nuevamente.'
        });
    } finally {
        movieSubmit.disabled = false;
        movieSubmit.textContent = movieId ? 'Actualizar película' : 'Subir película';
        setTimeout(() => {
            if (!movieIdInput.value) {
                resetProgress();
            }
        }, 800);
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
            notify({
                type: 'success',
                title: 'Película eliminada',
                message: movie.title
            });
            await loadMovies();
        } catch (error) {
            notify({
                type: 'error',
                title: 'No se pudo eliminar',
                message: error.message || 'Intenta nuevamente.'
            });
        }
    }
};

const bootstrap = async () => {
    if (!requireAdmin()) {
        return;
    }

    bindDropzone(moviePoster, posterMeta, 'PNG/JPG recomendado');
    bindDropzone(movieBanner, bannerMeta, 'Imagen panorámica');
    bindDropzone(movieVideo, videoMeta, 'MP4 / MOV / WEBM');

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
