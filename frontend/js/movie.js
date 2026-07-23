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

    const isPaused = activePlayerAdapter.isPaused();
    const isPlaying = !isPaused;

    playerStage.classList.toggle('is-playing', isPlaying);

    if (playPauseIcon) {
        playPauseIcon.textContent = isPlaying ? 'pause' : 'play_arrow';
    }

    if (overlayPlayButton) {
        overlayPlayButton.hidden = isPlaying;
    }

    // Note: 'ended' state is handled by the adapter's 'ended' event listener
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

    const isMuted = activePlayerAdapter.isMuted();
    const volumePercent = Math.round(isMuted ? 0 : activePlayerAdapter.getVolume() * 100);

    if (volumeInput && String(volumeInput.value) !== String(volumePercent)) {
        volumeInput.value = String(volumePercent);
    }

    if (muteIcon) {
        if (isMuted || volumePercent === 0) {
            muteIcon.textContent = '🔇';
        } else if (volumePercent < 45) {
            muteIcon.textContent = '🔉';
        } else {
            muteIcon.textContent = '🔊';
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
        notifyToast({
            type: 'info',
            title: 'Añadida a Continuar viendo',
            message: `${currentMovie.title} quedó guardada en tu historial.`,
            key: `watch:${currentMovie.id}`
        });
    }
};

/**
 * --- Player Adapter Architecture ---
 * This section defines a clean, adapter-based architecture for the video player.
 * It abstracts the underlying player implementation (HTML5, YouTube, etc.)
 * behind a consistent interface (PlayerAdapter).
 */

class PlayerAdapter {
    play() { throw new Error('Not implemented'); }
    pause() { throw new Error('Not implemented'); }
    seekTo(time) { throw new Error('Not implemented'); }
    setVolume(level) { throw new Error('Not implemented'); }
    mute() { throw new Error('Not implemented'); }
    unmute() { throw new Error('Not implemented'); }
    getCurrentTime() { throw new Error('Not implemented'); }
    getDuration() { throw new Error('Not implemented'); }
    isPaused() { throw new Error('Not implemented'); }
    isMuted() { throw new Error('Not implemented'); }
    getVolume() { throw new Error('Not implemented'); }
    enterFullscreen() { throw new Error('Not implemented'); }
    on(eventName, callback) { throw new Error('Not implemented'); }
    off(eventName, callback) { throw new Error('Not implemented'); }
    destroy() { throw new Error('Not implemented'); }
}

class Html5PlayerAdapter extends PlayerAdapter {
    constructor(videoElement) {
        super();
        this.videoElement = videoElement;
        this.hls = null;
        this._boundEvents = new Map();
    }

    loadSource(url, type) {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        if (type === 'hls' && typeof window.Hls !== 'undefined' && window.Hls.isSupported()) {
            this.hls = new window.Hls();
            this.hls.loadSource(url);
            this.hls.attachMedia(this.videoElement);
        } else if (type === 'hls' && this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            this.videoElement.src = url;
        } else {
            this.videoElement.src = url;
        }
    }

    play() { return this.videoElement.play(); }
    pause() { this.videoElement.pause(); }
    seekTo(time) { this.videoElement.currentTime = time; }
    setVolume(level) { this.videoElement.volume = level; }
    mute() { this.videoElement.muted = true; }
    unmute() { this.videoElement.muted = false; }
    getDuration() { return this.videoElement.duration || 0; }
    getCurrentTime() { return this.videoElement.currentTime || 0; }
    isPaused() { return this.videoElement.paused; }
    getVolume() { return this.videoElement.volume; }
    isMuted() { return this.videoElement.muted; }

    enterFullscreen() {
        if (playerStage?.requestFullscreen) {
            return playerStage.requestFullscreen();
        } else if (this.videoElement.webkitEnterFullscreen) {
            this.videoElement.webkitEnterFullscreen();
        }
    }

    on(eventName, callback) {
        this.videoElement.addEventListener(eventName, callback);
        if (!this._boundEvents.has(eventName)) this._boundEvents.set(eventName, []);
        this._boundEvents.get(eventName).push(callback);
    }

    off(eventName, callback) {
        this.videoElement.removeEventListener(eventName, callback);
        if (this._boundEvents.has(eventName)) {
            const callbacks = this._boundEvents.get(eventName);
            const idx = callbacks.indexOf(callback);
            if (idx > -1) callbacks.splice(idx, 1);
        }
    }

    getHlsLevels() { return this.hls?.levels || []; }
    setHlsLevel(levelIndex) { if (this.hls) this.hls.currentLevel = levelIndex; }

    destroy() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        if (!this.videoElement.src) {
            this.videoElement.load();
            return;
        }
        this.videoElement.pause();
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
    }
}

class YouTubePlayerAdapter extends PlayerAdapter {
    constructor(player, playerElementId) {
        super();
        this.player = player;
        this.playerElementId = playerElementId;
        this.eventListeners = {};
        this.timeUpdateInterval = null;
        this.isReady = true;

        this.player.addEventListener('onStateChange', this.onPlayerStateChange.bind(this));
        this.player.addEventListener('onError', (error) => this.trigger('error', error));
    }

    static async create(playerElementId, videoId) {
        console.log("[F] ENTER YouTubePlayerAdapter.create");

        return new Promise((resolve, reject) => {
            try {
                let playerContainer = document.getElementById(playerElementId);
                if (!playerContainer) {
                    throw new Error(`Player container #${playerElementId} not found in DOM.`);
                }
                console.log(`[F.1] Container #${playerElementId} found:`, playerContainer);

                // --- CAUSA RAÍZ CORREGIDA ---
                // La API de YouTube necesita un DIV, no un IFRAME. Si es un iframe, lo reemplazamos.
                if (playerContainer.tagName === 'IFRAME') {
                    console.warn(`[!] Container #${playerElementId} is an IFRAME. Replacing with a DIV for YouTube API.`);
                    const newDiv = document.createElement('div');
                    newDiv.id = playerElementId;
                    playerContainer.parentNode.replaceChild(newDiv, playerContainer);
                    playerContainer = newDiv;
                    console.log(`[F.1.1] Container replaced with:`, playerContainer);
                }

                console.log("[F.2] ANTES new YT.Player");
                new YT.Player(playerElementId, {
                    videoId: videoId,
                    playerVars: {
                        autoplay: 1, controls: 0, rel: 0, showinfo: 0,
                        modestbranding: 1, iv_load_policy: 3, playsinline: 1,
                    },
                    events: {
                        onReady: (event) => {
                            console.log("[H] ENTER YouTube onReady callback");
                            const adapter = new YouTubePlayerAdapter(event.target, playerElementId);
                            adapter.trigger('loadedmetadata');
                            adapter.trigger('durationchange');
                            adapter.trigger('canplay');
                            adapter.trigger('playing');
                            console.log("[H.1] EXIT YouTube onReady callback");
                            resolve(adapter);
                        },
                        onStateChange: (event) => {
                            console.log("[YT Event] State changed:", event.data);
                        },
                        onError: (event) => {
                            console.error("[!] YouTube Player Error:", event.data);
                            reject(new Error(`YouTube player error code: ${event.data}`));
                        }
                    }
                });
                console.log("[G] DESPUÉS new YT.Player (constructor finished)");
            } catch (error) {
                console.error("[!] Failed to instantiate YT.Player:", error);
                console.error(error.stack);
                reject(error);
            }
        }).finally(() => {
            console.log("[F.3] EXIT YouTubePlayerAdapter.create (Promise has settled)");
        });
    }

    trigger(eventName, data) {
        (this.eventListeners[eventName] || []).forEach(cb => cb(data));
    }

    onPlayerStateChange(event) {
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                this.trigger('play');
                this.trigger('playing');
                this.timeUpdateInterval = setInterval(() => this.trigger('timeupdate'), 250);
                break;
            case YT.PlayerState.PAUSED:
                this.trigger('pause');
                clearInterval(this.timeUpdateInterval);
                break;
            case YT.PlayerState.ENDED:
                this.trigger('ended');
                clearInterval(this.timeUpdateInterval);
                break;
            case YT.PlayerState.BUFFERING:
                this.trigger('waiting');
                break;
            case YT.PlayerState.CUED:
                this.trigger('loadedmetadata');
                this.trigger('durationchange');
                break;
        }
    }

    play() { if (this.isReady) this.player.playVideo(); }
    pause() { if (this.isReady) this.player.pauseVideo(); }
    seekTo(time) { if (this.isReady) this.player.seekTo(time, true); }
    setVolume(level) { if (this.isReady) this.player.setVolume(level * 100); }
    mute() { if (this.isReady) this.player.mute(); }
    unmute() { if (this.isReady) this.player.unMute(); }

    getDuration() { return this.isReady ? this.player.getDuration() : 0; }
    getCurrentTime() { return this.isReady ? this.player.getCurrentTime() : 0; }
    isPaused() { return this.isReady ? this.player.getPlayerState() !== YT.PlayerState.PLAYING : true; }
    getVolume() { return this.isReady ? this.player.getVolume() / 100 : 0; }
    isMuted() { return this.isReady ? this.player.isMuted() : true; }

    enterFullscreen() {
        const iframe = this.player.getIframe();
        if (iframe.requestFullscreen) {
            iframe.requestFullscreen();
        } else if (iframe.mozRequestFullScreen) {
            iframe.mozRequestFullScreen();
        } else if (iframe.webkitRequestFullscreen) {
            iframe.webkitRequestFullscreen();
        }
    }

    on(eventName, callback) {
        if (!this.eventListeners[eventName]) this.eventListeners[eventName] = [];
        this.eventListeners[eventName].push(callback);
    }

    off(eventName, callback) {
        if (this.eventListeners[eventName]) {
            const idx = this.eventListeners[eventName].indexOf(callback);
            if (idx > -1) this.eventListeners[eventName].splice(idx, 1);
        }
    }

    destroy() {
        this.isReady = false;
        clearInterval(this.timeUpdateInterval);
        if (this.player && typeof this.player.destroy === 'function') {
            this.player.destroy();
        }
        this.player = null;
        this.eventListeners = {};

        const playerElement = document.getElementById(this.playerElementId);
        if (playerElement && playerElement.parentNode) {
            const newDiv = document.createElement('div');
            newDiv.id = this.playerElementId;
            playerElement.parentNode.replaceChild(newDiv, playerElement);
        }
    }
}

class IframePlayerAdapter extends PlayerAdapter {
    constructor(iframeElement, url) {
        super();
        this.iframeElement = iframeElement;
        this.iframeElement.src = url;
        this.iframeElement.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; web-share');
        this.iframeElement.allowFullscreen = true;
        // Immediately trigger loadedmetadata and canplay for iframes as they are black boxes
        setTimeout(() => {
            this.on('loadedmetadata', () => {});
        }, 0);
    }

    play() {}
    pause() {}
    seekTo() {}
    setVolume() {}
    mute() {}
    unmute() {}
    getCurrentTime() { return 0; }
    getDuration() { return 0; }
    isPaused() { return true; }
    isMuted() { return true; }
    getVolume() { return 0; }

    enterFullscreen() {
        if (this.iframeElement.requestFullscreen) this.iframeElement.requestFullscreen();
    }

    on(eventName, callback) {
        // For iframes, we can only simulate readiness.
        if (['loadedmetadata', 'canplay'].includes(eventName)) {
            callback();
        }
    }

    off() {}

    destroy() {
        this.iframeElement.removeAttribute('src');
        this.iframeElement.style.display = 'none';
    }

}

/**
 * Manages the lifecycle of player adapters.
 * Ensures only one player is active and that resources are cleaned up.
 */
const PlayerManager = {
    _youtubeApiPromise: null,
    create: async (server) => {
        console.log("[B] ENTER PlayerManager.create");
        if (activePlayerAdapter) {
            activePlayerAdapter.destroy();
            activePlayerAdapter = null;
        }

        const youtubeId = PlayerManager.parseYoutubeId(server.url);

        if (youtubeId) {
            console.log("[B.1.YT] YouTube ID found:", youtubeId);
            movieVideo.style.display = 'none';
            externalPlayer.style.display = 'block';
            console.log("[B.2.YT] ANTES await PlayerManager.loadYoutubeApi");
            await PlayerManager.loadYoutubeApi();
            console.log("[B.3.YT] DESPUÉS await PlayerManager.loadYoutubeApi");
            console.log("[B.4.YT] ANTES await YouTubePlayerAdapter.create");
            const adapter = await YouTubePlayerAdapter.create('externalPlayer', youtubeId);
            console.log("[B.5.YT] DESPUÉS await YouTubePlayerAdapter.create");
            console.log("[B.6.YT] EXIT PlayerManager.create (returning YT adapter)");
            return adapter;
        }

        if (server.type === 'iframe' || server.type === 'embed') {
            movieVideo.style.display = 'none';
            externalPlayer.style.display = 'block';
            return new IframePlayerAdapter(externalPlayer, server.url);
        }

        console.log("[B.1.HTML5] HTML5 player type detected");
        movieVideo.style.display = 'block';
        externalPlayer.style.display = 'none';
        const adapter = new Html5PlayerAdapter(movieVideo);

        if (server.type === 'm3u8') {
            adapter.loadSource(server.url, 'hls');
        } else {
            adapter.loadSource(server.url, 'mp4');
        }

        console.log("[B.2.HTML5] EXIT PlayerManager.create (returning HTML5 adapter)");
        return adapter;
    },

    parseYoutubeId: (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = String(url || '').match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    loadYoutubeApi: () => {
        if (PlayerManager._youtubeApiPromise) {
            return PlayerManager._youtubeApiPromise;
        }

        PlayerManager._youtubeApiPromise = new Promise((resolve) => {
            if (window.YT && window.YT.Player) {
                return resolve();
            }

            const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
            
            window.onYouTubeIframeAPIReady = () => {
                resolve();
            };

            if (!existingScript) {
                const tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                document.head.appendChild(tag);
            }
        });

        return PlayerManager._youtubeApiPromise;
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
        activePlayerAdapter.seekTo(resumeTime);
        if (playerStatus) {
            playerStatus.textContent = `Reanudando en ${formatTime(resumeTime)}`;
        }
        updateProgressChrome();
    }
};

const setVideoSource = async (serverIndex) => {
    console.log("[A] ENTER setVideoSource");
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

    showPlayerLoader();

    try {
        console.log("[B] ANTES await PlayerManager.create");
        const adapter = await PlayerManager.create(server);
        console.log("[C] DESPUÉS await PlayerManager.create, adapter received:", adapter);
        activePlayerAdapter = adapter; // Store the active adapter

        if (!adapter) {
            // This case is for uncontrollable iframes that don't have a full adapter
            console.warn("[!] Adapter creation returned null/undefined. This might be an uncontrollable iframe.");
            hidePlayerLoader();
            overlayPlayButton.style.display = 'none';
            console.log("[C.1] EXIT setVideoSource (no adapter)");
            return;
        }

        console.log("[D] ANTES wireAdapterToUI");
        overlayPlayButton.style.display = '';
        wireAdapterToUI(adapter);
        console.log("[E] DESPUÉS wireAdapterToUI");

    } catch (error) {
        console.error("[!] Error in setVideoSource:", error);
        console.error(error.stack);
        notifyToast({ type: 'error', title: 'Error del reproductor', message: 'No se pudo inicializar el reproductor.' });
        hidePlayerLoader();
    }
    console.log("[J] EXIT setVideoSource");
};

const showExternalPlayer = () => {
    // This function is now obsolete, PlayerManager handles visibility.
};

const hideExternalPlayer = () => {
    if (externalPlayer) {
        externalPlayer.style.display = 'none';
        externalPlayer.removeAttribute('src');
    }
};

const populateQualitySelect = (qualities = [], hasHls = false) => {
    if (!qualitySelect) {
        return;
    }

    const options = ['<option value="auto">Auto</option>'];

    if (hasHls) {
        options.push(...qualities.map((quality) => `<option value="${quality.label}">${quality.label}</option>`));
    }

    if (!hasHls) {
        options.push('<option value="mp4">MP4</option>');
    }

    qualitySelect.innerHTML = options.join('');
    qualitySelect.disabled = false;
    qualitySelect.hidden = false;
    qualitySelect.value = 'auto';
};

const fetchStreamInfo = async (tmdbId) => {
    const token = getAuthToken();
    if (!token) {
        return null;
    }

    return fetchAuthJson(`/api/videos/${tmdbId}/stream?token=${encodeURIComponent(token)}`);
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
        // Show type in parentheses for clarity
        const typeLabel = (server.type || 'iframe').toUpperCase();
        return `<option value="${index}">${serverName} (${typeLabel})</option>`;
    }).join('');
    serverSelect.hidden = false;
    serverSelect.disabled = false;
    serverSelect.value = '0';
};

const togglePlayback = async () => {
    if (!activePlayerAdapter) return;

    if (activePlayerAdapter.isPaused()) {
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
    if (!activePlayerAdapter) return;

    if (activePlayerAdapter.isMuted()) {
        activePlayerAdapter.unmute();
    } else {
        activePlayerAdapter.mute();
    }

    if (!activePlayerAdapter.isMuted() && Number(volumeInput?.value) === 0) {
        activePlayerAdapter.setVolume(0.5);
        if (volumeInput) {
            volumeInput.value = '50';
        }
    }
    updateVolumeChrome();
};

const toggleFullscreen = async () => {
    if (activePlayerAdapter) {
        activePlayerAdapter.enterFullscreen();
        return;
    }

    const target = playerStage || externalPlayer || movieVideo;

    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
        }

        if (target?.requestFullscreen) { // Standard
            await target.requestFullscreen();
        } else if (target?.webkitEnterFullscreen) { // Safari
            movieVideo.webkitEnterFullscreen();
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
    console.log("[D.1] ENTER wireAdapterToUI");
    const isControllable = adapter instanceof Html5PlayerAdapter || adapter instanceof YouTubePlayerAdapter;

    // Show/hide controls based on adapter type
    [playPauseButton, muteButton, progressInput, volumeInput, currentTimeLabel, durationTimeLabel, qualitySelect].forEach(el => {
        if (el) {
            const controlWrapper = el.closest('.player-control-group') || el;
            controlWrapper.hidden = !isControllable;
        }
    });

    if (!isControllable) {
        console.log("[D.2] Uncontrollable player (iframe), skipping event wiring.");
        return; // No need to wire events for uncontrollable players like iframes
    }

    adapter.on('loadedmetadata', () => {
        console.log("[I] EVENT: loadedmetadata");
        updateProgressChrome();
        restoreWatchProgress();
        hidePlayerLoader();
        const levels = adapter.getHlsLevels?.();
        if (qualitySelect && levels && levels.length > 1) {
            const options = ['<option value="-1">Auto</option>'];
            options.push(...levels.map((level, index) => `<option value="${index}">${level.height}p</option>`));
            qualitySelect.innerHTML = options.join('');
            qualitySelect.disabled = false;
            qualitySelect.hidden = false;
        }
    });
    adapter.on('durationchange', updateProgressChrome);
    adapter.on('timeupdate', () => {
        updateProgressChrome();
        saveWatchProgress(false);
    });
    adapter.on('play', updatePlayerChrome);
    adapter.on('pause', updatePlayerChrome);
    adapter.on('ended', () => {
        updatePlayerChrome();
        saveWatchProgress(true);
    });
    adapter.on('volumechange', () => {
        updateVolumeChrome();
        updatePlayerChrome();
    });
    adapter.on('waiting', () => {
        if (playerStatus) playerStatus.textContent = 'Cargando...';
        showPlayerLoader();
    });
    adapter.on('playing', () => {
        if (playerStatus) playerStatus.textContent = 'Reproduciendo';
        hidePlayerLoader();
        updatePlayerChrome();
    });
    adapter.on('canplay', hidePlayerLoader);
    adapter.on('error', (event) => {
        hidePlayerLoader();
        console.error('Error de reproducción:', event);
        notifyToast({ type: 'error', title: 'Error de reproducción', message: 'No se pudo cargar el video. Prueba otro servidor.' });
    });
    console.log("[D.3] EXIT wireAdapterToUI");
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
        activePlayerAdapter.seekTo(duration * (Number(progressInput.value) / 1000));
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
        if (e.target === playerStage || e.target === overlayPlayButton) togglePlayback();
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
