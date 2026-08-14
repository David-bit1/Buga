(function () {
const MOVIE_SHARED = window.BugaShared;

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

const getScopedStorageKey = (baseKey) => (
    window.BugaShared?.getProfileStorageKey
        ? window.BugaShared.getProfileStorageKey(baseKey)
        : baseKey
);

const getLegacyScopedStorageKey = (baseKey) => {
    const session = getAuthSession();
    const userScope = session?.user?.id || 'guest';
    return `${baseKey}:${userScope}:global`;
};

const MOVIE_FAVORITES_KEY = getScopedStorageKey(MOVIE_SHARED.STORAGE_KEYS.FAVORITES);
const WATCH_HISTORY_KEY = getScopedStorageKey(MOVIE_SHARED.STORAGE_KEYS.WATCH_HISTORY);

const syncPreferenceEvent = (payload) => { 
    window.BugaAuth?.recordPreferenceEvent?.(payload);
};

const params = new URLSearchParams(window.location.search);
const movieId = params.get('id');
const mediaType = params.get('type') === 'tv' ? 'tv' : 'movie';

const mediaLabel = mediaType === 'tv' ? 'Serie' : 'Película';
let currentMovie = null;
let lastWatchSaveAt = 0;
let activePlayerAdapter = null;
let activeServerSelection = null;
let activePlayerCapabilities = {
    play: false,
    pause: false,
    seek: false,
    volume: false,
    mute: false,
    fullscreen: false,
    quality: false,
    subtitles: false
};
const playerState = {
    paused: true,
    muted: false,
    volume: 1,
    controllable: false,
    kind: 'unknown'
};

let uiUpdateInterval = null;

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
        const storedFavorites = JSON.parse(localStorage.getItem(MOVIE_FAVORITES_KEY) || '[]');
        const normalizedFavorites = window.BugaShared?.normalizeIdList?.(storedFavorites) || [];
        if (normalizedFavorites.length > 0) {
            return normalizedFavorites;
        }

        const legacyFavorites = JSON.parse(localStorage.getItem(getLegacyScopedStorageKey(MOVIE_SHARED.STORAGE_KEYS.FAVORITES)) || '[]');
        const normalizedLegacyFavorites = window.BugaShared?.normalizeIdList?.(legacyFavorites) || [];
        if (normalizedLegacyFavorites.length > 0) {
            localStorage.setItem(MOVIE_FAVORITES_KEY, JSON.stringify(normalizedLegacyFavorites));
            return normalizedLegacyFavorites;
        }

        return [];
    } catch {
        return [];
    }
};

const setMovieFavorites = (favorites) => {
    const normalizedFavorites = window.BugaShared?.normalizeIdList?.(favorites) || [];
    localStorage.setItem(MOVIE_FAVORITES_KEY, JSON.stringify(normalizedFavorites));
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
    console.log('ENTER hidePlayerLoader');
    playerLoader?.classList.add('is-hidden');
};

const debugGetControlsVisibility = () => ({
    playPause: playPauseButton ? !playPauseButton.hidden : null,
    overlayPlay: overlayPlayButton ? !overlayPlayButton.hidden : null,
    mute: muteButton ? !muteButton.hidden : null,
    fullscreen: fullscreenButton ? !fullscreenButton.hidden : null,
    captions: captionsButton ? !captionsButton.hidden : null,
    quality: qualitySelect ? !qualitySelect.hidden : null,
    progress: progressInput ? !progressInput.closest('.progress-bar')?.hidden : null,
    volume: volumeInput ? !volumeInput.closest('.volume-control')?.hidden : null,
    time: currentTimeLabel ? !currentTimeLabel.closest('.player-time')?.hidden : null
});

const debugCollectRuntimeState = (label = 'snapshot') => {
    const snapshot = {
        label,
        currentMovieTitle: currentMovie?.title || null,
        currentMovieServers: Array.isArray(currentMovie?.servers) ? currentMovie.servers : null,
        serverSelected: activeServerSelection ? {
            index: activeServerSelection.index,
            name: activeServerSelection.server?.name || null,
            kind: activeServerSelection.server?.kind || null,
            type: activeServerSelection.server?.type || null,
            url: activeServerSelection.server?.url || null
        } : null,
        detectedType: activePlayerAdapter?.server ? window.BugaPlayerManager?.detectServerType?.(activePlayerAdapter.server)?.kind : null,
        adapterSelected: activePlayerAdapter?.adapterId || null,
        adapterCreated: Boolean(activePlayerAdapter),
        capabilities: activePlayerCapabilities,
        controlsVisible: debugGetControlsVisibility(),
        time: activePlayerAdapter?.getCurrentTime ? activePlayerAdapter.getCurrentTime() : null,
        duration: activePlayerAdapter?.getDuration ? activePlayerAdapter.getDuration() : null,
        mute: activePlayerAdapter?.isMuted ? activePlayerAdapter.isMuted() : null,
        playPauseState: playerState.paused ? 'paused' : 'playing'
    };

    console.log('[DEBUG SNAPSHOT]', snapshot);
    return snapshot;
};

const debugRunScenario = async (serverKind) => {
    if (!currentMovie) {
        console.warn('[DEBUG] No hay currentMovie para ejecutar escenario');
        return null;
    }

    const scenarioServers = {
        youtube: {
            name: 'DEBUG YouTube',
            type: 'youtube',
            kind: 'youtube',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        },
        mp4: {
            name: 'DEBUG MP4',
            type: 'mp4',
            kind: 'mp4',
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
        },
        embed: {
            name: 'DEBUG Embed',
            type: 'embed',
            kind: 'embed',
            url: '<iframe src="https://example.com"></iframe>'
        },
        iframe: {
            name: 'DEBUG Iframe',
            type: 'iframe',
            kind: 'iframe',
            url: 'https://example.com'
        }
    };

    const server = scenarioServers[String(serverKind).toLowerCase()];
    if (!server) {
        console.warn('[DEBUG] Escenario desconocido', serverKind);
        return null;
    }

    currentMovie.servers = [server];
    populateServerSelect(currentMovie);
    console.log('[DEBUG] Escenario', { serverKind, server });
    await setVideoSource(0);
    return debugCollectRuntimeState(`scenario:${serverKind}`);
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
        if (playPauseIcon) {
            playPauseIcon.textContent = isPaused ? '▶' : '⏸';
        } else {
            playPauseButton.textContent = isPaused ? '▶' : '⏸';
        }
    }

    if (overlayPlayButton) {
        overlayPlayButton.hidden = !(activePlayerCapabilities.play && activePlayerCapabilities.pause) || isPlaying;
    }

    if (playerStatus) {
        if (isPaused) {
            playerStatus.textContent = 'Pausado';
        } else {
            playerStatus.textContent = 'Reproduciendo';
        }
    }
};

const getAdapterCapabilities = (adapter) => ({
    play: Boolean(adapter?.capabilities?.play),
    pause: Boolean(adapter?.capabilities?.pause),
    seek: Boolean(adapter?.capabilities?.seek),
    volume: Boolean(adapter?.capabilities?.volume),
    mute: Boolean(adapter?.capabilities?.mute),
    fullscreen: Boolean(adapter?.capabilities?.fullscreen),
    quality: Boolean(adapter?.capabilities?.quality),
    subtitles: Boolean(adapter?.capabilities?.subtitles)
});

const resetPlayerChrome = () => {
    activePlayerCapabilities = {
        play: false,
        pause: false,
        seek: false,
        volume: false,
        mute: false,
        fullscreen: false,
        quality: false,
        subtitles: false
    };

    playerState.paused = true;
    playerState.muted = false;
    playerState.volume = 1;
    playerState.controllable = false;
    playerState.kind = 'unknown';

    if (playerStage) {
        playerStage.classList.remove('is-playing', 'is-fullscreen');
    }

    if (playPauseButton) playPauseButton.hidden = true;
    if (overlayPlayButton) overlayPlayButton.hidden = true;
    if (muteButton) muteButton.hidden = true;
    if (fullscreenButton) fullscreenButton.hidden = true;
    if (captionsButton) captionsButton.hidden = true;
    if (qualitySelect) qualitySelect.hidden = true;

    const timeWrapper = getWrapperFor(currentTimeLabel, '.player-time');
    setElementVisibility(timeWrapper, false);

    const progressWrapper = getWrapperFor(progressInput, '.progress-bar');
    setElementVisibility(progressWrapper, false);

    const volumeWrapper = getWrapperFor(volumeInput, '.volume-control');
    setElementVisibility(volumeWrapper, false);

    if (currentTimeLabel) currentTimeLabel.textContent = '0:00';
    if (durationTimeLabel) durationTimeLabel.textContent = '0:00';
    if (progressInput) progressInput.value = '0';
    if (volumeInput) volumeInput.value = '100';
    if (playerStatus) playerStatus.textContent = 'Cargando reproductor…';
    if (playPauseIcon) playPauseIcon.textContent = '▶';
    if (muteIcon) muteIcon.textContent = 'volume_up';
    if (volumeIndicator) volumeIndicator.textContent = 'volume_up';
};

const syncVolumeStateFromAdapter = () => {
    if (!activePlayerAdapter) {
        return;
    }

    if (typeof activePlayerAdapter.isMuted === 'function') {
        const muted = activePlayerAdapter.isMuted();
        if (typeof muted === 'boolean') {
            playerState.muted = muted;
        }
    }

    if (typeof activePlayerAdapter.getVolume === 'function') {
        const volume = Number(activePlayerAdapter.getVolume());
        if (Number.isFinite(volume)) {
            playerState.volume = volume > 1 ? volume / 100 : volume;
        }
    }
};

const setElementVisibility = (element, visible) => {
    if (!element) {
        return;
    }

    element.hidden = !visible;
};

const getWrapperFor = (element, selector) => {
    return element?.closest?.(selector) || null;
};

const updateVolumeChrome = () => {
    if (!activePlayerAdapter) {
        return;
    }

    syncVolumeStateFromAdapter();
    const isMuted = playerState.muted;
    const volumePercent = Math.round((playerState.volume || 0) * 100);

    if (volumeInput && String(volumeInput.value) !== String(volumePercent)) {
        volumeInput.value = String(volumePercent);
    }

    if (muteIcon) {
        if (isMuted || volumePercent === 0) {
            muteIcon.textContent = 'volume_off';
        } else if (volumePercent < 45) {
            muteIcon.textContent = 'volume_down';
        } else {
            muteIcon.textContent = 'volume_up';
        }
    }

    if (volumeIndicator) {
        volumeIndicator.textContent = muteIcon?.textContent || '🔊';
    }
};

const updateProgressChrome = () => {
    console.log('ENTER updateProgressChrome');
    if (!activePlayerAdapter) {
        console.log('EXIT updateProgressChrome (no activePlayerAdapter)');
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
    if (!activePlayerAdapter || !currentMovie || !activePlayerCapabilities.seek) return;

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
    if (!movieVideo || !currentMovie || !activePlayerCapabilities.seek) {
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
    console.log('Entró a setVideoSource');
    if (!movieVideo || !currentMovie) {
        return;
    }
    
    const servers = Array.isArray(currentMovie.servers) ? currentMovie.servers : [];
    console.log("Movie:", currentMovie);
    console.log("Servers:", currentMovie?.servers);
    console.log("Servers length:", currentMovie?.servers?.length);
    console.log('Movie:', currentMovie);
    console.log('Servers:', currentMovie?.servers);
    console.log('Servers length:', currentMovie?.servers?.length);
    console.log('currentMovie.servers', servers);
    console.log('currentMovie.servers.length', servers.length);
    const server = servers[serverIndex];

    if (!server || !server.url) {
        console.error("[!] setVideoSource failed: server or URL is invalid.");
        notifyToast({ type: 'error', title: 'Servidor no válido', message: 'El servidor seleccionado no tiene una URL válida.' });
        hidePlayerLoader();
        return;
    }

    console.log('ENTER setVideoSource', { serverIndex, serverUrl: server.url, serverKind: server.kind });
    activeServerSelection = { index: serverIndex, server };
    clearInterval(uiUpdateInterval);
    uiUpdateInterval = null;
    activePlayerAdapter = null;

    if (activePlayerAdapter && typeof activePlayerAdapter.destroy === 'function') {
        activePlayerAdapter.destroy();
    }

    resetPlayerChrome();
    updateProgressChrome();
    updateVolumeChrome();
    showPlayerLoader();

    try {
        const detected = window.BugaPlayerManager?.detectServerType?.(server);
        console.log('Servidor seleccionado', { index: serverIndex, name: server.name, type: server.type, kind: server.kind, url: server.url });
        console.log('Tipo detectado', detected?.kind || detected?.displayType || null);
        const adapter = await window.BugaPlayerManager.create(server, {
            videoElement: movieVideo,
            externalElement: externalPlayer
        });
        console.log('Adapter seleccionado', adapter?.adapterId || null);
        console.log('Adapter creado', adapter || null);
        console.log('EXIT PlayerManager.create', { adapterId: adapter?.adapterId, adapterKind: adapter?.kind, adapterExists: Boolean(adapter) });
        activePlayerAdapter = adapter;

        if (!adapter) {
            console.warn('[!] Adapter creation returned null/undefined.');
            hidePlayerLoader();
            return;
        }

        const capabilities = getAdapterCapabilities(adapter);
        activePlayerCapabilities = capabilities;
        playerState.controllable = capabilities.play && capabilities.pause;
        playerState.kind = adapter.kind || 'unknown';
        console.log('Capacidades', capabilities);
        wireAdapterToUI(adapter);
        debugCollectRuntimeState('after-create');

    } catch (error) {
        console.error("[!] Error in setVideoSource:", error);
        notifyToast({ type: 'error', title: 'Error del reproductor', message: 'No se pudo inicializar el reproductor.' });
        hidePlayerLoader();
    }
};
const populateServerSelect = (movie) => {
    console.log('Entró a populateServerSelect');
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
        const detected = window.BugaPlayerManager.detectServerType(server);
        const typeLabel = detected?.displayType || String(server.type || 'iframe').toUpperCase();

        return `<option value="${index}">${serverName} (${typeLabel})</option>`;
    }).join('');
    serverSelect.hidden = false;
    serverSelect.disabled = false;
    serverSelect.value = '0';
};

const togglePlayback = async () => {
    if (!activePlayerAdapter || !(activePlayerCapabilities.play && activePlayerCapabilities.pause)) return;

    console.log('Play/Pause action', { paused: playerState.paused, adapterId: activePlayerAdapter.adapterId });

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
    if (!activePlayerAdapter || !activePlayerCapabilities.mute) return;

    console.log('Mute action', { adapterId: activePlayerAdapter.adapterId });

    if (typeof activePlayerAdapter.isMuted === 'function') {
        const currentlyMuted = activePlayerAdapter.isMuted();
        if (currentlyMuted) {
            activePlayerAdapter.unmute();
        } else {
            activePlayerAdapter.mute();
        }
    } else if (playerState.muted) {
        activePlayerAdapter.unmute();
    } else {
        activePlayerAdapter.mute();
    }

    syncVolumeStateFromAdapter();
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
    console.log('Entró a applyMovie');
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
    console.log('Entró a fetchMovie');
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    console.log("Movie ID:", id);
    const response = await fetch(`${MOVIE_SHARED.TMDB_BASE_URL}/${endpoint}/${id}?api_key=${MOVIE_SHARED.API_KEY}&language=es-ES`);
    console.log('Respuesta API:', response.status);

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
    const movieId = String(currentMovie.id);
    const index = favorites.indexOf(movieId);

    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(movieId);
    }

    setMovieFavorites(favorites);
    updateFavoriteState();

    notifyToast({
        type: favorites.includes(movieId) ? 'success' : 'info',
        title: favorites.includes(movieId) ? 'Agregada a favoritos' : 'Eliminada de favoritos',
        message: favorites.includes(movieId)
            ? `${currentMovie.title} ya está en tu lista.`
            : `${currentMovie.title} salió de favoritos.`,
        key: `favorite:${movieId}:${favorites.includes(movieId) ? 'add' : 'remove'}`
    });

    syncPreferenceEvent({
        type: 'favorite',
        action: favorites.includes(movieId) ? 'added' : 'removed',
        movie: currentMovie
    });
};

const wireAdapterToUI = (adapter) => {
    console.log('ENTER wireAdapterToUI', { adapterId: adapter?.adapterId, adapterKind: adapter?.kind, capabilities: adapter?.capabilities });
    const capabilities = getAdapterCapabilities(adapter);
    console.log('Controles visibles', debugGetControlsVisibility());
    activePlayerCapabilities = capabilities;

    const playVisible = capabilities.play && capabilities.pause;
    const seekVisible = capabilities.seek;
    const volumeVisible = capabilities.volume && capabilities.mute;
    const muteVisible = capabilities.mute;

    setElementVisibility(playPauseButton, playVisible);
    setElementVisibility(overlayPlayButton, playVisible);
    setElementVisibility(muteButton, muteVisible);
    setElementVisibility(fullscreenButton, capabilities.fullscreen);

    const timeWrapper = getWrapperFor(currentTimeLabel, '.player-time');
    setElementVisibility(timeWrapper, seekVisible);

    const progressWrapper = getWrapperFor(progressInput, '.progress-bar');
    setElementVisibility(progressWrapper, seekVisible);

    const volumeWrapper = getWrapperFor(volumeInput, '.volume-control');
    setElementVisibility(volumeWrapper, volumeVisible);

    const qualityWrapper = getWrapperFor(qualitySelect, '.player-quality');
    setElementVisibility(qualityWrapper, capabilities.quality);
    if (captionsButton) {
        setElementVisibility(captionsButton, capabilities.subtitles);
    }

    clearInterval(uiUpdateInterval);

    // Eventos que siempre deben funcionar para manejar el estado de carga
    adapter.on('ready', () => {
        console.log('WIRE EVENT ready');
        debugCollectRuntimeState('event:ready');
        hidePlayerLoader();
    });
    adapter.on('error', (event) => {
        console.log('WIRE EVENT error', event);
        debugCollectRuntimeState('event:error');
        hidePlayerLoader();
        console.error('Error de reproducción:', event);
        notifyToast({ type: 'error', title: 'Error de reproducción', message: 'No se pudo cargar el video. Prueba otro servidor.' });
    });

    // Si el reproductor no es controlable, no conectamos el resto de la UI.
    if (!playVisible && !seekVisible) {
        return;
    }

    uiUpdateInterval = setInterval(() => {
        updatePlayerChrome();
        updateProgressChrome();
    }, 250);

    adapter.on('loadedmetadata', () => {
        console.log('WIRE EVENT loadedmetadata');
        debugCollectRuntimeState('event:loadedmetadata');
        syncVolumeStateFromAdapter();
        updateProgressChrome();
        restoreWatchProgress();
        hidePlayerLoader();

        // Quality selector logic
        const levels = adapter.getHlsLevels?.();
        if (qualitySelect && levels && levels.length > 1) {
            const options = ['<option value="-1">Auto</option>'];
            options.push(...levels.map((level, index) => `<option value="${index}">${level.height}p</option>`));
            qualitySelect.innerHTML = options.join('');
            setElementVisibility(getWrapperFor(qualitySelect, '.player-quality'), true);
        } else if (qualitySelect) {
            setElementVisibility(getWrapperFor(qualitySelect, '.player-quality'), false);
        }
    });
    adapter.on('durationchange', () => {
        console.log('WIRE EVENT durationchange');
        debugCollectRuntimeState('event:durationchange');
        updateProgressChrome();
    });
    adapter.on('timeupdate', () => {
        console.log('WIRE EVENT timeupdate');
        debugCollectRuntimeState('event:timeupdate');
        updateProgressChrome();
        saveWatchProgress(false);
    });
    adapter.on('play', () => {
        console.log('WIRE EVENT play');
        debugCollectRuntimeState('event:play');
        playerState.paused = false;
        updatePlayerChrome();
    });
    adapter.on('pause', () => {
        console.log('WIRE EVENT pause');
        debugCollectRuntimeState('event:pause');
        playerState.paused = true;
        updatePlayerChrome();
    });
    adapter.on('ended', () => {
        console.log('WIRE EVENT ended');
        debugCollectRuntimeState('event:ended');
        playerState.paused = true;
        updatePlayerChrome();
        saveWatchProgress(true);
    });
    adapter.on('volumechange', (event = {}) => {
        console.log('WIRE EVENT volumechange', event);
        debugCollectRuntimeState('event:volumechange');
        if (typeof event.volume === 'number') {
            playerState.volume = event.volume;
        }
        if (typeof event.muted === 'boolean') {
            playerState.muted = event.muted;
        } else {
            syncVolumeStateFromAdapter();
        }
        updateVolumeChrome();
    });
    adapter.on('waiting', () => {
        console.log('WIRE EVENT waiting');
        debugCollectRuntimeState('event:waiting');
        if (playerStatus) playerStatus.textContent = 'Cargando...';
        showPlayerLoader();
    });
    adapter.on('playing', () => {
        console.log('WIRE EVENT playing');
        debugCollectRuntimeState('event:playing');
        if (playerStatus) playerStatus.textContent = 'Reproduciendo';
        hidePlayerLoader();
    });
    adapter.on('canplay', () => {
        console.log('WIRE EVENT canplay');
        debugCollectRuntimeState('event:canplay');
        hidePlayerLoader();
    });
    adapter.on('error', (event) => {
        console.log('WIRE EVENT error', event);
        debugCollectRuntimeState('event:error');
        hidePlayerLoader();
        console.error('Error de reproducción:', event);
        notifyToast({ type: 'error', title: 'Error de reproducción', message: 'No se pudo cargar el video. Prueba otro servidor.' });
    });
    console.log('EXIT wireAdapterToUI');
};

const wirePlayer = () => {
    overlayPlayButton?.addEventListener('click', togglePlayback);
    playPauseButton?.addEventListener('click', togglePlayback);
    muteButton?.addEventListener('click', toggleMute);
    fullscreenButton?.addEventListener('click', toggleFullscreen);

    progressInput?.addEventListener('input', () => {
        if (!activePlayerAdapter || !activePlayerCapabilities.seek) return;
        const duration = activePlayerAdapter.getDuration() || 0;
        if (!duration) {
            return;
        }
        activePlayerAdapter.seek(duration * (Number(progressInput.value) / 1000));
        updateProgressChrome();
    });

    volumeInput?.addEventListener('input', () => {
        if (!activePlayerAdapter || !activePlayerCapabilities.volume) return;
        activePlayerAdapter.setVolume(Number(volumeInput.value) / 100);
        saveWatchProgress(false);
        if (activePlayerCapabilities.mute) {
            if (Number(volumeInput.value) === 0) activePlayerAdapter.mute();
            else activePlayerAdapter.unmute();
        }
        syncVolumeStateFromAdapter();
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
        if (activePlayerCapabilities.play && activePlayerCapabilities.pause && (e.target === playerStage || e.target === overlayPlayButton)) togglePlayback();
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
        console.log('Entró a fetchLocalMovie');
        console.log("Movie ID:", id);
        console.log('Movie ID:', id);
        const movieEndpoint = MOVIE_SHARED.resolveApiUrl(`/api/movies/${encodeURIComponent(id)}`);
        const tmdbEndpoint = MOVIE_SHARED.resolveApiUrl(`/api/movies/tmdb/${encodeURIComponent(id)}`);

        let response = await fetch(movieEndpoint);
        console.log('Respuesta API:', response.status);
        console.log('Respuesta API:', response.status);
        let data = await response.json().catch(() => ({}));
        if (response.ok && data.movie) {
            console.log('[Buga] Movie found via local ID endpoint');
            return data.movie;
        }

        response = await fetch(tmdbEndpoint);
        console.log('Respuesta API:', response.status);
        console.log('Respuesta API:', response.status);
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
    console.log('Entró a handleLoadError');
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
        console.log('Condición de "Contenido no disponible" -> !movieId');
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
                console.log('Condición de "Contenido no disponible" -> no localMovie y no tmdbMovie');
                handleLoadError('No se encontró la película en la base de datos local ni en TMDb.');
                return;
            }
            movie = normalizeMovie(tmdbMovie);
        }

        console.log('[2] Movie cargada:', movie);

        applyMovie(movie);
        console.log("Movie:", currentMovie);
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
        console.log('currentMovie', currentMovie);
        console.log('currentMovie.servers', currentMovie?.servers);
        console.log('currentMovie.servers.length', Array.isArray(currentMovie?.servers) ? currentMovie.servers.length : 0);

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

window.__BugaMovieDebug = {
    runScenario: debugRunScenario,
    snapshot: debugCollectRuntimeState
};

window.__BugaMovieDebugInject = async (movieData) => {
    currentMovie = movieData;
    applyMovie(movieData);
    populateServerSelect(movieData);
    await setVideoSource(0);
    return debugCollectRuntimeState('injected');
};

bootstrap();
})();
