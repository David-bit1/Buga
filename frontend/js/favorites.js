const API_KEY = 'b24af203b14e23f8c91844baae37cfab';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const FALLBACK_POSTER = 'https://via.placeholder.com/500x750?text=No+Poster';
const FAVORITES_KEY = window.BugaAuth?.getProfileStorageKey?.('buga-favorites') || 'buga-favorites';

const favoritesGrid = document.getElementById('favoritesGrid');
const pageLoader = document.getElementById('pageLoader');
const siteHeader = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.getElementById('primaryNav');

const formatYear = (releaseDate) => (releaseDate ? String(releaseDate).slice(0, 4) : 'N/A');

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

const isFavoriteMovie = (movieId) => getFavorites().includes(movieId);

const notifyToast = (options) => window.BugaToast?.show?.(options) || null;
const syncPreferenceEvent = (payload) => window.BugaAuth?.recordPreferenceEvent?.(payload);


const getFavoriteIcon = (favorite) => (favorite ? '♥' : '♡');

const showPageLoader = () => {
    document.body.classList.add('is-loading');
    pageLoader?.setAttribute('aria-busy', 'true');
};

const hidePageLoader = () => {
    document.body.classList.remove('is-loading');
    pageLoader?.setAttribute('aria-busy', 'false');
};

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
    description: movie.overview || 'Descripción no disponible.',
    genres: Array.isArray(movie.genres) ? movie.genres : [],
    year: formatYear(movie.release_date)
});

const shortenText = (text, limit = 110) => {
    if (!text || text.length <= limit) {
        return text || '';
    }

    return `${text.slice(0, limit).trim()}...`;
};

const createCard = (movie) => {
    const genreLabel = movie.genres?.[0]?.name || 'Cine';
    const favorite = isFavoriteMovie(movie.id);

    return `
        <article class="movie-card" data-movie-id="${movie.id}" data-movie-title="${movie.title}" tabindex="0" role="link" aria-label="Abrir ${movie.title}">
            <img class="movie-poster" src="${movie.poster || FALLBACK_POSTER}" alt="Poster de ${movie.title}" loading="lazy" decoding="async">
            <div class="movie-card-body">
                <p class="movie-card-kicker">${genreLabel} • ${movie.year}</p>
                <h3>${movie.title}</h3>
                <p>${shortenText(movie.description, 110)}</p>
                <div class="movie-card-actions">
                    <button class="favorite-toggle ${favorite ? 'is-active' : ''}" type="button" data-favorite-toggle="${movie.id}" aria-pressed="${favorite}" aria-label="${favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                        <span class="favorite-icon" aria-hidden="true">${getFavoriteIcon(favorite)}</span>
                    </button>
                    <button class="ver-btn" type="button" data-movie-id="${movie.id}" data-title="${movie.title}">Ver</button>
                </div>
            </div>
        </article>
    `;
};

const renderLoadingState = (count = 4) => {
    if (!favoritesGrid) {
        return;
    }

    favoritesGrid.innerHTML = Array.from({ length: Math.max(3, count) })
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

const renderEmptyState = () => {
    if (!favoritesGrid) {
        return;
    }

    favoritesGrid.innerHTML = `
        <article class="favorites-empty">
            <h3>Tu lista está vacía</h3>
            <p>Agrega películas desde las cards del inicio o desde la ficha individual para verlas aquí guardadas.</p>
            <a class="btn" href="/index.html">Explorar películas</a>
        </article>
    `;
};

const renderMovies = (movies) => {
    if (!favoritesGrid) {
        return;
    }

    favoritesGrid.innerHTML = movies.map(createCard).join('');
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

const loadFavorites = async () => {
    const favoriteIds = getFavorites();

    if (favoriteIds.length === 0) {
        renderEmptyState();
        hidePageLoader();
        return;
    }

    showPageLoader();
    renderLoadingState(favoriteIds.length);

    try {
        const results = await Promise.allSettled(
            favoriteIds.map(async (movieId) => {
                const movie = await getMovieDetails(movieId);
                return mapMovie(movie);
            })
        );

        const movies = results
            .filter((result) => result.status === 'fulfilled' && result.value)
            .map((result) => result.value);

        if (movies.length === 0) {
            renderEmptyState();
            return;
        }

        renderMovies(movies);
    } catch (error) {
        console.warn('Favorites load failed', error);
        renderEmptyState();
    } finally {
        hidePageLoader();
    }
};

const setMenuState = (open) => {
    if (!siteHeader || !menuToggle) {
        return;
    }

    siteHeader.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
};

const wireMenu = () => {
    if (!menuToggle || !siteHeader) {
        return;
    }

    menuToggle.addEventListener('click', () => {
        const isOpen = siteHeader.classList.contains('is-open');
        setMenuState(!isOpen);
    });

    document.addEventListener('click', (event) => {
        if (!siteHeader.classList.contains('is-open')) {
            return;
        }

        if (!siteHeader.contains(event.target)) {
            setMenuState(false);
        }
    });

    if (primaryNav) {
        primaryNav.addEventListener('click', (event) => {
            if (event.target.closest('a')) {
                setMenuState(false);
            }
        });
    }
};

const navigateToMovie = (movieId) => {
    const targetUrl = `/pages/movie.html?id=${movieId}`;
    document.body.classList.add('page-leaving');
    window.setTimeout(() => {
        window.location.href = targetUrl;
    }, 180);
};

const wireActions = () => {
    if (!favoritesGrid) {
        return;
    }

    favoritesGrid.addEventListener('click', (event) => {
        const card = event.target.closest('.movie-card');
        const favoriteButton = event.target.closest('[data-favorite-toggle]');
        if (favoriteButton) {
            event.preventDefault();
            event.stopPropagation();
            const movieId = Number(favoriteButton.dataset.favoriteToggle);
            if (!Number.isNaN(movieId)) {
                const action = toggleFavorite(movieId);
                loadFavorites();
                notifyToast({
                    type: 'success',
                    title: action === 'removed' ? 'Eliminado de favoritos' : 'Agregado a favoritos',
                    message: action === 'removed' ? 'Se quitó de tu lista.' : 'Se guardó en tu lista.'
                });
                syncPreferenceEvent({
                    type: 'favorite',
                    action: action === 'removed' ? 'removed' : 'added',
                    movieId,
                    movie: {
                        id: movieId,
                        title: favoriteButton.dataset.movieTitle || card?.dataset.movieTitle || ''
                    }
                });
            }
            return;
        }

        if (!card) {
            return;
        }

        const button = event.target.closest('.ver-btn');
        const movieId = Number(button?.dataset.movieId ?? card.dataset.movieId);

        if (!Number.isNaN(movieId)) {
            navigateToMovie(movieId);
        }
    });

    favoritesGrid.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        const card = event.target.closest('.movie-card');
        if (!card || event.target.closest('[data-favorite-toggle]')) {
            return;
        }

        event.preventDefault();
        const movieId = Number(card.dataset.movieId);
        if (!Number.isNaN(movieId)) {
            navigateToMovie(movieId);
        }
    });
};

const bootstrap = async () => {
    wireMenu();
    wireActions();
    await loadFavorites();
};

bootstrap();
