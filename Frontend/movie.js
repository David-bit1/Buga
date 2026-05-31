const API_KEY = 'b24af203b14e23f8c91844baae37cfab';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w780';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const DEFAULT_VIDEO_SOURCE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const FALLBACK_POSTER = 'https://via.placeholder.com/500x750?text=No+Poster';
const FAVORITES_KEY = window.BugaAuth?.getProfileStorageKey?.('buga-favorites') || 'buga-favorites';
const WATCH_HISTORY_KEY = window.BugaAuth?.getProfileStorageKey?.('buga-watch-history') || 'buga-watch-history';

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

const syncPreferenceEvent = (payload) => {
    window.BugaAuth?.recordPreferenceEvent?.(payload);
};

const getAuthToken = () => window.BugaAuth?.getAuthToken?.() || '';
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
let currentMovie = null;
let hlsInstance = null;
let lastWatchSaveAt = 0;

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

const normalizeMovie = (movie) => ({
    id: movie.id,
    title: movie.title || movie.original_title || `Película ${movie.id}`,
    description: movie.overview || movie.description || 'Descripción no disponible.',
    tagline: movie.tagline || '',
    poster: movie.poster_path ? `${POSTER_BASE_URL}${movie.poster_path}` : movie.poster || FALLBACK_POSTER,
    backdrop: movie.backdrop_path ? `${IMAGE_BASE_URL}${movie.backdrop_path}` : movie.backdrop || '',
    release_date: movie.release_date || '',
    runtime: movie.runtime || 0,
    genres: Array.isArray(movie.genres) ? movie.genres : [],
    videoSrc: movie.videoSrc || '',
    hlsSrc: movie.hlsSrc || '',
    subtitlesSrc: movie.subtitlesSrc || ''
});

const getFavorites = () => {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    } catch {
        return [];
    }
};

const setFavorites = (favorites) => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
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

    const favorites = getFavorites();
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
    if (!movieVideo || !playerStage) {
        return;
    }

    const isPlaying = !movieVideo.paused && !movieVideo.ended;
    playerStage.classList.toggle('is-playing', isPlaying);

    if (playPauseIcon) {
        playPauseIcon.textContent = isPlaying ? '❚❚' : '▶';
    }

    if (overlayPlayButton) {
        overlayPlayButton.hidden = isPlaying;
    }

    if (playerStatus) {
        if (movieVideo.ended) {
            playerStatus.textContent = 'Video finalizado';
        } else if (movieVideo.paused) {
            playerStatus.textContent = 'Pausado';
        } else {
            playerStatus.textContent = 'Reproduciendo';
        }
    }
};

const updateVolumeChrome = () => {
    if (!movieVideo) {
        return;
    }

    const volumePercent = Math.round(movieVideo.muted ? 0 : movieVideo.volume * 100);

    if (volumeInput && String(volumeInput.value) !== String(volumePercent)) {
        volumeInput.value = String(volumePercent);
    }

    if (muteIcon) {
        if (movieVideo.muted || volumePercent === 0) {
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
    if (!movieVideo) {
        return;
    }

    const duration = movieVideo.duration || 0;
    const currentTime = movieVideo.currentTime || 0;

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
    if (!movieVideo || !currentMovie || !Number.isFinite(movieVideo.duration) || movieVideo.duration <= 0) {
        return;
    }

    const currentTime = movieVideo.currentTime || 0;
    const duration = movieVideo.duration || 0;
    const progress = Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)));

    if (!force && Date.now() - lastWatchSaveAt < 5000) {
        return;
    }

    if (currentTime < 3 && progress < 5) {
        return;
    }

    lastWatchSaveAt = Date.now();

    if (movieVideo.ended || progress >= 95) {
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
        poster: currentMovie.poster || FALLBACK_POSTER,
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
        ended: Boolean(movieVideo.ended),
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

const restoreWatchProgress = () => {
    if (!movieVideo || !currentMovie) {
        return;
    }

    const history = getWatchHistory();
    const savedEntry = history.find((entry) => Number(entry.id) === Number(currentMovie.id));

    if (!savedEntry || !Number.isFinite(savedEntry.currentTime) || savedEntry.currentTime <= 0) {
        return;
    }

    const resumeTime = Math.min(savedEntry.currentTime, Math.max(0, (movieVideo.duration || savedEntry.duration || 0) - 5));
    if (resumeTime > 0) {
        movieVideo.currentTime = resumeTime;
        if (playerStatus) {
            playerStatus.textContent = `Reanudando en ${formatTime(resumeTime)}`;
        }
        updateProgressChrome();
    }
};

const destroyHls = () => {
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
};

const getPlaybackSources = (movie) => ({
    mp4: movie?.videoSrc || DEFAULT_VIDEO_SOURCE,
    hls: movie?.hlsSrc || '',
    subtitles: movie?.subtitlesSrc || ''
});

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

const setVideoSource = async (movie) => {
    if (!movieVideo || !movie) {
        return;
    }

    destroyHls();
    showPlayerLoader();

    const sources = getPlaybackSources(movie);
    movieVideo.pause();
    movieVideo.removeAttribute('src');
    movieVideo.load();
    movieVideo.poster = movie.poster || '';
    movieVideo.dataset.movieId = String(movie.id);

    if (qualitySelect) {
        qualitySelect.innerHTML = '';
        qualitySelect.disabled = true;
        qualitySelect.hidden = true;
    }

    if (captionsButton) {
        captionsButton.hidden = !sources.subtitles;
    }

    let streamInfo = null;
    try {
        streamInfo = await fetchStreamInfo(movie.id);
    } catch (error) {
        console.warn('Stream info unavailable', error);
    }

    const manifestUrl = streamInfo?.manifestUrl || sources.hls;
    const fallbackMp4 = streamInfo?.fallbackMp4 || sources.mp4;
    const qualities = Array.isArray(streamInfo?.qualities) ? streamInfo.qualities : [];
    const hlsAvailable = Boolean(manifestUrl);

    populateQualitySelect(qualities, hlsAvailable);

    if (manifestUrl) {
        const canPlayNativeHls = movieVideo.canPlayType('application/vnd.apple.mpegurl');
        const hasHlsJs = typeof window.Hls !== 'undefined';

        if (hasHlsJs && !canPlayNativeHls) {
            hlsInstance = new window.Hls({
                startLevel: -1
            });
            hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
                if (qualitySelect) {
                    const levelOptions = hlsInstance.levels
                        .map((level, index) => ({ index, height: level.height || 0 }))
                        .filter((item) => item.height > 0);
                    if (levelOptions.length > 0) {
                        const currentOptions = ['<option value="auto">Auto</option>'];
                        currentOptions.push(...levelOptions.map((level) => `<option value="${level.height}">${level.height}p</option>`));
                        qualitySelect.innerHTML = currentOptions.join('');
                    }
                }
            });
            hlsInstance.loadSource(manifestUrl);
            hlsInstance.attachMedia(movieVideo);
            hlsInstance.on(window.Hls.Events.ERROR, (_, data) => {
                if (data?.fatal) {
                    console.warn('HLS fatal error', data);
                    movieVideo.src = fallbackMp4;
                    movieVideo.load();
                }
            });
        } else if (canPlayNativeHls) {
            movieVideo.src = manifestUrl;
            movieVideo.load();
        } else {
            movieVideo.src = fallbackMp4;
            movieVideo.load();
        }
    } else {
        movieVideo.src = fallbackMp4;
        movieVideo.load();
    }

    if (sources.subtitles) {
        const existingTrack = movieVideo.querySelector('track');
        if (existingTrack) {
            existingTrack.remove();
        }

        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = 'Español';
        track.srclang = 'es';
        track.src = sources.subtitles;
        track.default = true;
        movieVideo.appendChild(track);
    }

    movieVideo.addEventListener('loadedmetadata', restoreWatchProgress, { once: true });
};

const togglePlayback = async () => {
    if (!movieVideo) {
        return;
    }

    if (movieVideo.paused || movieVideo.ended) {
        try {
            await movieVideo.play();
        } catch (error) {
            console.warn('Playback blocked', error);
        }
    } else {
        movieVideo.pause();
    }

    updatePlayerChrome();
};

const toggleMute = () => {
    if (!movieVideo) {
        return;
    }

    movieVideo.muted = !movieVideo.muted;

    if (!movieVideo.muted && Number(volumeInput?.value) === 0) {
        movieVideo.volume = 0.5;
        if (volumeInput) {
            volumeInput.value = '50';
        }
    }

    updateVolumeChrome();
};

const toggleFullscreen = async () => {
    const target = playerStage || movieVideo;

    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
        }

        if (target?.requestFullscreen) {
            await target.requestFullscreen();
        } else if (movieVideo?.webkitEnterFullscreen) {
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
    movieTagline.textContent = movie.tagline || 'Un clásico con una estética oscura y elegante.';
    moviePoster.src = movie.poster || FALLBACK_POSTER;
    moviePoster.alt = `Poster de ${movie.title}`;

    const backdropUrl = movie.backdrop || movie.poster;
    if (movieBackdrop) {
        movieBackdrop.style.backgroundImage = backdropUrl
            ? `linear-gradient(180deg, rgba(2, 1, 5, 0.1), rgba(2, 1, 5, 0.82)), url("${backdropUrl}")`
            : 'linear-gradient(180deg, rgba(2, 1, 5, 0.1), rgba(2, 1, 5, 0.82))';
    }

    const year = parseYear(movie.release_date);
    const runtimeLabel = movie.runtime ? formatRuntime(movie.runtime) : 'Duración no disponible';
    const genres = Array.isArray(movie.genres) && movie.genres.length ? movie.genres.map((genre) => genre.name).join(' • ') : 'Cine';

    movieYear.textContent = year;
    movieRuntime.textContent = runtimeLabel;
    movieGenre.textContent = genres;

    updateMeta([year, runtimeLabel, genres.split(' • ')[0] || 'Cine']);
    updateFavoriteState();
};

const fetchMovieFromTMDB = async (id) => {
    const response = await fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${API_KEY}&language=es-ES`);

    if (!response.ok) {
        throw new Error(`TMDB responded with ${response.status}`);
    }

    return response.json();
};

const handleFavoriteToggle = () => {
    if (!currentMovie) {
        return;
    }

    const favorites = getFavorites();
    const index = favorites.indexOf(currentMovie.id);

    if (index >= 0) {
        favorites.splice(index, 1);
    } else {
        favorites.push(currentMovie.id);
    }

    setFavorites(favorites);
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

const wirePlayer = () => {
    if (!movieVideo) {
        return;
    }

    movieVideo.addEventListener('loadedmetadata', updateProgressChrome);
    movieVideo.addEventListener('durationchange', updateProgressChrome);
    movieVideo.addEventListener('timeupdate', updateProgressChrome);
    movieVideo.addEventListener('play', updatePlayerChrome);
    movieVideo.addEventListener('pause', updatePlayerChrome);
    movieVideo.addEventListener('ended', updatePlayerChrome);
    movieVideo.addEventListener('volumechange', () => {
        updateVolumeChrome();
        updatePlayerChrome();
    });
    movieVideo.addEventListener('waiting', () => {
        if (playerStatus) {
            playerStatus.textContent = 'Cargando...';
        }
        showPlayerLoader();
    });
    movieVideo.addEventListener('playing', () => {
        if (playerStatus) {
            playerStatus.textContent = 'Reproduciendo';
        }
        hidePlayerLoader();
    });
    movieVideo.addEventListener('loadeddata', hidePlayerLoader);
    movieVideo.addEventListener('canplay', hidePlayerLoader);
    movieVideo.addEventListener('error', hidePlayerLoader);
    movieVideo.addEventListener('timeupdate', () => saveWatchProgress(false));
    movieVideo.addEventListener('pause', () => saveWatchProgress(true));
    movieVideo.addEventListener('seeking', () => saveWatchProgress(false));
    movieVideo.addEventListener('ended', () => saveWatchProgress(true));

    overlayPlayButton?.addEventListener('click', togglePlayback);
    playPauseButton?.addEventListener('click', togglePlayback);
    muteButton?.addEventListener('click', toggleMute);
    fullscreenButton?.addEventListener('click', toggleFullscreen);

    captionsButton?.addEventListener('click', () => {
        const track = movieVideo.textTracks?.[0];
        if (!track) {
            return;
        }

        track.mode = track.mode === 'showing' ? 'disabled' : 'showing';
    });

    progressInput?.addEventListener('input', () => {
        const duration = movieVideo.duration || 0;
        if (!duration) {
            return;
        }

        movieVideo.currentTime = duration * (Number(progressInput.value) / 1000);
        updateProgressChrome();
    });

    volumeInput?.addEventListener('input', () => {
        movieVideo.volume = Number(volumeInput.value) / 100;
        movieVideo.muted = Number(volumeInput.value) === 0;
        updateVolumeChrome();
    });

    qualitySelect?.addEventListener('change', async () => {
        if (!currentMovie) {
            return;
        }

        if (!hlsInstance) {
            if (qualitySelect.value === 'mp4') {
                movieVideo.src = currentMovie.videoSrc || DEFAULT_VIDEO_SOURCE;
                movieVideo.load();
            }
            return;
        }

        if (qualitySelect.value === 'auto') {
            hlsInstance.currentLevel = -1;
            hlsInstance.loadLevel = -1;
            return;
        }

        const targetHeight = Number(qualitySelect.value);
        const levelIndex = hlsInstance.levels.findIndex((level) => Number(level.height) === targetHeight);
        if (levelIndex >= 0) {
            hlsInstance.currentLevel = levelIndex;
        }

        try {
            await movieVideo.play();
        } catch {
            // autoplay can be blocked
        }
    });

    movieVideo.addEventListener('click', togglePlayback);

    playerStage?.addEventListener('dblclick', toggleFullscreen);

    document.addEventListener('fullscreenchange', () => {
        if (playerStage) {
            playerStage.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement));
        }
    });
};

const bootstrap = async () => {
    setReady();
    wirePlayer();

    if (backLink) {
        backLink.addEventListener('click', (event) => {
            event.preventDefault();
            navigateWithTransition('index.html');
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
        movieTitle.textContent = 'Película no encontrada';
        movieDescription.textContent = 'El ID de la película no es válido.';
        updateMeta(['N/A', 'N/A', 'Cine']);
        updateFavoriteState();
        hideMoviePageLoader();
        return;
    }

    try {
        const movie = normalizeMovie(await fetchMovieFromTMDB(movieId));
        applyMovie(movie);
        syncPreferenceEvent({
            type: 'view',
            movie
        });
        await setVideoSource(movie);

        if (movieVideo) {
            movieVideo.currentTime = 0;
            movieVideo.muted = params.get('autoplay') === '1';
            movieVideo.volume = 1;
        }

        if (volumeInput) {
            volumeInput.value = '100';
        }

        updateProgressChrome();
        updateVolumeChrome();
        updatePlayerChrome();
        hideMoviePageLoader();

        if (params.get('autoplay') === '1') {
            try {
                await movieVideo.play();
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
            title: `Película ${movieId}`,
            description: 'No se pudo cargar la información desde TMDB.',
            tagline: 'Contenido temporal mientras se resuelve la conexión.',
            poster: '',
            backdrop: '',
            release_date: '',
            runtime: 0,
            genres: []
        };

        applyMovie(fallbackMovie);
        await setVideoSource(fallbackMovie);
        updateProgressChrome();
        updateVolumeChrome();
        updatePlayerChrome();
        hideMoviePageLoader();
    }
};

bootstrap();
