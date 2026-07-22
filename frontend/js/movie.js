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
const movieId = Number(params.get('id'));
const mediaType = params.get('type') === 'tv' ? 'tv' : 'movie';
const mediaLabel = mediaType === 'tv' ? 'Serie' : 'Película';
let currentMovie = null;
let lastWatchSaveAt = 0;
let activePlayerAdapter = null;

// --- Player Architecture ---
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
    const isFavorite = favorites.includes(currentMovie.id);
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
 * behind a consistent interface.
 */

/**
 * Manages the lifecycle of player adapters.
 * Ensures only one player is active and that resources are cleaned up.
 */
const PlayerManager = {
    create: async (server) => {
        if (activePlayerAdapter) {
            activePlayerAdapter.destroy();
            activePlayerAdapter = null;
        }

        const youtubeId = PlayerManager.parseYoutubeId(server.url);

        if (youtubeId) {
            movieVideo.style.display = 'none';
            externalPlayer.style.display = 'block';
            await PlayerManager.loadYoutubeApi();
            return new Promise((resolve) => {
                activePlayerAdapter = YouTubePlayerAdapter('externalPlayer', youtubeId, () => {
                    resolve(activePlayerAdapter);
                });
            });
        }

        if (server.type === 'iframe' || server.type === 'embed') {
            movieVideo.style.display = 'none';
            externalPlayer.style.display = 'block';
            activePlayerAdapter = IframePlayerAdapter(externalPlayer, server.url);
            return Promise.resolve(activePlayerAdapter);
        }

        // Fallback to HTML5 player for m3u8, mp4
        movieVideo.style.display = 'block';
        externalPlayer.style.display = 'none';
        activePlayerAdapter = Html5PlayerAdapter(movieVideo);

        if (server.type === 'm3u8') {
            activePlayerAdapter.loadSource(server.url, 'hls');
        } else { // Default to mp4
            activePlayerAdapter.loadSource(server.url, 'mp4');
        }

        return Promise.resolve(activePlayerAdapter);
    },

    parseYoutubeId: (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = String(url || '').match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    loadYoutubeApi: () => {
        return new Promise((resolve) => {
            if (youtubeApiReady && window.YT?.Player) {
                resolve();
                return;
            }
            if (window.onYouTubeIframeAPIReady) {
                // If it's already defined, chain onto it.
                const originalReady = window.onYouTubeIframeAPIReady;
                window.onYouTubeIframeAPIReady = () => {
                    originalReady();
                    youtubeApiReady = true;
                    resolve();
                };
            } else {
                window.onYouTubeIframeAPIReady = () => {
                    youtubeApiReady = true;
                    resolve();
                };
            }

            if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
                const tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                document.head.appendChild(tag);
            }
        });
    }
};

/**
 * Adapter for a generic, uncontrollable <iframe>.
 */
const IframePlayerAdapter = (iframeElement, url) => {
    iframeElement.src = url;
    iframeElement.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; web-share');
    iframeElement.allowFullscreen = true;

    // This adapter is mostly a placeholder as we can't control it.
    return {
        play: () => {},
        pause: () => {},
        seekTo: () => {},
        setVolume: () => {},
        mute: () => {},
        unmute: () => {},
        getCurrentTime: () => 0,
        getDuration: () => 0,
        isPaused: () => true,
        isMuted: () => true,
        enterFullscreen: () => {
            if (iframeElement.requestFullscreen) iframeElement.requestFullscreen();
        },
        on: (event, callback) => {
            // Trigger ready events immediately for uncontrollable iframes
            if (['loadedmetadata', 'canplay'].includes(event)) {
                setTimeout(callback, 0);
            }
        },
        destroy: () => {
            iframeElement.removeAttribute('src');
            iframeElement.style.display = 'none';
        }
    };
};

const YouTubePlayerAdapter = (playerElementId, videoId, onReady) => {
    let player;
    let eventListeners = {};
    let timeUpdateInterval = null;

    const trigger = (eventName, data) => {
        (eventListeners[eventName] || []).forEach(cb => cb(data));
    }; 

    const onPlayerStateChange = (event) => {
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                trigger('play');
                timeUpdateInterval = setInterval(() => trigger('timeupdate'), 250);
                break;
            case YT.PlayerState.PAUSED:
                trigger('pause');
                clearInterval(timeUpdateInterval);
                break;
            case YT.PlayerState.ENDED:
                trigger('ended');
                clearInterval(timeUpdateInterval);
                break;
            case YT.PlayerState.BUFFERING:
                trigger('waiting');
                break;
        }
    };

    player = new YT.Player(playerElementId, {
        videoId: videoId,
        playerVars: {
            autoplay: 1,
            controls: 0,
            rel: 0,
            showinfo: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            playsinline: 1,
        },
        events: {
            onReady: () => {
                onReady?.();
                trigger('loadedmetadata');
                trigger('playing'); // YT autoplays, so trigger playing
            },
            onStateChange: onPlayerStateChange,
            onError: (error) => trigger('error', error)
        }
    });

    return {
        play: () => player.playVideo(),
        pause: () => player.pauseVideo(),
        seekTo: (time) => player.seekTo(time, true),
        setVolume: (level) => player.setVolume(level * 100),
        mute: () => player.mute(),
        unmute: () => player.unMute(),
        getDuration: () => player.getDuration(),
        getCurrentTime: () => player.getCurrentTime(),
        isPaused: () => player.getPlayerState() !== YT.PlayerState.PLAYING,
        getVolume: () => player.getVolume() / 100,
        isMuted: () => player.isMuted(),
        enterFullscreen: () => {
            const iframe = player.getIframe();
            if (iframe.requestFullscreen) {
                iframe.requestFullscreen();
            } else if (iframe.mozRequestFullScreen) {
                iframe.mozRequestFullScreen();
            } else if (iframe.webkitRequestFullscreen) {
                iframe.webkitRequestFullscreen();
            }
        },
        on: (eventName, callback) => {
            if (!eventListeners[eventName]) eventListeners[eventName] = [];
            eventListeners[eventName].push(callback);
        },
        destroy: () => {
            clearInterval(timeUpdateInterval);
            if (player && typeof player.destroy === 'function') {
                player.destroy();
            }
            player = null;
            eventListeners = {};
        }
    };
};

const Html5PlayerAdapter = (videoElement) => {
    let hls = null;

    return {
        loadSource: (url, type) => {
            if (hls) hls.destroy();

            if (type === 'hls' && typeof window.Hls !== 'undefined' && window.Hls.isSupported()) {
                hls = new window.Hls();
                hls.loadSource(url);
                hls.attachMedia(videoElement);
            } else if (type === 'hls' && videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                videoElement.src = url;
            } else { // MP4 or fallback
                videoElement.src = url;
            }
        },
        play: () => videoElement.play(),
        pause: () => videoElement.pause(),
        seekTo: (time) => { videoElement.currentTime = time; },
        setVolume: (level) => { videoElement.volume = level; },
        mute: () => { videoElement.muted = true; },
        unmute: () => { videoElement.muted = false; },
        getDuration: () => videoElement.duration,
        getCurrentTime: () => videoElement.currentTime,
        isPaused: () => videoElement.paused,
        getVolume: () => videoElement.volume,
        isMuted: () => videoElement.muted,
        enterFullscreen: () => {
            if (playerStage?.requestFullscreen) {
                playerStage.requestFullscreen();
            } else if (videoElement.webkitEnterFullscreen) {
                videoElement.webkitEnterFullscreen();
            }
        },
        on: (eventName, callback) => videoElement.addEventListener(eventName, callback),
        off: (eventName, callback) => {
            // Ensure listeners are removed to prevent memory leaks
            videoElement.removeEventListener(eventName, callback);
        },
        getHlsLevels: () => hls?.levels || [],
        setHlsLevel: (levelIndex) => { if (hls) hls.currentLevel = levelIndex; },
        destroy: () => {
            if (hls) {
                hls.destroy();
                hls = null;
            }
            // Stop playback and clean up
            if (!videoElement.src) {
                videoElement.load();
                return;
            }
            videoElement.pause();
            videoElement.removeAttribute('src');
            videoElement.load();
        }
    };
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
    if (!movieVideo || !currentMovie) {
        return;
    }

    const servers = Array.isArray(currentMovie.servers) ? currentMovie.servers : [];
    const server = servers[serverIndex];

    if (!server || !server.url) {
        notifyToast({ type: 'error', title: 'Servidor no válido', message: 'El servidor seleccionado no tiene una URL válida.' });
        hidePlayerLoader();
        return;
    }

    showPlayerLoader();

    try {
        const adapter = await PlayerManager.create(server);
        activePlayerAdapter = adapter; // Store the active adapter

        if (!adapter) {
            // This case is for uncontrollable iframes that don't have a full adapter
            hidePlayerLoader();
            overlayPlayButton.style.display = 'none';
            return;
        }

        overlayPlayButton.style.display = '';
        wireAdapterToUI(adapter);

    } catch (error) {
        console.error("Error creating player adapter:", error);
        notifyToast({ type: 'error', title: 'Error del reproductor', message: 'No se pudo inicializar el reproductor.' });
        hidePlayerLoader();
    }
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

    if (index >= 0) {
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
    adapter.on('loadedmetadata', () => {
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
        const response = await fetch(`/api/movies/tmdb/${encodeURIComponent(id)}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.movie) {
            return null;
        }
    }
        return data.movie;
    } catch (error) {
        console.warn('Local movie fetch failed', error);
        return null;
    }
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

    if (!Number.isFinite(movieId)) {
        movieTitle.textContent = mediaType === 'tv' ? 'Serie no encontrada' : 'Película no encontrada';
        movieDescription.textContent = 'El ID proporcionado no es válido.';
        updateMeta(['N/A', 'N/A', mediaType === 'tv' ? 'Serie' : 'Cine']);
        updateFavoriteState();
        hideMoviePageLoader();
        return;
    }

    try {
        const localMovie = await fetchLocalMovie(movieId);
        const movie = normalizeMovie(localMovie || await fetchMovieFromTMDB(movieId));
        applyMovie(movie);
        syncPreferenceEvent({
            type: 'view',
            movie
        });
        populateServerSelect(movie);
        await setVideoSource(0); // Cargar el primer servidor por defecto

        if (volumeInput) {
            volumeInput.value = '100';
        }

        updateProgressChrome();
        updateVolumeChrome();
        updatePlayerChrome();
        hideMoviePageLoader();

        if (params.get('autoplay') === '1') {
            try {
                if (activePlayerAdapter) await activePlayerAdapter.play();
            } catch (error) {
                console.warn('Autoplay blocked', error);
            }
        }
    } catch (error) {
        console.warn('TMDB detail load failed', error);
        notifyToast({
            type: 'error',
            title: 'No se pudo cargar la película',
            message: 'Hubo un problema de red o con TMDB.'
        });

        const fallbackMovie = {
            id: movieId,
            title: mediaType === 'tv' ? `Serie ${movieId}` : `Película ${movieId}`,
            description: 'No se pudo cargar la información desde TMDB.',
            tagline: mediaType === 'tv'
                ? 'Contenido temporal de serie mientras se resuelve la conexión.'
                : 'Contenido temporal mientras se resuelve la conexión.',
            poster: '',
            backdrop: '',
            release_date: '',
            runtime: 0,
            genres: [],
            mediaType
        };

        applyMovie(fallbackMovie);
        populateServerSelect(fallbackMovie);
        updateProgressChrome();
        updateVolumeChrome();
        updatePlayerChrome();
        hideMoviePageLoader();
    }
};

bootstrap();
})();
