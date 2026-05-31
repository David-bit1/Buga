const FEATURED_MOVIE_IDS = [653, 19, 962, 961, 10098, 643, 22596, 40574, 701, 23282];
const API_KEY = 'b24af203b14e23f8c91844baae37cfab';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const FALLBACK_POSTER = 'https://via.placeholder.com/500x750?text=No+Poster';
const FAVORITES_KEY = window.BugaAuth?.getProfileStorageKey?.('buga-favorites') || 'buga-favorites';

const genreMoviesGrid = document.getElementById('genreMoviesGrid');
const genreChips = document.getElementById('genreChips');
const pageLoader = document.getElementById('pageLoader');
const menuOverlay = document.getElementById('menuOverlay');
const siteHeader = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.getElementById('primaryNav');
const genreSearchInput = document.getElementById('genreSearch');
const movieCount = document.getElementById('movieCount');
const genreCount = document.getElementById('genreCount');
const selectedGenreLabel = document.getElementById('selectedGenreLabel');

let moviesCache = [];
let genresCache = [];
let activeGenreId = 'all';

const formatYear = (releaseDate) => (releaseDate ? String(releaseDate).slice(0, 4) : 'N/A');

const normalizeSearchText = (value) =>
    String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

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

const createMovieCard = (movie) => {
    const genreLabel = movie.genres?.[0]?.name || 'Cine';
    const favorite = isFavoriteMovie(movie.id);

    return `
        <article class="movie-card" data-movie-id="${movie.id}" data-movie-title="${movie.title}" tabindex="0" role="link" aria-label="Abrir ${movie.title}">
            <img class="movie-poster" src="${movie.poster || FALLBACK_POSTER}" alt="Poster de ${movie.title}" loading="lazy" decoding="async">
            <div class="movie-card-body">
                <p class="movie-card-kicker">${genreLabel} • ${movie.year}</p>
                <h3>${movie.title}</h3>
                <p>${movie.description.length > 110 ? `${movie.description.slice(0, 110).trim()}...` : movie.description}</p>
                <div class="movie-card-actions">
                    <button class="favorite-toggle ${favorite ? 'is-active' : ''}" type="button" data-favorite-toggle="${movie.id}" aria-pressed="${favorite}" aria-label="${favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                        <span class="favorite-icon" aria-hidden="true">${getFavoriteIcon(favorite)}</span>
                    </button>
                    <button class="ver-btn" type="button" data-movie-id="${movie.id}">Ver</button>
                </div>
            </div>
        </article>
    `;
};

const createSkeletonCards = (count = 4) => Array.from({ length: count })
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

const renderSkeleton = () => {
    if (!genreMoviesGrid) {
        return;
    }

    genreMoviesGrid.innerHTML = createSkeletonCards(8);
};

const buildGenres = (movies) => {
    const genreMap = new Map();

    movies.forEach((movie) => {
        (movie.genres || []).forEach((genre) => {
            if (!genreMap.has(genre.id)) {
                genreMap.set(genre.id, { id: genre.id, name: genre.name, count: 0 });
            }

            genreMap.get(genre.id).count += 1;
        });
    });

    return Array.from(genreMap.values()).sort((left, right) => left.name.localeCompare(right.name, 'es'));
};

const updateStats = () => {
    if (movieCount) {
        movieCount.textContent = String(moviesCache.length);
    }

    if (genreCount) {
        genreCount.textContent = String(genresCache.length);
    }

    if (selectedGenreLabel) {
        if (activeGenreId === 'all') {
            selectedGenreLabel.textContent = 'Todos';
        } else {
            selectedGenreLabel.textContent = genresCache.find((genre) => String(genre.id) === String(activeGenreId))?.name || 'Género';
        }
    }
};

const renderGenreChips = () => {
    if (!genreChips) {
        return;
    }

    const chips = [
        { id: 'all', name: 'Todos', count: moviesCache.length }
    ].concat(genresCache);

    genreChips.innerHTML = chips.map((genre) => `
        <button class="genre-chip ${String(activeGenreId) === String(genre.id) ? 'is-active' : ''}" type="button" data-genre-id="${genre.id}">
            <span>${genre.name}</span>
            <span class="genre-chip-count">${genre.count}</span>
        </button>
    `).join('');
};

const getFilteredMovies = () => {
    const query = normalizeSearchText(genreSearchInput?.value || '');

    return moviesCache.filter((movie) => {
        const movieGenres = movie.genres || [];
        const genreMatch = activeGenreId === 'all' || movieGenres.some((genre) => String(genre.id) === String(activeGenreId));
        const searchableText = normalizeSearchText([
            movie.title,
            movie.description,
            movie.year,
            ...movieGenres.map((genre) => genre.name)
        ].join(' '));
        const searchMatch = !query || searchableText.includes(query);

        return genreMatch && searchMatch;
    });
};

const renderMovies = () => {
    if (!genreMoviesGrid) {
        return;
    }

    const movies = getFilteredMovies();

    if (!movies.length) {
        genreMoviesGrid.innerHTML = `
            <article class="genre-empty">
                <h3>No se encontraron resultados</h3>
                <p>Prueba con otro género o escribe una búsqueda más corta.</p>
            </article>
        `;
        return;
    }

    genreMoviesGrid.innerHTML = movies.map(createMovieCard).join('');
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

const navigateToMovie = (movieId) => {
    document.body.classList.add('page-leaving');
    window.setTimeout(() => {
        window.location.href = `/pages/movie.html?id=${movieId}`;
    }, 180);
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

const wireFilters = () => {
    genreChips?.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-genre-id]');
        if (!chip) {
            return;
        }

        activeGenreId = chip.dataset.genreId;
        renderGenreChips();
        updateStats();
        renderMovies();
    });

    genreSearchInput?.addEventListener('input', () => {
        renderMovies();
    });

    genreSearchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            genreSearchInput.value = '';
            renderMovies();
        }
    });

    genreMoviesGrid?.addEventListener('click', (event) => {
        const card = event.target.closest('.movie-card');
        const favoriteButton = event.target.closest('[data-favorite-toggle]');
        if (favoriteButton) {
            event.preventDefault();
            event.stopPropagation();
            const movieId = Number(favoriteButton.dataset.favoriteToggle);
            if (!Number.isNaN(movieId)) {
                const action = toggleFavorite(movieId);
                updateFavoriteButton(favoriteButton, movieId);
                window.BugaToast?.show?.({
                    type: 'success',
                    title: action === 'removed' ? 'Eliminado de favoritos' : 'Agregado a favoritos',
                    message: action === 'removed' ? 'Se quitó de favoritos.' : 'Se guardó en tu lista.'
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

        const movieId = Number(card.dataset.movieId);
        if (!Number.isNaN(movieId)) {
            navigateToMovie(movieId);
        }
    });

    genreMoviesGrid?.addEventListener('keydown', (event) => {
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

const loadGenresPage = async () => {
    showPageLoader();
    renderSkeleton();

    try {
        const results = await Promise.allSettled(
            FEATURED_MOVIE_IDS.map(async (movieId) => mapMovie(await getMovieDetails(movieId)))
        );

        moviesCache = results
            .filter((result) => result.status === 'fulfilled' && result.value)
            .map((result) => result.value);

        genresCache = buildGenres(moviesCache);
        activeGenreId = 'all';
        renderGenreChips();
        updateStats();
        renderMovies();
    } catch (error) {
        console.warn('Genres page failed', error);
        if (genreMoviesGrid) {
            genreMoviesGrid.innerHTML = `
                <article class="genre-empty">
                    <h3>No se pudo cargar el catálogo</h3>
                    <p>Intenta recargar la página más tarde.</p>
                </article>
            `;
        }
    } finally {
        hidePageLoader();
    }
};

const bootstrap = async () => {
    wireMenu();
    wireFilters();
    await loadGenresPage();
};

bootstrap();
