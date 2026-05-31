const FEATURED_MOVIE_IDS = [653, 19, 962, 961, 10098, 643, 22596, 40574, 701, 23282];
const API_KEY = 'b24af203b14e23f8c91844baae37cfab';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const FALLBACK_POSTER = 'https://via.placeholder.com/500x750?text=No+Poster';
const FAVORITES_KEY = window.BugaAuth?.getProfileStorageKey?.('buga-favorites') || 'buga-favorites';
const WATCH_HISTORY_KEY = window.BugaAuth?.getProfileStorageKey?.('buga-watch-history') || 'buga-watch-history';
const HERO_SLIDE_INTERVAL = 6500;
const TRENDING_VISIBLE_COUNT = 8;
const TRENDING_ROTATION_INTERVAL = 5400;
const TRAILER_HOVER_DELAY = 240;

const heroSection = document.getElementById('banner');
const heroBackdropA = document.getElementById('heroBackdropA');
const heroBackdropB = document.getElementById('heroBackdropB');
const heroTitle = document.getElementById('heroTitle');
const heroDescription = document.getElementById('heroDescription');
const heroPrimaryAction = document.getElementById('heroPrimaryAction');
const heroSecondaryAction = document.getElementById('heroSecondaryAction');
const heroMeta = document.getElementById('heroMeta');
const heroIndicators = document.getElementById('heroIndicators');
const heroPrevButton = document.getElementById('heroPrev');
const heroNextButton = document.getElementById('heroNext');
const heroBadge = document.getElementById('heroBadge');
const heroKicker = document.getElementById('heroKicker');
const heroContent = document.querySelector('.hero-content');
const moviesGrid = document.getElementById('moviesGrid');
const trendingGrid = document.getElementById('trendingGrid');
const trendingSection = document.getElementById('trending');
const continueWatchingSection = document.getElementById('continueWatchingSection');
const continueWatchingGrid = document.getElementById('continueWatchingGrid');
const pageLoader = document.getElementById('pageLoader');
const searchInput = document.getElementById('siteSearch');
const searchResults = document.getElementById('searchResults');
const menuOverlay = document.getElementById('menuOverlay');
const siteHeader = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.getElementById('primaryNav');
const carousel = document.querySelector('.movies-carousel');
const carouselButtons = document.querySelectorAll('[data-carousel]');
const trendingCarouselButtons = document.querySelectorAll('[data-trending-carousel]');

let featuredMoviesCache = [];
let trendingMoviesCache = [];
let trendingWindowStart = 0;
let trendingAutoplayTimerId = null;
let trailerHoverTimerId = null;
let activeTrailerCard = null;
let heroMoviesCache = [];
let heroActiveIndex = 0;
let heroActiveLayer = 'a';
let heroAutoplayTimerId = null;
let heroPaused = false;
let heroContentTimerId = null;
const activeToastKeys = new Set();
const TOAST_DURATION = 4200;
const TOAST_STACK_LIMIT = 4;
const TOAST_TYPES = {
    success: { icon: '✔', title: 'Éxito', accent: '#8c50ff' },
    error: { icon: '✖', title: 'Error', accent: '#ff5878' },
    info: { icon: 'ℹ', title: 'Información', accent: '#7b2cbf' }
};

const getToastContainer = () => {
    let container = document.getElementById('toastContainer');
    if (container) {
        return container;
    }

    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
    return container;
};

const playToastSound = () => {
    if (typeof window.AudioContext !== 'function' && typeof window.webkitAudioContext !== 'function') {
        return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 520;
    gain.gain.value = 0.0001;

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
    oscillator.stop(audioCtx.currentTime + 0.24);
};

const clearToastKey = (key) => {
    if (key && activeToastKeys.has(key)) {
        activeToastKeys.delete(key);
    }
};

const dismissToast = (toast, key, timeoutId) => {
    if (!toast || !toast.parentElement) {
        clearToastKey(key);
        return;
    }

    toast.classList.remove('is-visible');
    window.clearTimeout(timeoutId);
    window.setTimeout(() => {
        toast.remove();
        clearToastKey(key);
    }, 260);
};

const notifyToast = (options) => {
    if (typeof window.BugaToast?.show === 'function') {
        return window.BugaToast.show(options);
    }

    const payload = typeof options === 'string'
        ? { type: 'info', message: options }
        : { ...options };

    const type = payload.type && TOAST_TYPES[payload.type] ? payload.type : 'info';
    const title = payload.title || TOAST_TYPES[type].title;
    const message = String(payload.message || payload.text || '').trim();
    const key = payload.key || `${type}:${message}`;
    const icon = payload.icon || TOAST_TYPES[type].icon;
    const duration = Number(payload.duration) || TOAST_DURATION;
    const sound = Boolean(payload.sound);

    if (!message) {
        return null;
    }

    if (activeToastKeys.has(key)) {
        return null;
    }

    activeToastKeys.add(key);

    const container = getToastContainer();
    const toast = document.createElement('article');
    toast.className = `toast-card toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('data-toast-key', key);
    toast.innerHTML = `
        <div class="toast-glyph">${icon}</div>
        <div class="toast-copy">
            <p class="toast-title">${title}</p>
            <p class="toast-message">${message}</p>
        </div>
        <button class="toast-close" type="button" aria-label="Cerrar notificación">×</button>
        <span class="toast-progress"></span>
    `;

    const progress = toast.querySelector('.toast-progress');
    if (progress) {
        progress.style.animationDuration = `${duration}ms`;
    }

    const closeButton = toast.querySelector('.toast-close');
    const timeoutId = window.setTimeout(() => dismissToast(toast, key, timeoutId), duration);

    toast.addEventListener('mouseenter', () => {
        window.clearTimeout(timeoutId);
        if (progress) {
            progress.style.animationPlayState = 'paused';
        }
    });

    toast.addEventListener('mouseleave', () => {
        const restartId = window.setTimeout(() => dismissToast(toast, key, restartId), duration / 2);
        if (progress) {
            progress.style.animationPlayState = 'running';
        }
    });

    closeButton?.addEventListener('click', () => dismissToast(toast, key, timeoutId));

    if (container.firstChild) {
        container.insertBefore(toast, container.firstChild);
    } else {
        container.appendChild(toast);
    }

    window.setTimeout(() => toast.classList.add('is-visible'), 14);

    if (container.children.length > TOAST_STACK_LIMIT) {
        const lastToast = container.children[container.children.length - 1];
        if (lastToast) {
            const lastKey = lastToast.getAttribute('data-toast-key');
            dismissToast(lastToast, lastKey, 0);
        }
    }

    if (sound) {
        playToastSound();
    }

    return toast;
};

const showToast = (options) => notifyToast(options);
window.BugaToast = { show: notifyToast };
window.showToast = showToast;

const syncPreferenceEvent = (payload) => {
    window.BugaAuth?.recordPreferenceEvent?.(payload);
};

const formatYear = (releaseDate) => (releaseDate ? String(releaseDate).slice(0, 4) : 'N/A');

const preloadImage = (source) => {
    if (!source) {
        return;
    }

    const image = new Image();
    image.decoding = 'async';
    image.src = source;
};

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

const isFavoriteMovie = (movieId) => getFavorites().includes(movieId);

const getFavoriteIcon = (favorite) => (favorite ? '♥' : '♡');

const formatWatchTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '0:00';
    }

    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const shortenText = (text, limit = 110) => {
    if (!text || text.length <= limit) {
        return text || '';
    }

    return `${text.slice(0, limit).trim()}...`;
};

const createMovieCardMedia = (movie, tagLabel = '') => `
    <div class="movie-card-media">
        ${tagLabel ? `<div class="movie-card-tag">${tagLabel}</div>` : ''}
        <img class="movie-poster" src="${movie.poster || FALLBACK_POSTER}" alt="Poster de ${movie.title}" loading="lazy" decoding="async">
        <div class="movie-trailer-preview" aria-hidden="true"></div>
    </div>
`;

const getMovieDetails = async (movieId) => {
    const response = await fetch(
        `${TMDB_BASE_URL}/movie/${movieId}?api_key=${API_KEY}&language=es-ES`
    );

    if (!response.ok) {
        throw new Error(`TMDB responded with ${response.status}`);
    }

    return response.json();
};

const mapMovie = (movie) => ({
    id: movie.id,
    title: movie.title || movie.original_title || 'Película',
    poster: movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : FALLBACK_POSTER,
    backdrop: movie.backdrop_path ? `${IMAGE_BASE_URL}${movie.backdrop_path}` : '',
    description: movie.overview || 'Descripción no disponible.',
    genres: Array.isArray(movie.genres) ? movie.genres : [],
    year: formatYear(movie.release_date)
});

const buildYouTubeTrailerUrl = (videoKey) => {
    const params = new URLSearchParams({
        autoplay: '1',
        mute: '1',
        controls: '0',
        loop: '1',
        playlist: videoKey,
        playsinline: '1',
        rel: '0',
        modestbranding: '1',
        iv_load_policy: '3',
        fs: '0',
        enablejsapi: '1'
    });

    if (window.location.origin && window.location.origin !== 'null') {
        params.set('origin', window.location.origin);
        params.set('widget_referrer', window.location.href);
    }

    return `https://www.youtube.com/embed/${videoKey}?${params.toString()}`;
};

const canEmbedYoutubePreview = () =>
    window.location.protocol !== 'file:' &&
    window.location.origin &&
    window.location.origin !== 'null';

const trailerCache = new Map();

const getTrailerVideoKey = async (movieId) => {
    if (trailerCache.has(movieId)) {
        return trailerCache.get(movieId);
    }

    const requestTrailerList = async (language = '') => {
        const languageQuery = language ? `&language=${language}` : '';
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}${languageQuery}`
        );

        if (!response.ok) {
            throw new Error(`TMDB responded with ${response.status}`);
        }

        const data = await response.json();
        return Array.isArray(data.results) ? data.results : [];
    };

    const trailerPromise = (async () => {
        const primaryVideos = await requestTrailerList('en-US').catch(() => []);
        const fallbackVideos = primaryVideos.length ? [] : await requestTrailerList().catch(() => []);
        const videos = [...primaryVideos, ...fallbackVideos];

        const trailer = videos.find((video) =>
            video.site === 'YouTube' && /trailer|teaser/i.test(video.type || '')
        ) || videos.find((video) => video.site === 'YouTube');

        return trailer?.key || null;
    })();

    trailerCache.set(movieId, trailerPromise);

    const videoKey = await trailerPromise;
    trailerCache.set(movieId, videoKey);
    return videoKey;
};

const prefetchTrailerKeys = (movies = []) => {
    const uniqueMovieIds = [...new Set(
        movies
            .map((movie) => Number(movie?.id))
            .filter((movieId) => Number.isFinite(movieId) && movieId > 0)
    )];

    const schedule = () => {
        uniqueMovieIds.forEach((movieId) => {
            if (trailerCache.has(movieId)) {
                return;
            }

            getTrailerVideoKey(movieId).catch(() => null);
        });
    };

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(schedule, { timeout: 1200 });
        return;
    }

    window.setTimeout(schedule, 250);
};

const buildHeroMeta = (movie) => {
    const chips = [];
    if (movie.year && movie.year !== 'N/A') {
        chips.push(movie.year);
    }
    if (movie.genres?.length) {
        chips.push(movie.genres.slice(0, 2).join(' • '));
    }
    if (movie.voteAverage) {
        chips.push(`★ ${movie.voteAverage.toFixed(1)}`);
    }
    return chips;
};

const normalizeSearchText = (value) =>
    String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const filterFeaturedMovies = (query) => {
    const normalizedQuery = normalizeSearchText(query);

    return featuredMoviesCache.filter((movie) => {
        const searchableText = normalizeSearchText([
            movie.title,
            movie.description,
            movie.year,
            ...(movie.genres || []).map((genre) => genre.name).filter(Boolean)
        ].join(' '));

        return searchableText.includes(normalizedQuery);
    });
};

const getSearchPanelContent = (state, movies = [], query = '') => {
    if (!movies.length) {
        return `
            <div class="search-results-empty">
                <strong>No se encontraron resultados</strong>
                <p>Intenta con otro título o una palabra más corta.</p>
            </div>
        `;
    }

    return `
        <div class="search-results-header">
            <h3>Resultados</h3>
            <span>${movies.length} opciones</span>
        </div>
        ${movies
            .map((movie) => `
                <button class="search-result-item" type="button" data-search-movie-id="${movie.id}" aria-label="Abrir ${movie.title}">
                    <img class="search-result-poster" src="${movie.poster || FALLBACK_POSTER}" alt="" loading="lazy" decoding="async">
                    <div class="search-result-copy">
                        <strong>${movie.title}</strong>
                        <div class="search-result-meta">
                            <span>${movie.year}</span>
                        </div>
                        <p>${shortenText(movie.description, 90)}</p>
                    </div>
                </button>
            `)
            .join('')}
    `;
};

const createCard = (movie) => {
    const genreLabel = movie.genres?.[0]?.name || 'Cine';
    const favorite = isFavoriteMovie(movie.id);

    return `
        <article class="movie-card" data-movie-id="${movie.id}" tabindex="0" role="link" aria-label="Abrir ${movie.title}">
            ${createMovieCardMedia(movie)}
            <div class="movie-card-body">
                <p class="movie-card-kicker">${genreLabel} • ${movie.year}</p>
                <h3>${movie.title}</h3>
                <p>${shortenText(movie.description, 110)}</p>
                <div class="movie-card-actions">
                    <button class="favorite-toggle ${favorite ? 'is-active' : ''}" type="button" data-favorite-toggle="${movie.id}" data-movie-title="${movie.title}" aria-pressed="${favorite}" aria-label="${favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                        <span class="favorite-icon" aria-hidden="true">${getFavoriteIcon(favorite)}</span>
                    </button>
                    <button class="ver-btn" type="button" data-movie-id="${movie.id}" data-title="${movie.title}">Ver</button>
                </div>
            </div>
        </article>
    `;
};

const renderLoadingState = () => {
    if (!moviesGrid) {
        return;
    }

    moviesGrid.innerHTML = FEATURED_MOVIE_IDS
        .map(() => `
            <article class="movie-card movie-card-skeleton" aria-hidden="true">
                <div class="movie-poster movie-poster-skeleton"></div>
                <div class="movie-card-body">
                    <div class="skeleton-line skeleton-line-sm"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line skeleton-line-short"></div>
                    <div class="movie-card-actions">
                        <div class="skeleton-button"></div>
                    </div>
                </div>
            </article>
        `)
        .join('');
};

const showPageLoader = () => {
    document.body.classList.add('is-loading');
    if (pageLoader) {
        pageLoader.setAttribute('aria-busy', 'true');
    }
};

const hidePageLoader = () => {
    document.body.classList.remove('is-loading');
    if (pageLoader) {
        pageLoader.setAttribute('aria-busy', 'false');
    }
};

const renderMovies = (movies) => {
    if (!moviesGrid) {
        return;
    }

    closeTrailerPreview();
    moviesGrid.innerHTML = movies.map(createCard).join('');
};

const normalizeWatchEntry = (entry) => ({
    id: Number(entry.id),
    title: entry.title || 'Película',
    poster: entry.poster || FALLBACK_POSTER,
    description: entry.description || 'Descripción no disponible.',
    genres: Array.isArray(entry.genres) ? entry.genres : [],
    year: entry.year || 'N/A',
    currentTime: Number(entry.currentTime) || 0,
    duration: Number(entry.duration) || 0,
    progress: Math.max(0, Math.min(100, Number(entry.progress) || 0)),
    lastViewed: entry.lastViewed || new Date().toISOString()
});

const getContinueWatchingItems = () => {
    return getWatchHistory()
        .map(normalizeWatchEntry)
        .filter((entry) => Number.isFinite(entry.id) && entry.progress > 0 && entry.progress < 95)
        .sort((left, right) => new Date(right.lastViewed) - new Date(left.lastViewed));
};

const createContinueWatchingCard = (entry) => `
    <article class="movie-card continue-card" data-movie-id="${entry.id}" tabindex="0" role="link" aria-label="Continuar ${entry.title}">
        <div class="continue-card-media">
            ${createMovieCardMedia(entry)}
            <button class="continue-remove" type="button" data-remove-watch="${entry.id}" aria-label="Quitar de continuar viendo">×</button>
            <div class="continue-progress-overlay">
                <span>${entry.progress}% visto</span>
                <span>${formatWatchTime(entry.currentTime)} / ${formatWatchTime(entry.duration)}</span>
            </div>
        </div>
        <div class="movie-card-body">
            <p class="movie-card-kicker">${(entry.genres?.[0]?.name || 'Cine')} • ${entry.year}</p>
            <h3>${entry.title}</h3>
            <p>${shortenText(entry.description, 110)}</p>
            <div class="continue-progress">
                <div class="continue-progress-meta">
                    <span>Continuar viendo</span>
                    <span>${new Date(entry.lastViewed).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>
                </div>
                <div class="continue-progress-bar">
                    <span style="width: ${entry.progress}%"></span>
                </div>
            </div>
            <div class="movie-card-actions">
                <button class="ver-btn" type="button" data-movie-id="${entry.id}">Continuar</button>
            </div>
        </div>
    </article>
`;

const renderContinueWatching = () => {
    if (!continueWatchingGrid || !continueWatchingSection) {
        return;
    }

    closeTrailerPreview();
    const items = getContinueWatchingItems();

    if (!items.length) {
        continueWatchingSection.hidden = true;
        continueWatchingGrid.innerHTML = '';
        return;
    }

    continueWatchingSection.hidden = false;
    continueWatchingGrid.innerHTML = items.map(createContinueWatchingCard).join('');
};

const clearTrailerPreview = async (card) => {
    if (!card) {
        return;
    }

    if (activeTrailerCard === card) {
        activeTrailerCard = null;
    }

    const previewLayer = card.querySelector('.movie-trailer-preview');
    if (previewLayer) {
        previewLayer.innerHTML = '';
    }

    card.classList.remove('is-previewing');
};

const openTrailerPreview = async (card) => {
    if (!card || !card.isConnected) {
        return;
    }

    const movieId = Number(card.dataset.movieId);
    if (Number.isNaN(movieId)) {
        return;
    }

    activeTrailerCard = card;
    card.classList.add('is-previewing', 'is-preview-loading');

    const previewLayer = card.querySelector('.movie-trailer-preview');
    if (!previewLayer) {
        card.classList.remove('is-preview-loading');
        return;
    }

    previewLayer.innerHTML = `
        <div class="movie-trailer-loading">
            <div class="page-loader-spinner" aria-hidden="true"></div>
            <span>Preparando tráiler</span>
        </div>
    `;

    try {
        const videoKey = await getTrailerVideoKey(movieId);

        if (!videoKey || activeTrailerCard !== card || !card.isConnected) {
            return;
        }

        if (!canEmbedYoutubePreview()) {
            previewLayer.innerHTML = `
                <img class="movie-trailer-still" src="https://img.youtube.com/vi/${videoKey}/hqdefault.jpg" alt="" aria-hidden="true">
                <div class="movie-trailer-overlay"></div>
                <div class="movie-trailer-fallback">
                    <span>Vista previa con YouTube bloqueada en archivos locales</span>
                    <button class="movie-trailer-open-btn" type="button" data-open-trailer="${videoKey}">Abrir tráiler</button>
                </div>
            `;
            return;
        }

        previewLayer.innerHTML = `
            <iframe
                src="${buildYouTubeTrailerUrl(videoKey)}"
                title="Vista previa de ${card.dataset.title || 'la película'}"
                loading="lazy"
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerpolicy="origin-when-cross-origin"
            ></iframe>
            <div class="movie-trailer-overlay"></div>
        `;
    } catch (error) {
        console.warn('Trailer preview failed', error);
        if (activeTrailerCard === card && card.isConnected) {
            previewLayer.innerHTML = `
                <div class="movie-trailer-fallback">
                    <span>Sin tráiler disponible</span>
                </div>
            `;
        }
    } finally {
        card.classList.remove('is-preview-loading');
    }
};

const scheduleTrailerPreview = (card) => {
    if (!card || window.matchMedia('(hover: none), (pointer: coarse)').matches) {
        return;
    }

    window.clearTimeout(trailerHoverTimerId);
    const movieId = Number(card.dataset.movieId);
    const hasCachedTrailer = Number.isFinite(movieId) && trailerCache.has(movieId);
    const hoverDelay = hasCachedTrailer ? 80 : TRAILER_HOVER_DELAY;
    trailerHoverTimerId = window.setTimeout(() => {
        openTrailerPreview(card);
    }, hoverDelay);
};

const closeTrailerPreview = (card) => {
    window.clearTimeout(trailerHoverTimerId);

    if (activeTrailerCard && (!card || activeTrailerCard === card)) {
        clearTrailerPreview(activeTrailerCard);
    }
};

const wireTrailerPreviewToGrid = (grid) => {
    if (!grid) {
        return;
    }

    grid.addEventListener('pointerover', (event) => {
        if (event.pointerType && event.pointerType !== 'mouse') {
            return;
        }

        const card = event.target.closest('.movie-card');
        if (!card || !grid.contains(card)) {
            return;
        }

        if (card === activeTrailerCard) {
            return;
        }

        scheduleTrailerPreview(card);
    });

    grid.addEventListener('pointerout', (event) => {
        if (event.pointerType && event.pointerType !== 'mouse') {
            return;
        }

        const card = event.target.closest('.movie-card');
        if (!card || !grid.contains(card)) {
            return;
        }

        const relatedTarget = event.relatedTarget;
        if (relatedTarget && card.contains(relatedTarget)) {
            return;
        }

        closeTrailerPreview(card);
    });

    grid.addEventListener('click', (event) => {
        const openTrailerButton = event.target.closest('[data-open-trailer]');
        if (!openTrailerButton) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const videoKey = openTrailerButton.dataset.openTrailer;
        if (videoKey) {
            window.open(`https://www.youtube.com/watch?v=${videoKey}`, '_blank', 'noopener,noreferrer');
        }
    });
};

const setHeroBackdrop = (movie) => {
    const activeBackdrop = heroActiveLayer === 'a' ? heroBackdropA : heroBackdropB;
    const inactiveBackdrop = heroActiveLayer === 'a' ? heroBackdropB : heroBackdropA;

    if (!activeBackdrop || !inactiveBackdrop) {
        return;
    }

    const backdropSource = movie?.backdrop || FALLBACK_POSTER;
    inactiveBackdrop.style.backgroundImage = `linear-gradient(180deg, rgba(4, 1, 9, 0.08), rgba(4, 1, 9, 0.68)), url('${backdropSource}')`;
    requestAnimationFrame(() => {
        inactiveBackdrop.classList.add('is-visible');
        activeBackdrop.classList.remove('is-visible');
    });
    heroActiveLayer = heroActiveLayer === 'a' ? 'b' : 'a';

    preloadImage(backdropSource);
};

const updateHeroContent = (movie) => {
    if (!movie) {
        return;
    }

    heroContent?.classList.add('is-transitioning');

    window.clearTimeout(heroContentTimerId);
    heroContentTimerId = window.setTimeout(() => {
        if (heroBadge) {
            heroBadge.textContent = movie.badge || 'Tendencia';
        }
        if (heroKicker) {
            heroKicker.textContent = '';
        }
        if (heroTitle) {
            heroTitle.textContent = movie.title;
        }
        if (heroDescription) {
            heroDescription.textContent = movie.description;
        }
        if (heroPrimaryAction) {
            heroPrimaryAction.href = `/pages/movie.html?id=${movie.id}`;
            heroPrimaryAction.textContent = 'Ver ahora';
        }
        if (heroSecondaryAction) {
            heroSecondaryAction.href = `/pages/movie.html?id=${movie.id}`;
            heroSecondaryAction.textContent = 'Más información';
        }
        if (heroMeta) {
            const metaChips = buildHeroMeta(movie);
            heroMeta.innerHTML = metaChips.map((item) => `<span>${item}</span>`).join('');
        }

        heroContent?.classList.remove('is-transitioning');
    }, 180);
};

const renderHeroIndicators = () => {
    if (!heroIndicators) {
        return;
    }

    heroIndicators.innerHTML = heroMoviesCache
        .map((movie, index) => `
            <button
                class="hero-indicator ${index === heroActiveIndex ? 'is-active' : ''}"
                type="button"
                data-hero-index="${index}"
                aria-label="Ver ${movie.title}"
                aria-current="${index === heroActiveIndex ? 'true' : 'false'}"
            ></button>
        `)
        .join('');
};

const updateHeroIndicatorState = () => {
    if (!heroIndicators) {
        return;
    }

    heroIndicators.querySelectorAll('.hero-indicator').forEach((indicator) => {
        const isActive = Number(indicator.dataset.heroIndex) === heroActiveIndex;
        indicator.classList.toggle('is-active', isActive);
        indicator.setAttribute('aria-current', String(isActive));
    });
};

const setHeroSlide = (nextIndex, direction = 1, immediate = false) => {
    if (!heroMoviesCache.length) {
        return;
    }

    const totalSlides = heroMoviesCache.length;
    heroActiveIndex = (nextIndex + totalSlides) % totalSlides;
    const movie = heroMoviesCache[heroActiveIndex];

    if (!movie) {
        return;
    }

    if (!immediate) {
        heroContent?.classList.add('is-transitioning');
    }

    setHeroBackdrop(movie);
    updateHeroContent(movie);
    updateHeroIndicatorState();

    const nextMovie = heroMoviesCache[(heroActiveIndex + 1) % totalSlides];
    if (nextMovie) {
        preloadImage(nextMovie.backdrop || FALLBACK_POSTER);
    }
};

const startHeroAutoplay = () => {
    if (!heroMoviesCache.length || heroMoviesCache.length < 2 || heroPaused) {
        return;
    }

    stopHeroAutoplay();
    heroAutoplayTimerId = window.setInterval(() => {
        setHeroSlide(heroActiveIndex + 1, 1);
    }, HERO_SLIDE_INTERVAL);
};

const stopHeroAutoplay = () => {
    window.clearInterval(heroAutoplayTimerId);
    heroAutoplayTimerId = null;
};

const wireHeroControls = () => {
    if (heroPrevButton) {
        heroPrevButton.addEventListener('click', () => {
            setHeroSlide(heroActiveIndex - 1, -1);
            startHeroAutoplay();
        });
    }

    if (heroNextButton) {
        heroNextButton.addEventListener('click', () => {
            setHeroSlide(heroActiveIndex + 1, 1);
            startHeroAutoplay();
        });
    }

    if (heroIndicators) {
        heroIndicators.addEventListener('click', (event) => {
            const indicator = event.target.closest('[data-hero-index]');
            if (!indicator) {
                return;
            }

            const nextIndex = Number(indicator.dataset.heroIndex);
            if (!Number.isNaN(nextIndex)) {
                setHeroSlide(nextIndex, nextIndex > heroActiveIndex ? 1 : -1);
                startHeroAutoplay();
            }
        });
    }

    if (heroSection) {
        heroSection.addEventListener('pointerenter', () => {
            heroPaused = true;
            stopHeroAutoplay();
        });

        heroSection.addEventListener('pointerleave', () => {
            heroPaused = false;
            startHeroAutoplay();
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopHeroAutoplay();
            return;
        }

        startHeroAutoplay();
    });
};

const renderHeroFallback = () => {
    heroMoviesCache = [{
        id: 0,
        title: 'Películas y Series',
        description: 'Disfruta del mejor contenido con una experiencia cinematográfica premium.',
        backdrop: FALLBACK_POSTER,
        year: 'N/A',
        genres: ['Streaming'],
        voteAverage: 0,
        badge: 'Buga'
    }];

    renderHeroIndicators();
    setHeroSlide(0, 1, true);
    stopHeroAutoplay();
};

const loadHeroSlides = async () => {
    if (!heroSection) {
        return;
    }

    try {
        const catalogMovies = featuredMoviesCache
            .filter((movie) => movie && movie.id)
            .slice(0, 6)
            .map((movie, index) => ({
                id: movie.id,
                title: movie.title || 'Película destacada',
                description: movie.description || 'Disfruta del catálogo de Buga.',
                backdrop: movie.backdrop || movie.poster || FALLBACK_POSTER,
                poster: movie.poster || FALLBACK_POSTER,
                year: movie.year || 'N/A',
                genres: Array.isArray(movie.genres)
                    ? movie.genres.map((genre) => genre?.name).filter(Boolean)
                    : [],
                voteAverage: Number(movie.voteAverage || movie.vote_average) || 0,
                badge: index === 0 ? 'Catálogo Buga' : 'Destacada'
            }));

        if (!catalogMovies.length) {
            renderHeroFallback();
            return;
        }

        heroMoviesCache = catalogMovies;
        renderHeroIndicators();
        setHeroSlide(0, 1, true);
        prefetchTrailerKeys(catalogMovies);
        startHeroAutoplay();
    } catch (error) {
        console.warn('Hero slides failed', error);
        notifyToast({
            type: 'error',
            title: 'Hero no disponible',
            message: 'No pudimos cargar el hero dinámico del catálogo.'
        });
        renderHeroFallback();
    }
};

const getTrendingWindow = () => {
    if (!trendingMoviesCache.length) {
        return [];
    }

    const total = trendingMoviesCache.length;
    const windowSize = Math.min(TRENDING_VISIBLE_COUNT, total);

    return Array.from({ length: windowSize }, (_, index) => {
        const movieIndex = (trendingWindowStart + index) % total;
        return trendingMoviesCache[movieIndex];
    });
};

const renderTrendingCard = (movie, index) => `
    <article class="movie-card trending-card" data-movie-id="${movie.id}" tabindex="0" role="link" aria-label="Abrir ${movie.title}">
        ${createMovieCardMedia(movie, movie.badge || ['Trending', 'Hot', 'Popular'][index % 3])}
        <div class="movie-card-body">
            <p class="movie-card-kicker">${(movie.genres?.[0] || 'Cine')} • ${movie.year}</p>
            <h3>${movie.title}</h3>
            <p>${shortenText(movie.description, 110)}</p>
            <div class="movie-card-actions">
                <button class="favorite-toggle ${isFavoriteMovie(movie.id) ? 'is-active' : ''}" type="button" data-favorite-toggle="${movie.id}" data-movie-title="${movie.title}" aria-pressed="${isFavoriteMovie(movie.id)}" aria-label="${isFavoriteMovie(movie.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                    <span class="favorite-icon" aria-hidden="true">${getFavoriteIcon(isFavoriteMovie(movie.id))}</span>
                </button>
                <button class="ver-btn" type="button" data-movie-id="${movie.id}" data-title="${movie.title}">Ver</button>
            </div>
        </div>
    </article>
`;

const renderTrendingMovies = (options = {}) => {
    if (!trendingGrid) {
        return;
    }

    const { animate = false } = options;
    const visibleMovies = getTrendingWindow();

    if (!visibleMovies.length) {
        trendingGrid.innerHTML = '<p class="movie-error">No se pudieron cargar las tendencias.</p>';
        return;
    }

    if (animate) {
        trendingGrid.classList.add('is-refreshing');
        window.clearTimeout(trendingGrid._refreshTimerId);
        trendingGrid._refreshTimerId = window.setTimeout(() => {
            closeTrailerPreview();
            trendingGrid.innerHTML = visibleMovies.map(renderTrendingCard).join('');
            trendingGrid.classList.remove('is-refreshing');
        }, 180);
        return;
    }

    closeTrailerPreview();
    trendingGrid.innerHTML = visibleMovies.map(renderTrendingCard).join('');
};

const advanceTrendingWindow = (direction = 1) => {
    if (!trendingMoviesCache.length) {
        return;
    }

    const total = trendingMoviesCache.length;
    trendingWindowStart = (trendingWindowStart + direction + total) % total;
    renderTrendingMovies({ animate: true });
};

const startTrendingAutoplay = () => {
    if (!trendingMoviesCache.length || trendingMoviesCache.length < 2) {
        return;
    }

    window.clearInterval(trendingAutoplayTimerId);
    trendingAutoplayTimerId = window.setInterval(() => {
        advanceTrendingWindow(1);
    }, TRENDING_ROTATION_INTERVAL);
};

const stopTrendingAutoplay = () => {
    window.clearInterval(trendingAutoplayTimerId);
    trendingAutoplayTimerId = null;
};

const wireTrendingControls = () => {
    if (trendingCarouselButtons) {
        trendingCarouselButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const direction = button.dataset.trendingCarousel === 'prev' ? -1 : 1;
                advanceTrendingWindow(direction);
                startTrendingAutoplay();
            });
        });
    }

    if (trendingSection) {
        trendingSection.addEventListener('pointerenter', stopTrendingAutoplay);
        trendingSection.addEventListener('pointerleave', startTrendingAutoplay);
    }
};

const loadTrendingMovies = async () => {
    if (!trendingGrid) {
        return;
    }

    try {
        trendingMoviesCache = featuredMoviesCache
            .filter((movie) => movie && movie.id)
            .map((movie, index) => ({
                id: movie.id,
                title: movie.title || 'Tendencia',
                poster: movie.poster || FALLBACK_POSTER,
                backdrop: movie.backdrop || movie.poster || FALLBACK_POSTER,
                description: movie.description || 'Lo más visto del catálogo de Buga.',
                genres: Array.isArray(movie.genres)
                    ? movie.genres.map((genre) => genre?.name).filter(Boolean)
                    : [],
                year: movie.year || 'N/A',
                voteAverage: Number(movie.voteAverage || 0),
                popularity: Number(movie.popularity || 0),
                badge: index === 0 ? 'Trending' : index % 3 === 0 ? 'Hot' : 'Popular'
            }))
            .slice(0, TRENDING_VISIBLE_COUNT);

        trendingWindowStart = 0;
        renderTrendingMovies();
        prefetchTrailerKeys(trendingMoviesCache);
        startTrendingAutoplay();
    } catch (error) {
        console.warn('Trending movies failed', error);
        notifyToast({
            type: 'error',
            title: 'Tendencias no disponibles',
            message: 'Hubo un problema al cargar la sección Trending.'
        });
        trendingMoviesCache = [];
        renderTrendingMovies();
    }
};

const removeContinueWatching = (movieId) => {
    const history = getWatchHistory().filter((entry) => Number(entry.id) !== Number(movieId));
    setWatchHistory(history);
    renderContinueWatching();
    notifyToast({
        type: 'info',
        title: 'Continuar viendo actualizada',
        message: 'Se eliminó esta película de tu lista de seguimiento.'
    });
};

const renderSearchResults = (state, movies = [], query = '') => {
    if (!searchResults) {
        return;
    }

    searchResults.innerHTML = getSearchPanelContent(state, movies, query);
    searchResults.hidden = false;
    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'true');
    }
};

const hideSearchResults = () => {
    if (!searchResults) {
        return;
    }

    searchResults.hidden = true;
    searchResults.innerHTML = '';
    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'false');
    }
};

const refreshFeaturedGrid = (query = '') => {
    if (!moviesGrid) {
        return;
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
        renderMovies(featuredMoviesCache);
        return;
    }

    const filteredMovies = filterFeaturedMovies(trimmedQuery);

    if (filteredMovies.length > 0) {
        renderMovies(filteredMovies);
    } else {
        moviesGrid.innerHTML = '<p class="movie-error">No se encontraron resultados.</p>';
    }
};

const updateFavoriteButton = (button, movieId) => {
    const favorite = isFavoriteMovie(movieId);
    button.classList.toggle('is-active', favorite);
    button.setAttribute('aria-pressed', String(favorite));
    button.setAttribute('aria-label', favorite ? 'Quitar de favoritos' : 'Agregar a favoritos');
    const icon = button.querySelector('.favorite-icon');
    if (icon) {
        icon.textContent = getFavoriteIcon(favorite);
    }
};

const toggleFavorite = (movieId) => {
    const favorites = getFavorites();
    const index = favorites.indexOf(movieId);
    const isRemoving = index >= 0;

    if (isRemoving) {
        favorites.splice(index, 1);
    } else {
        favorites.push(movieId);
    }

    setFavorites(favorites);

    return isRemoving ? 'removed' : 'added';
};

const handleSearchInput = () => {
    if (!searchInput) {
        return;
    }

    const query = searchInput.value.trim();
    refreshFeaturedGrid(query);

    if (!query) {
        hideSearchResults();
        return;
    }

    const filteredMovies = filterFeaturedMovies(query);
    const noResultsToastKey = `${query.toLowerCase()}`;

    renderSearchResults(filteredMovies.length ? 'results' : 'empty', filteredMovies, query);

    if (!filteredMovies.length && noResultsToastKey !== handleSearchInput.lastNoResultsToastKey) {
        handleSearchInput.lastNoResultsToastKey = noResultsToastKey;
        notifyToast({
            type: 'info',
            title: 'Sin resultados',
            message: 'No encontramos coincidencias en el catálogo de Buga.',
            key: `search:${noResultsToastKey}`
        });
        return;
    }

    if (filteredMovies.length) {
        handleSearchInput.lastNoResultsToastKey = '';
    }
};

const wireSearch = () => {
    if (!searchInput || !searchResults) {
        return;
    }

    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', () => {
        const query = searchInput.value.trim();
        if (query && searchResults.innerHTML) {
            searchResults.hidden = false;
        }
    });

    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            searchInput.value = '';
            handleSearchInput();
            searchInput.blur();
        }
    });

    searchResults.addEventListener('click', (event) => {
        const resultButton = event.target.closest('[data-search-movie-id]');
        if (!resultButton) {
            return;
        }

        const movieId = Number(resultButton.dataset.searchMovieId);
        if (!Number.isNaN(movieId)) {
            hideSearchResults();
            navigateToMovie(movieId);
        }
    });

    document.addEventListener('click', (event) => {
        if (!searchResults || !searchInput) {
            return;
        }

        const clickedInsideSearch = searchInput.contains(event.target) || searchResults.contains(event.target);
        if (!clickedInsideSearch) {
            hideSearchResults();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideSearchResults();
        }
    });
};

const loadFeaturedMovies = async (options = {}) => {
    const { useLoader = true } = options;

    if (useLoader) {
        showPageLoader();
    }
    renderLoadingState();

    try {
        const results = await Promise.allSettled(
            FEATURED_MOVIE_IDS.map(async (movieId) => {
                const movie = await getMovieDetails(movieId);
                return mapMovie(movie);
            })
        );

        const movies = results
            .filter((result) => result.status === 'fulfilled' && result.value)
            .map((result) => result.value);

        if (movies.length === 0) {
            moviesGrid.innerHTML = '<p class="movie-error">No se pudieron cargar las películas.</p>';
            return;
        }

        featuredMoviesCache = movies;
        renderMovies(movies);
        prefetchTrailerKeys(movies);
        if (searchInput?.value?.trim()) {
            handleSearchInput();
        }
    } catch (error) {
        console.warn('Featured movies failed', error);
        notifyToast({
            type: 'error',
            title: 'Catálogo no disponible',
            message: 'No pudimos cargar las películas destacadas.'
        });
        if (moviesGrid) {
            moviesGrid.innerHTML = '<p class="movie-error">No se pudieron cargar las películas.</p>';
        }
    } finally {
        if (useLoader) {
            hidePageLoader();
        }
    }
};

const setMenuState = (open) => {
    if (!siteHeader || !menuToggle) {
        return;
    }

    siteHeader.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (menuOverlay) {
        menuOverlay.hidden = !open;
    }
};

const closeMenu = () => setMenuState(false);

const wireMenu = () => {
    if (!menuToggle || !siteHeader) {
        return;
    }

    menuToggle.addEventListener('click', () => {
        const isOpen = siteHeader.classList.contains('is-open');
        setMenuState(!isOpen);
    });

    menuOverlay?.addEventListener('click', closeMenu);

    document.addEventListener('click', (event) => {
        if (!siteHeader.classList.contains('is-open')) {
            return;
        }

        if (!siteHeader.contains(event.target)) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeMenu();
        }
    });

    if (primaryNav) {
        primaryNav.addEventListener('click', (event) => {
            const openProfile = event.target.closest('[data-open-profile]');
            if (openProfile) {
                event.preventDefault();
                closeMenu();
                notifyToast({
                    type: 'info',
                    title: 'Perfil',
                    message: 'Selecciona un perfil desde la pantalla de perfiles.'
                });
                return;
            }

            if (event.target.closest('a')) {
                closeMenu();
            }
        });
    }

    const desktopQuery = window.matchMedia('(min-width: 900px)');
    const syncMenuWithViewport = (mediaQuery) => {
        if (mediaQuery.matches) {
            closeMenu();
        }
    };

    syncMenuWithViewport(desktopQuery);

    if (typeof desktopQuery.addEventListener === 'function') {
        desktopQuery.addEventListener('change', syncMenuWithViewport);
    } else if (typeof desktopQuery.addListener === 'function') {
        desktopQuery.addListener(syncMenuWithViewport);
    }
};

const navigateToMovie = (movieId) => {
    const targetUrl = `/pages/movie.html?id=${movieId}`;
    document.body.classList.add('page-leaving');
    window.setTimeout(() => {
        window.location.href = targetUrl;
    }, 180);
};

const wireMovieActions = () => {
    if (!moviesGrid) {
        return;
    }

    moviesGrid.addEventListener('click', (event) => {
        const favoriteButton = event.target.closest('[data-favorite-toggle]');
        if (favoriteButton) {
            event.preventDefault();
            event.stopPropagation();
            const movieId = Number(favoriteButton.dataset.favoriteToggle);
            if (!Number.isNaN(movieId)) {
                const action = toggleFavorite(movieId);
                updateFavoriteButton(favoriteButton, movieId);
                notifyToast({
                    type: 'success',
                    title: action === 'removed' ? 'Eliminado de favoritos' : 'Agregado a favoritos',
                    message: favoriteButton.dataset.movieTitle
                        ? `${favoriteButton.dataset.movieTitle} ${action === 'removed' ? 'salió' : 'se agregó'} de tu lista.`
                            : action === 'removed'
                                ? 'Se quitó de favoritos.'
                                : 'Se agregó a favoritos.'
                });
                syncPreferenceEvent({
                    type: 'favorite',
                    action: action === 'removed' ? 'removed' : 'added',
                    movieId,
                    movie: {
                        id: movieId,
                        title: favoriteButton.dataset.movieTitle || favoriteButton.dataset.title || ''
                    }
                });
            }
            return;
        }

        const card = event.target.closest('.movie-card');
        if (!card) {
            return;
        }

        const button = event.target.closest('.ver-btn');
        const movieId = Number(button?.dataset.movieId ?? card.dataset.movieId);

        if (!Number.isNaN(movieId)) {
            navigateToMovie(movieId);
        }
    });

    moviesGrid.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        const card = event.target.closest('.movie-card');
        if (!card) {
            return;
        }

        if (event.target.closest('[data-favorite-toggle]')) {
            return;
        }

        event.preventDefault();
        const movieId = Number(card.dataset.movieId);
        if (!Number.isNaN(movieId)) {
            navigateToMovie(movieId);
        }
    });
};

const wireTrendingMovieActions = () => {
    if (!trendingGrid) {
        return;
    }

    trendingGrid.addEventListener('click', (event) => {
        const favoriteButton = event.target.closest('[data-favorite-toggle]');
        if (favoriteButton) {
            event.preventDefault();
            event.stopPropagation();
                const movieId = Number(favoriteButton.dataset.favoriteToggle);
            if (!Number.isNaN(movieId)) {
                const action = toggleFavorite(movieId);
                updateFavoriteButton(favoriteButton, movieId);
                notifyToast({
                    type: 'success',
                    title: action === 'removed' ? 'Eliminado de favoritos' : 'Agregado a favoritos',
                    message: favoriteButton.dataset.movieTitle
                        ? `${favoriteButton.dataset.movieTitle} ${action === 'removed' ? 'salió' : 'se agregó'} de tu lista.`
                            : action === 'removed'
                                ? 'Se quitó de favoritos.'
                                : 'Se agregó a favoritos.'
                });
                syncPreferenceEvent({
                    type: 'favorite',
                    action: action === 'removed' ? 'removed' : 'added',
                    movieId,
                    movie: {
                        id: movieId,
                        title: favoriteButton.dataset.movieTitle || favoriteButton.dataset.title || ''
                    }
                });
            }
            return;
        }

        const card = event.target.closest('.movie-card');
        if (!card) {
            return;
        }

        const button = event.target.closest('.ver-btn');
        const movieId = Number(button?.dataset.movieId ?? card.dataset.movieId);

        if (!Number.isNaN(movieId)) {
            navigateToMovie(movieId);
        }
    });

    trendingGrid.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        const card = event.target.closest('.movie-card');
        if (!card) {
            return;
        }

        if (event.target.closest('[data-favorite-toggle]')) {
            return;
        }

        event.preventDefault();
        const movieId = Number(card.dataset.movieId);
        if (!Number.isNaN(movieId)) {
            navigateToMovie(movieId);
        }
    });
};

const wireContinueWatchingActions = () => {
    if (!continueWatchingGrid) {
        return;
    }

    continueWatchingGrid.addEventListener('click', (event) => {
        const removeButton = event.target.closest('[data-remove-watch]');
        if (removeButton) {
            event.preventDefault();
            event.stopPropagation();
            removeContinueWatching(Number(removeButton.dataset.removeWatch));
            return;
        }

        const card = event.target.closest('.movie-card');
        if (!card) {
            return;
        }

        const button = event.target.closest('.ver-btn');
        const movieId = Number(button?.dataset.movieId ?? card.dataset.movieId);

        if (!Number.isNaN(movieId)) {
            navigateToMovie(movieId);
        }
    });

    continueWatchingGrid.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        const card = event.target.closest('.movie-card');
        if (!card || event.target.closest('[data-remove-watch]')) {
            return;
        }

        event.preventDefault();
        const movieId = Number(card.dataset.movieId);
        if (!Number.isNaN(movieId)) {
            navigateToMovie(movieId);
        }
    });
};

const wireCarouselControls = () => {
    if (!moviesGrid || !carousel) {
        return;
    }

    const scrollAmount = () => Math.max(260, Math.floor(moviesGrid.clientWidth * 0.8));

    carouselButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const direction = button.dataset.carousel === 'prev' ? -1 : 1;
            moviesGrid.scrollBy({
                left: direction * scrollAmount(),
                behavior: 'smooth'
            });
        });
    });

    carousel.addEventListener('wheel', (event) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
        }

        event.preventDefault();
        moviesGrid.scrollBy({
            left: event.deltaY,
            behavior: 'auto'
        });
    }, { passive: false });

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let activePointerId = null;

    moviesGrid.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) {
            return;
        }

        if (event.target.closest('button, a, input, label')) {
            return;
        }

        isDragging = true;
        activePointerId = event.pointerId;
        startX = event.clientX;
        startScrollLeft = moviesGrid.scrollLeft;
        moviesGrid.classList.add('is-dragging');
        moviesGrid.setPointerCapture(event.pointerId);
    });

    moviesGrid.addEventListener('pointermove', (event) => {
        if (!isDragging || event.pointerId !== activePointerId) {
            return;
        }

        event.preventDefault();
        const deltaX = event.clientX - startX;
        moviesGrid.scrollLeft = startScrollLeft - deltaX;
    });

    const endDrag = (event) => {
        if (event.pointerId !== activePointerId) {
            return;
        }

        isDragging = false;
        activePointerId = null;
        moviesGrid.classList.remove('is-dragging');
        if (moviesGrid.hasPointerCapture(event.pointerId)) {
            moviesGrid.releasePointerCapture(event.pointerId);
        }
    };

    moviesGrid.addEventListener('pointerup', endDrag);
    moviesGrid.addEventListener('pointercancel', endDrag);
    moviesGrid.addEventListener('lostpointercapture', () => {
        isDragging = false;
        activePointerId = null;
        moviesGrid.classList.remove('is-dragging');
    });
};

const bootstrap = async () => {
    wireMenu();
    wireHeroControls();
    wireMovieActions();
    wireTrendingMovieActions();
    wireContinueWatchingActions();
    wireCarouselControls();
    wireTrendingControls();
    wireSearch();
    wireTrailerPreviewToGrid(moviesGrid);
    wireTrailerPreviewToGrid(trendingGrid);
    wireTrailerPreviewToGrid(continueWatchingGrid);

    renderContinueWatching();
    showPageLoader();
    window.addEventListener('storage', (event) => {
        if (event.key === WATCH_HISTORY_KEY) {
            renderContinueWatching();
        }

        if (event.key === FAVORITES_KEY) {
            refreshFeaturedGrid(searchInput?.value || '');
            renderTrendingMovies();
        }
    });

    try {
        await loadFeaturedMovies({ useLoader: false });
        await Promise.all([
            loadTrendingMovies(),
            loadHeroSlides()
        ]);
    } finally {
        hidePageLoader();
    }
};

bootstrap();
