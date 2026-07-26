(function () {
const MOVIE_SHARED = window.BugaShared;

const movieHero = document.getElementById('movieHero');
const movieBackdrop = document.getElementById('movieBackdrop');
const moviePoster = document.getElementById('moviePoster');
const movieTitle = document.getElementById('movieTitle');
const movieTagline = document.getElementById('movieTagline');
const movieMeta = document.getElementById('movieMeta');
const movieDescription = document.getElementById('movieDescription');
const movieGenre = document.getElementById('movieGenre');
const movieYear = document.getElementById('movieYear');
const movieRuntime = document.getElementById('movieRuntime');
const favoriteButton = document.getElementById('favoriteButton');
const playButton = document.getElementById('playButton');
const backLink = document.querySelector('.movie-back-link');
const movieVideo = document.getElementById('movieVideo');
const externalPlayer = document.getElementById('externalPlayer');
const serverSelect = document.getElementById('serverSelect');
const moviePageLoader = document.getElementById('moviePageLoader');
const playerLoader = document.getElementById('playerLoader');
const playerStage = document.querySelector('.player-stage');
const overlayPlayButton = document.getElementById('overlayPlayButton');
const playPauseButton = document.getElementById('playPauseButton');
const playPauseIcon = document.getElementById('playPauseIcon');
const muteButton = document.getElementById('muteButton');
const muteIconButton = document.getElementById('muteIconButton');
const muteIcon = document.getElementById('muteIcon');
const captionsButton = document.getElementById('captionsButton');
const fullscreenButton = document.getElementById('fullscreenButton');
const progressInput = document.getElementById('progressInput');
const volumeInput = document.getElementById('volumeInput');
const currentTimeLabel = document.getElementById('currentTime');
const durationTimeLabel = document.getElementById('durationTime');
const playerStatus = document.getElementById('playerStatus');
const qualitySelect = document.getElementById('qualitySelect');
const volumeIndicator = document.getElementById('volumeIcon');
const notifyToast = (options) => {
    if (window.BugaToast?.show) {
        return window.BugaToast.show(options);
    }

    return null;
};

// --- Global Error Handlers ---
window.addEventListener('error', (event) => {
    console.error('Global Error:', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
});

// --- Utility and Session Functions (Hoisted to top) ---

const getAuthSession = () => {
    try {
        // Replicate auth logic locally as BugaAuth is not available on this page.
        return JSON.parse(localStorage.getItem('Buga-auth') || 'null');
    } catch {
        return null;
    }
};

const getScopedStorageKey = (baseKey) => {
    // Replicate profile-scoped key generation locally
    const session = getAuthSession();
    const userScope = session?.user?.id || 'guest';
    // movie.js does not have profile context, so we use a global scope for the user
    return `${baseKey}:${userScope}:global`;
};

const MOVIE_FAVORITES_KEY = getScopedStorageKey(MOVIE_SHARED.STORAGE_KEYS.FAVORITES);
const WATCH_HISTORY_KEY = getScopedStorageKey(MOVIE_SHARED.STORAGE_KEYS.WATCH_HISTORY);

const syncPreferenceEvent = (payload) => { 
    window.BugaAuth?.recordPreferenceEvent?.(payload);
};

const getAuthToken = () => getAuthSession()?.token || '';

const fetchAuthJson = async (url) => {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${getAuthToken()}`
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || 'No se pudo cargar el stream');
        error.status = response.status;
        throw error;
    }
    return data;
};

const buildTokenizedUrl = (url, token) => {
    if (!url) {
        return '';
    }

    return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
};

const params = new URLSearchParams(window.location.search);
const movieId = params.get('id');
const mediaType = params.get('type') === 'tv' ? 'tv' : 'movie';

const mediaLabel = mediaType === 'tv' ? 'Serie' : 'Película';
let currentMovie = null;
let lastWatchSaveAt = 0;
let activePlayerAdapter = null;
const PlayerManager = window.BugaPlayerManager;
const playerState = {
    paused: true,
    muted: false,
    volume: 1,
    controllable: false,
    kind: 'unknown'
};

let uiUpdateInterval = null;
let youtubeApiReady = false;

const formatRuntime = (minutes) => {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return 'Duración no disponible';
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
};

const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '0:00';
    }

    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const parseYear = (value) => (value ? String(value).slice(0, 4) : 'N/A');

const normalizeMovie = (movie) => window.BugaShared.normalizeMovie(movie, mediaType);

const getMovieFavorites = () => {
    try {
        return JSON.parse(localStorage.getItem(MOVIE_FAVORITES_KEY) || '[]');
    } catch {
        return [];
    }
};

const setMovieFavorites = (favorites) => {
    localStorage.setItem(MOVIE_FAVORITES_KEY, JSON.stringify(favorites));
};

const getWatchHistory = () => {
    try {
        return JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
};

const setWatchHistory = (entries) => {
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(entries));
};

const setReady = () => {
    window.requestAnimationFrame(() => {
        document.body.classList.add('is-ready');
    });
};

const hideMoviePageLoader = () => {
    document.body.classList.remove('is-loading');
    if (moviePageLoader) {
        moviePageLoader.setAttribute('aria-busy', 'false');
    }
};

const showPlayerLoader = () => {
    playerLoader?.classList.remove('is-hidden');
};

const hidePlayerLoader = () => {
    playerLoader?.classList.add('is-hidden');
};

const navigateWithTransition = (url) => {
    document.body.classList.add('is-leaving');
    window.setTimeout(() => {
        window.location.href = url;
    }, 180);
};

const updateMeta = (items) => {
    if (!movieMeta) {
        return;
    }

    movieMeta.innerHTML = items.map((item) => `<span class="movie-pill">${item}</span>`).join('');
};

const updateFavoriteState = () => {
    if (!favoriteButton || !currentMovie) {
        return;
    }

    const favorites = getMovieFavorites();
    const isFavorite = favorites.includes(String(currentMovie.id));
    favoriteButton.classList.toggle('is-active', isFavorite);
    favoriteButton.innerHTML = `
        <span class="movie-btn-icon" aria-hidden="true">${isFavorite ? '♥' : '♡'}</span>
        <span>${isFavorite ? 'En favoritos' : 'Agregar a favoritos'}</span>
    `;
    favoriteButton.dataset.favorite = String(isFavorite);
    favoriteButton.setAttribute('aria-pressed', String(isFavorite));
    favoriteButton.setAttribute('aria-label', isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos');
};

const updatePlayerChrome = () => {
    if (!activePlayerAdapter || !playerStage) {
        return;
    }

    const isPaused = playerState.paused;
    const isPlaying = !isPaused;

    playerStage.classList.toggle('is-playing', isPlaying);

    if (playPauseButton) {
        playPauseButton.textContent = isPaused ? 'play_arrow' : 'pause';
    }

    if (overlayPlayButton) {
        overlayPlayButton.hidden = isPlaying;
    }

    if (playerStatus) {
        if (isPaused) {
            playerStatus.textContent = 'Pausado';
        } else {
            playerStatus.textContent = 'Reproduciendo';
        }
    }
};

const updateVolumeChrome = () => {
    if (!activePlayerAdapter) {
        return;
    }

    const isMuted = playerState.muted;
    const volumePercent = Math.round((playerState.volume || 0) * 100);

    if (volumeInput && String(volumeInput.value) !== String(volumePercent)) {
        volumeInput.value = String(volumePercent);
    }

    if (muteIconButton) {
        if (isMuted || volumePercent === 0) {
            muteIconButton.textContent = 'volume_off';
        } else if (volumePercent < 45) {
            muteIconButton.textContent = 'volume_down';
        } else {
            muteIconButton.textContent = 'volume_up';
        }
    }

    if (volumeIndicator) {
        volumeIndicator.textContent = muteIcon?.textContent || '🔊';
    }
};

const updateProgressChrome = () => {
    if (!activePlayerAdapter) {
        return;
    }

    const duration = activePlayerAdapter.getDuration() || 0;
    const currentTime = activePlayerAdapter.getCurrentTime() || 0;

    if (currentTimeLabel) {
        currentTimeLabel.textContent = formatTime(currentTime);
    }

    if (durationTimeLabel) {
        durationTimeLabel.textContent = formatTime(duration);
    }

    if (progressInput && duration > 0 && document.activeElement !== progressInput) {
        progressInput.value = String(Math.round((currentTime / duration) * 1000));
    }
};

const removeFromWatchHistory = (movieMovieId) => {
    const history = getWatchHistory().filter((entry) => Number(entry.id) !== Number(movieMovieId));
    setWatchHistory(history);
};

const saveWatchProgress = (force = false) => {
    if (!activePlayerAdapter || !currentMovie) return;

    const duration = activePlayerAdapter.getDuration();
    if (!Number.isFinite(duration) || duration <= 0) return;

    const currentTime = activePlayerAdapter.getCurrentTime();
    const progress = Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)));

    if (!force && Date.now() - lastWatchSaveAt < 5000) {
        return;
    }

    if (currentTime < 3 && progress < 5) {
        return;
    }

    lastWatchSaveAt = Date.now();

    if (progress >= 95) { // Also considers ended via event
        removeFromWatchHistory(currentMovie.id);
        syncPreferenceEvent({
            type: 'watch',
            movie: currentMovie,
            currentTime,
            duration,
            progress: 100,
            ended: true,
            force: true
        });
        return;
    }

    const entry = {
        id: currentMovie.id,
        title: currentMovie.title,
        poster: currentMovie.poster || MOVIE_SHARED.FALLBACK_POSTER,
        backdrop: currentMovie.backdrop || '',
        description: currentMovie.description || '',
        genres: Array.isArray(currentMovie.genres) ? currentMovie.genres : [],
        year: parseYear(currentMovie.release_date),
        runtime: currentMovie.runtime || 0,
        currentTime,
        duration,
        progress,
        lastViewed: new Date().toISOString()
    };

    const previousHistory = getWatchHistory();
    const isFirstSave = !previousHistory.some((item) => Number(item.id) === Number(currentMovie.id));
    const history = previousHistory.filter((item) => Number(item.id) !== Number(currentMovie.id));
    history.unshift(entry);
    setWatchHistory(history.slice(0, 20));
    syncPreferenceEvent({
        type: 'watch',
        movie: currentMovie,
        currentTime,
        duration,
        progress,
        ended: progress >= 95,
        force
    });

    if (isFirstSave) {
        // notifyToast({
        //     type: 'info',
        //     title: 'Añadida a Continuar viendo',
        //     message: `${currentMovie.title} quedó guardada en tu historial.`,
        //     key: `watch:${currentMovie.id}`
        // });
    }
};

const restoreWatchProgress = () => {
    if (!movieVideo || !currentMovie) {
        return;
    }

    const history = getWatchHistory();
    const savedEntry = history.find((entry) => Number(entry.id) === Number(currentMovie.id));

    if (!activePlayerAdapter || !savedEntry || !Number.isFinite(savedEntry.currentTime) || savedEntry.currentTime <= 0) {
        return;
    }

    const duration = activePlayerAdapter.getDuration() || savedEntry.duration || 0;
    const resumeTime = Math.min(savedEntry.currentTime, Math.max(0, duration - 5));
    if (resumeTime > 0) {
        activePlayerAdapter.seek(resumeTime);
        if (playerStatus) {
            playerStatus.textContent = `Reanudando en ${formatTime(resumeTime)}`;
        }
        updateProgressChrome();
    }
};

const setVideoSource = async (serverIndex) => {
    if (!movieVideo || !currentMovie) {
        return;
    }

    const servers = Array.isArray(currentMovie.servers) ? currentMovie.servers : [];
    const server = servers[serverIndex];

    if (!server || !server.url) {
        console.error("[!] setVideoSource failed: server or URL is invalid.");
        notifyToast({ type: 'error', title: 'Servidor no válido', message: 'El servidor seleccionado no tiene una URL válida.' });
        hidePlayerLoader();
        return;
    }

    clearInterval(uiUpdateInterval);
    uiUpdateInterval = null;
    activePlayerAdapter = null;
    showPlayerLoader();
    playerState.paused = true;
    playerState.muted = false;
    playerState.volume = 1;
    playerState.controllable = false;
    playerState.kind = 'unknown';

    try {
        const adapter = await PlayerManager.create(server, {
            videoElement: movieVideo,
            externalElement,
            playerStage
        });
        activePlayerAdapter = adapter;

        if (!adapter) {
            console.warn('[!] Adapter creation returned null/undefined.');
            hidePlayerLoader();
            if (overlayPlayButton) {
                overlayPlayButton.hidden = true;
            }
            return;
        }

        playerState.controllable = adapter.capabilities?.controllable !== false;
        playerState.kind = adapter.kind || 'unknown';
        if (overlayPlayButton) {
            overlayPlayButton.hidden = !playerState.controllable;
        }
        wireAdapterToUI(adapter);

    } catch (error) {
        console.error("[!] Error in setVideoSource:", error);
        console.error(error.stack);
        notifyToast({ type: 'error', title: 'Error del reproductor', message: 'No se pudo inicializar el reproductor.' });
        hidePlayerLoader();
    }
};

const populateServerSelect = (movie) => {
    if (!serverSelect) {
        return;
    }

    const servers = Array.isArray(movie.servers) ? movie.servers : [];
    if (!servers.length) {
        serverSelect.innerHTML = '';
        serverSelect.hidden = true;
        serverSelect.disabled = true;
        return;
    }

    serverSelect.innerHTML = servers.map((server, index) => {
        const serverName = server.name || `Servidor ${index + 1}`;
        const detected = PlayerManager.detectServerType(server);
        const typeLabel = detected.displayType || String(server.type || 'iframe').toUpperCase();

        return `<option value="${index}">${serverName} (${typeLabel})</option>`;
    }).join('');
    serverSelect.hidden = false;
    serverSelect.disabled = false;
    serverSelect.value = '0';
};

const togglePlayback = async () => {
    if (!activePlayerAdapter || !playerState.controllable) return;

    if (playerState.paused) {
        try {
            await activePlayerAdapter.play();
        } catch (error) {
            console.warn('Playback blocked', error);
        }
    } else {
        activePlayerAdapter.pause();
    }
};

const toggleMute = () => {
    if (!activePlayerAdapter || !playerState.controllable) return;

    const wasMuted = playerState.muted;

    if (wasMuted) {
        activePlayerAdapter.unmute();
    } else {
        activePlayerAdapter.mute();
    }

    if (wasMuted && Number(volumeInput?.value) === 0) {
        activePlayerAdapter.setVolume(0.5);
        if (volumeInput) {
            volumeInput.value = '50';
        }
    }
    updateVolumeChrome();
};

const toggleFullscreen = async () => {
    const target = playerStage || externalPlayer || movieVideo;

    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
        }

        if (target?.requestFullscreen) {
            await target.requestFullscreen();
        }
    } catch (error) {
        console.warn('Fullscreen failed', error);
    }
};

const applyMovie = (movie) => {
    currentMovie = movie;

    document.title = `${movie.title} | Buga`;
    movieTitle.textContent = movie.title;
    movieDescription.textContent = movie.description || 'Descripción no disponible.';
    movieTagline.textContent = movie.tagline || (mediaType === 'tv'
        ? 'Una serie con una estética oscura y elegante.'
        : 'Un clásico con una estética oscura y elegante.');
    moviePoster.src = movie.poster || MOVIE_SHARED.FALLBACK_POSTER;
    moviePoster.alt = `${mediaLabel} de ${movie.title}`;

    const backdropUrl = movie.backdrop || movie.poster;
    if (movieBackdrop) {
        movieBackdrop.style.backgroundImage = backdropUrl
            ? `linear-gradient(180deg, rgba(2, 1, 5, 0.1), rgba(2, 1, 5, 0.82)), url("${backdropUrl}")`
            : 'linear-gradient(180deg, rgba(2, 1, 5, 0.1), rgba(2, 1, 5, 0.82))';
    }

    const year = parseYear(movie.release_date);
    const runtimeLabel = movie.runtime ? formatRuntime(movie.runtime) : 'Duración no disponible';
    const genres = Array.isArray(movie.genres) && movie.genres.length ? movie.genres.map((genre) => genre.name).join(' • ') : (mediaType === 'tv' ? 'Serie' : 'Cine');

    movieYear.textContent = year;
    movieRuntime.textContent = runtimeLabel;
    movieGenre.textContent = genres;

    updateMeta([year, runtimeLabel, genres.split(' • ')[0] || 'Cine']);
    updateFavoriteState();
};

const fetchMovieFromTMDB = async (id) => {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const response = await fetch(`${MOVIE_SHARED.TMDB_BASE_URL}/${endpoint}/${id}?api_key=${MOVIE_SHARED.API_KEY}&language=es-ES`);

    if (!response.ok) {
        throw new Error(`TMDB responded with ${response.status}`);
    }

    return response.json();
};

const handleFavoriteToggle = () => {
    if (!currentMovie) {
        return;
    }

    const favorites = getMovieFavorites();
    const index = favorites.indexOf(currentMovie.id);

    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(currentMovie.id);
    }

    setMovieFavorites(favorites);
    updateFavoriteState();

    notifyToast({
        type: favorites.includes(currentMovie.id) ? 'success' : 'info',
        title: favorites.includes(currentMovie.id) ? 'Agregada a favoritos' : 'Eliminada de favoritos',
        message: favorites.includes(currentMovie.id)
            ? `${currentMovie.title} ya está en tu lista.`
            : `${currentMovie.title} salió de favoritos.`,
        key: `favorite:${currentMovie.id}:${favorites.includes(currentMovie.id) ? 'add' : 'remove'}`
    });

    syncPreferenceEvent({
        type: 'favorite',
        action: favorites.includes(currentMovie.id) ? 'added' : 'removed',
        movie: currentMovie
    });
};

const wireAdapterToUI = (adapter) => {
    const isControllable = adapter?.capabilities?.controllable !== false;

    // Show/hide controls based on adapter type
    [playPauseButton, muteButton, progressInput, volumeInput, currentTimeLabel, durationTimeLabel, qualitySelect].forEach(el => {
        if (el) {
            const controlWrapper = el.closest('.player-control-group') || el;
            controlWrapper.hidden = !isControllable;
        }
    });

    clearInterval(uiUpdateInterval);
    uiUpdateInterval = setInterval(() => {
        updatePlayerChrome();
        updateProgressChrome();
    }, 250);

    // Hide captions button as it's not supported by current adapters
    if (captionsButton) {
        captionsButton.closest('.player-control-group').hidden = true;
    }

    if (!isControllable) {
        adapter.on('loadedmetadata', hidePlayerLoader);
        adapter.on('canplay', hidePlayerLoader);
        adapter.on('error', (event) => {
            hidePlayerLoader();
            console.error('Error de reproducción:', event);
            notifyToast({ type: 'error', title: 'Error de reproducción', message: 'No se pudo cargar el video. Prueba otro servidor.' });
        });
        return;
    }

    adapter.on('loadedmetadata', () => {
        updateProgressChrome();
        restoreWatchProgress();
        hidePlayerLoader();

        // Quality selector logic
        const levels = adapter.getHlsLevels?.();
        if (qualitySelect && levels && levels.length > 1) {
            const options = ['<option value="-1">Auto</option>'];
            options.push(...levels.map((level, index) => `<option value="${index}">${level.height}p</option>`));
            qualitySelect.innerHTML = options.join('');
            qualitySelect.closest('.player-control-group').hidden = false;
        } else if (qualitySelect) {
            qualitySelect.closest('.player-control-group').hidden = true;
        }
    });
    adapter.on('durationchange', updateProgressChrome);
    adapter.on('timeupdate', updateProgressChrome);
    adapter.on('ended', () => { // Keep ended for final save
        playerState.paused = true;
        updatePlayerChrome();
        saveWatchProgress(true);
    });
    adapter.on('pause', () => {
        playerState.paused = true;
        updatePlayerChrome();
    });
    adapter.on('playing', () => {
        playerState.paused = false;
        if (playerStatus) playerStatus.textContent = 'Reproduciendo';
        hidePlayerLoader();
        updatePlayerChrome();
    });
    adapter.on('volumechange', (event = {}) => {
        if (typeof event.volume === 'number') {
            playerState.volume = event.volume;
        }
        if (typeof event.muted === 'boolean') {
            playerState.muted = event.muted;
        }
        updateVolumeChrome();
        updatePlayerChrome();
    });
    adapter.on('waiting', () => {
        if (playerStatus) playerStatus.textContent = 'Cargando...';
        showPlayerLoader();
    });
    adapter.on('canplay', hidePlayerLoader);
    adapter.on('error', (event) => {
        hidePlayerLoader();
        console.error('Error de reproducción:', event);
        notifyToast({ type: 'error', title: 'Error de reproducción', message: 'No se pudo cargar el video. Prueba otro servidor.' });
    });
};

const wirePlayer = () => {
    overlayPlayButton?.addEventListener('click', togglePlayback);
    playPauseButton?.addEventListener('click', togglePlayback);
    muteButton?.addEventListener('click', toggleMute);
    fullscreenButton?.addEventListener('click', toggleFullscreen);

    progressInput?.addEventListener('input', () => {
        if (!activePlayerAdapter) return;
        const duration = activePlayerAdapter.getDuration() || 0;
        if (!duration) {
            return;
        }
        activePlayerAdapter.seek(duration * (Number(progressInput.value) / 1000));
        updateProgressChrome();
    });

    volumeInput?.addEventListener('input', () => {
        if (!activePlayerAdapter) return;
        activePlayerAdapter.setVolume(Number(volumeInput.value) / 100);
        if (Number(volumeInput.value) === 0) activePlayerAdapter.mute();
        else activePlayerAdapter.unmute();
        updateVolumeChrome();
    });

    serverSelect?.addEventListener('change', async () => {
        if (!currentMovie) {
            return;
        }
        const selectedIndex = parseInt(serverSelect.value, 10);
        if (!isNaN(selectedIndex)) {
            await setVideoSource(selectedIndex);
        }
    });

    qualitySelect?.addEventListener('change', async () => {
        if (!currentMovie) {
            return;
        }
        if (activePlayerAdapter && typeof activePlayerAdapter.setHlsLevel === 'function') {
            const levelIndex = parseInt(qualitySelect.value, 10);
            activePlayerAdapter.setHlsLevel(levelIndex);

            try {
                await activePlayerAdapter.play();
            } catch {
                // Autoplay can be blocked, which is fine.
            }
        }
    });

    playerStage?.addEventListener('click', (e) => {
        if (playerState.controllable && (e.target === playerStage || e.target === overlayPlayButton)) togglePlayback();
    });

    playerStage?.addEventListener('dblclick', toggleFullscreen);

    document.addEventListener('fullscreenchange', () => {
        if (playerStage) {
            playerStage.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement));
        }
    });
};

const fetchLocalMovie = async (id) => {
    try {
        // First try local DB ID endpoint (/api/movies/:movieId)
        let response = await fetch(`/api/movies/${encodeURIComponent(id)}`);
        let data = await response.json().catch(() => ({}));
        if (response.ok && data.movie) {
            console.log('[Buga] Movie found via local ID endpoint');
            return data.movie;
        }

        // Fallback: try TMDB ID endpoint (/api/movies/tmdb/:tmdbId)
        response = await fetch(`/api/movies/tmdb/${encodeURIComponent(id)}`);
        data = await response.json().catch(() => ({}));
        if (response.ok && data.movie) {
            console.log('[Buga] Movie found via TMDB ID endpoint');
            return data.movie;
        }

        return null;
    } catch (error) {
        console.warn('Local movie fetch failed', error);
        return null;
    }
};

const handleLoadError = (errorMessage) => {
    hideMoviePageLoader();
    movieTitle.textContent = 'Contenido no disponible';
    movieDescription.textContent = errorMessage || 'La película o serie que buscas no se encuentra o no está disponible.';
    notifyToast({
        type: 'error',
        title: 'Error al cargar',
        message: errorMessage || 'No se pudo obtener la información del contenido.'
    });
};

const bootstrap = async () => {
    setReady();
    wirePlayer();

    if (backLink) {
        backLink.addEventListener('click', (event) => {
            event.preventDefault();
            navigateWithTransition('/index.html');
        });
    }

    playButton?.addEventListener('click', () => {
        playerStage?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        togglePlayback();
    });

    favoriteButton?.addEventListener('click', handleFavoriteToggle);
    window.addEventListener('beforeunload', () => saveWatchProgress(true));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveWatchProgress(true);
        }
    });

    if (!movieId) {
        console.error('[Buga] Invalid movieId from URL:', movieId);
        movieTitle.textContent = mediaType === 'tv' ? 'Serie no encontrada' : 'Película no encontrada';
        movieDescription.textContent = 'El ID proporcionado no es válido.';
        updateMeta(['N/A', 'N/A', mediaType === 'tv' ? 'Serie' : 'Cine']);
        updateFavoriteState();
        hideMoviePageLoader();
        return;
    }

    let loaderHidden = false;
    const safeHideMovieLoader = () => {
        if (!loaderHidden) {
            loaderHidden = true;
            hideMoviePageLoader();
        }
    };

    try {
        console.log(`[1] URL recibida. ID: ${movieId}, Tipo: ${mediaType}`);

        const localMovie = await fetchLocalMovie(movieId);
        let movie;

        if (localMovie) {
            console.log('[Buga] Película encontrada en la base de datos local.');
            movie = normalizeMovie(localMovie);
        } else {
            console.warn('[Buga] Película no encontrada en la base de datos local. Intentando con TMDb...');
            const tmdbMovie = await fetchMovieFromTMDB(movieId).catch(err => {
                console.error('[Buga] Fallo al buscar en TMDb:', err);
                return null;
            });
            if (!tmdbMovie) {
                handleLoadError('No se encontró la película en la base de datos local ni en TMDb.');
                return;
            }
            movie = normalizeMovie(tmdbMovie);
        }

        console.log('[2] Movie cargada:', movie);

        applyMovie(movie);
        console.log('[3] Renderizando banner y metadata');

        syncPreferenceEvent({
            type: 'view',
            movie
        });
        populateServerSelect(movie);

        if (volumeInput) {
            volumeInput.value = '100';
        }

        updateProgressChrome();
        updateVolumeChrome();
        updatePlayerChrome();

        console.log('[4] Renderizando descripción y UI del reproductor');

        if (movie.servers && movie.servers.length > 0) {
            console.log('[4.1] Movie has servers, ANTES await setVideoSource');
            await setVideoSource(0);
        } else {
            console.warn('[Buga] Movie has no servers');
            hidePlayerLoader();
        }
        console.log('[7] Ocultando loader');
        safeHideMovieLoader();

        if (params.get('autoplay') === '1') {
            try {
                if (activePlayerAdapter) await activePlayerAdapter.play();
            } catch (error) {
                console.warn('Autoplay blocked', error);
            }
        }
        console.log('[8] Loader ocultado. Proceso finalizado.');
    } catch (error) {
        console.error('Error fatal en bootstrap de película:', error);
        console.trace(error);
        handleLoadError(error.message);
    } finally {
        // Aseguramos que el loader se oculte incluso si hay un error no capturado.
        if (!loaderHidden) {
            console.warn('[Buga] Loader was not hidden, hiding in finally block.');
        }
        safeHideMovieLoader();
    }
};

bootstrap();
})();
