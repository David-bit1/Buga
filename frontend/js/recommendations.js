const RECOMMENDATIONS_API = '/api/recommendations';
const RECOMMENDATIONS_SECTION = document.getElementById('recommendationsSection');
const RECOMMENDATIONS_GRID = document.getElementById('recommendationsGrid');
const RECOMMENDATIONS_SUBTITLE = document.getElementById('recommendationsSubtitle');
const RECOMMENDATIONS_PREV = document.querySelector('[data-recommendation-carousel="prev"]');
const RECOMMENDATIONS_NEXT = document.querySelector('[data-recommendation-carousel="next"]');

const FALLBACK_POSTER = 'https://via.placeholder.com/500x750?text=No+Poster';
const RECOMMENDATION_FAVORITES_KEY = window.BugaAuth?.getProfileStorageKey?.('buga-favorites') || 'buga-favorites';
const RECOMMENDATION_HISTORY_KEY = window.BugaAuth?.getProfileStorageKey?.('buga-watch-history') || 'buga-watch-history';

const authFetch = (url, options = {}) => {
    const token = window.BugaAuth?.getAuthToken?.();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
        ...options,
        headers
    });
};

const getFavorites = () => {
    try {
        return JSON.parse(localStorage.getItem(RECOMMENDATION_FAVORITES_KEY) || '[]');
    } catch {
        return [];
    }
};

const setFavorites = (favorites) => {
    localStorage.setItem(RECOMMENDATION_FAVORITES_KEY, JSON.stringify(favorites));
};

const isFavoriteMovie = (movieId) => getFavorites().includes(movieId);

const notifyToast = (options) => window.BugaToast?.show?.(options) || null;

const syncPreferenceEvent = (payload) => {
    window.BugaAuth?.recordPreferenceEvent?.(payload);
};

const normalizeYear = (releaseDate) => (releaseDate ? String(releaseDate).slice(0, 4) : 'N/A');

const escapeText = (value) =>
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const setSectionVisible = (visible) => {
    if (RECOMMENDATIONS_SECTION) {
        RECOMMENDATIONS_SECTION.hidden = !visible;
    }
};

const scrollByAmount = (direction) => {
    if (!RECOMMENDATIONS_GRID) {
        return;
    }

    const amount = Math.max(300, Math.floor(RECOMMENDATIONS_GRID.clientWidth * 0.8));
    RECOMMENDATIONS_GRID.scrollBy({
        left: direction * amount,
        behavior: 'smooth'
    });
};

const navigateToMovie = (movieId) => {
    document.body.classList.add('page-leaving');
    window.setTimeout(() => {
        window.location.href = `/pages/movie.html?id=${movieId}`;
    }, 180);
};

const updateFavoriteButton = (button, movieId) => {
    const favorite = isFavoriteMovie(movieId);
    button.classList.toggle('is-active', favorite);
    button.setAttribute('aria-pressed', String(favorite));
    button.setAttribute('aria-label', favorite ? 'Quitar de favoritos' : 'Agregar a favoritos');
    const icon = button.querySelector('.favorite-icon');
    if (icon) {
        icon.textContent = favorite ? '♥' : '♡';
    }
};

const toggleFavorite = (movie) => {
    const favorites = getFavorites();
    const index = favorites.indexOf(movie.id);
    const removing = index >= 0;

    if (removing) {
        favorites.splice(index, 1);
    } else {
        favorites.push(movie.id);
    }

    setFavorites(favorites);

    syncPreferenceEvent({
        type: 'favorite',
        action: removing ? 'removed' : 'added',
        movieId: movie.id,
        movie
    });

    return removing ? 'removed' : 'added';
};

const renderSkeleton = (count = 6) => {
    if (!RECOMMENDATIONS_GRID) {
        return;
    }

    RECOMMENDATIONS_GRID.innerHTML = Array.from({ length: count })
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

const renderEmptyState = (title, message) => {
    if (!RECOMMENDATIONS_GRID) {
        return;
    }

    RECOMMENDATIONS_GRID.innerHTML = `
        <article class="recommendations-empty">
            <div>
                <p class="recommendation-badge">Personalizado</p>
                <h3>${escapeText(title)}</h3>
                <p>${escapeText(message)}</p>
                <a class="btn" href="/index.html">Explorar catálogo</a>
            </div>
        </article>
    `;
};

const renderRecommendations = (items) => {
    if (!RECOMMENDATIONS_GRID) {
        return;
    }

    RECOMMENDATIONS_GRID.innerHTML = items.map((movie) => {
        const favorite = isFavoriteMovie(movie.id);
        const poster = movie.poster || movie.backdrop || FALLBACK_POSTER;

        return `
            <article class="movie-card recommendation-card" data-movie-id="${movie.id}" data-movie-title="${escapeText(movie.title)}" tabindex="0" role="link" aria-label="Abrir ${escapeText(movie.title)}">
                <div class="movie-card-media">
                    <span class="movie-card-tag">${escapeText(movie.reason || 'Te podría gustar')}</span>
                    <img class="movie-poster" src="${poster}" alt="Poster de ${escapeText(movie.title)}" loading="lazy" decoding="async">
                </div>
                <div class="movie-card-body">
                    <p class="movie-card-kicker">${escapeText(movie.genreLabel || 'Cine')} • ${escapeText(movie.year || normalizeYear(movie.releaseDate))}</p>
                    <h3>${escapeText(movie.title)}</h3>
                    <p>${escapeText(movie.overview || 'Descripción no disponible.')}</p>
                    <div class="movie-card-actions">
                        <button class="favorite-toggle ${favorite ? 'is-active' : ''}" type="button" data-favorite-toggle="${movie.id}" data-movie-title="${escapeText(movie.title)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                            <span class="favorite-icon" aria-hidden="true">${favorite ? '♥' : '♡'}</span>
                        </button>
                        <button class="ver-btn" type="button" data-movie-id="${movie.id}" data-title="${escapeText(movie.title)}">Ver</button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
};

const fetchRecommendations = async () => {
    const profile = window.BugaAuth?.getActiveProfile?.();
    if (!profile?.id) {
        setSectionVisible(false);
        return;
    }

    setSectionVisible(true);
    renderSkeleton(6);

    try {
        const response = await authFetch(`${RECOMMENDATIONS_API}?profileId=${encodeURIComponent(profile.id)}&limit=12`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || 'No pudimos generar recomendaciones');
        }

        const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
        if (RECOMMENDATIONS_SUBTITLE) {
            const profileName = profile.name || 'tu perfil';
            RECOMMENDATIONS_SUBTITLE.textContent = recommendations.length
                ? `Sugerencias para ${profileName} basadas en favoritos, historial y géneros.`
                : `Todavía estamos aprendiendo tus gustos en ${profileName}.`;
        }

        if (recommendations.length === 0) {
            renderEmptyState(
                'Aún estamos afinando tus gustos',
                'Agrega favoritos, reproduce algunas películas y esta fila se llenará automáticamente.'
            );
            return;
        }

        renderRecommendations(recommendations);
    } catch (error) {
        console.warn('Recommendations failed', error);
        notifyToast({
            type: 'error',
            title: 'No se pudieron cargar recomendaciones',
            message: error.message || 'Revisa tu conexión e inténtalo otra vez.'
        });
        renderEmptyState(
            'No fue posible cargar recomendaciones',
            'Podés seguir explorando el catálogo mientras resolvemos la conexión.'
        );
    }
};

const wireEvents = () => {
    RECOMMENDATIONS_PREV?.addEventListener('click', () => scrollByAmount(-1));
    RECOMMENDATIONS_NEXT?.addEventListener('click', () => scrollByAmount(1));

    RECOMMENDATIONS_GRID?.addEventListener('click', (event) => {
        const favoriteButton = event.target.closest('[data-favorite-toggle]');
        if (favoriteButton) {
            event.preventDefault();
            event.stopPropagation();
            const card = event.target.closest('.movie-card');
            const movieId = Number(favoriteButton.dataset.favoriteToggle);
            if (Number.isNaN(movieId)) {
                return;
            }

            const movie = {
                id: movieId,
                title: favoriteButton.dataset.movieTitle || card?.dataset.movieTitle || ''
            };

            const action = toggleFavorite(movie);
            updateFavoriteButton(favoriteButton, movieId);
            notifyToast({
                type: action === 'removed' ? 'info' : 'success',
                title: action === 'removed' ? 'Eliminado de favoritos' : 'Agregado a favoritos',
                message: action === 'removed'
                    ? `${movie.title || 'La película'} salió de tu lista.`
                    : `${movie.title || 'La película'} ya está en tu lista.`
            });
            return;
        }

        const card = event.target.closest('.movie-card');
        const movieId = Number(card?.dataset.movieId);
        if (!Number.isNaN(movieId)) {
            navigateToMovie(movieId);
        }
    });

    RECOMMENDATIONS_GRID?.addEventListener('keydown', (event) => {
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

    window.addEventListener('buga:preferences-updated', () => {
        window.clearTimeout(fetchRecommendations._refreshTimerId);
        fetchRecommendations._refreshTimerId = window.setTimeout(() => {
            fetchRecommendations();
        }, 650);
    });
};

const bootstrap = async () => {
    if (!RECOMMENDATIONS_SECTION || !RECOMMENDATIONS_GRID) {
        return;
    }

    wireEvents();
    await fetchRecommendations();
};

document.addEventListener('DOMContentLoaded', bootstrap);

window.BugaRecommendations = {
    refresh: fetchRecommendations
};
