(function () {
    const shared = window.BugaShared || {};
    
    const sharedConfig = {
        API_ORIGIN: 'https://buga.onrender.com',
        API_KEY: 'b24af203b14e23f8c91844baae37cfab',
        TMDB_BASE_URL: 'https://api.themoviedb.org/3',
        IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
        IMAGE_BASE_URL_W780: 'https://image.tmdb.org/t/p/w780',
        POSTER_BASE_URL: 'https://image.tmdb.org/t/p/w500',
        FALLBACK_POSTER: '/assets/images/no-poster.png',
        DEFAULT_VIDEO_SOURCE: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        REQUEST_TIMEOUT_MS: 9000,
        TOAST_DURATION: 4200,
        TOAST_STACK_LIMIT: 4,
        STORAGE_KEYS: { // Renamed from 'ultrapelis' to 'Buga'
            AUTH: 'Buga-auth',
            ACTIVE_PROFILE: 'Buga-active-profile',
            TOAST_FLASH: 'Buga-toast-flash',
            FAVORITES: 'Buga-favorites',
            WATCH_HISTORY: 'Buga-watch-history'
        },
        API_BASES: {
            auth: '/api/auth',
            recommendations: '/api/recommendations',
            profiles: '/api/profiles',
            movies: '/api/movies',
            admin: '/api/admin'
        }
    };

    const requestWithTimeout = (promise, timeoutMs = sharedConfig.REQUEST_TIMEOUT_MS, label = 'request') =>
        Promise.race([
            promise,
            new Promise((_, reject) => {
                window.setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
            })
        ]);

    const getProfileStorageKey = (suffix) => { // Renamed from getProfileStorageKey to avoid conflict
        if (window.BugaAuth?.getProfileStorageKey) {
            return window.BugaAuth.getProfileStorageKey(suffix);
        }

        return suffix;
    };

    const normalizeMovie = (movie, mediaType = 'movie') => {
        if (!movie || typeof movie !== 'object') {
            return {
                id: null,
                mediaType,
                title: mediaType === 'tv' ? 'Serie sin título' : 'Película sin título',
                original_title: '',
                overview: '',
                description: '',
                tagline: '',
                poster_url: '',
                banner_url: '',
                poster: '',
                backdrop: '',
                release_date: '',
                release_year: null,
                runtime: 0,
                genres: [],
                rating: '',
                cast: [],
                director: '',
                trailer: '',
                servers: [],
                featured: false,
                status: 'published',
                popularity: 0
            };
        }

        const releaseDate = mediaType === 'tv'
            ? movie.first_air_date || movie.release_date || ''
            : movie.release_date || movie.first_air_date || '';

        const title = mediaType === 'tv'
            ? movie.name || movie.original_name || 'Serie sin título'
            : movie.title || movie.original_title || 'Película sin título';

        const genres = Array.isArray(movie.genres)
            ? movie.genres.map((genre) => (typeof genre === 'string' ? { name: genre } : (genre.name ? genre : { name: '' }))).filter(g => g.name)
            : [];

    return {
        id: movie.id,
        tmdb_id: movie.tmdb_id || null,
        mediaType,
        title,
        original_title: movie.original_title || '',
            overview: movie.overview || '',
            description: movie.description || movie.overview || '',
            tagline: movie.tagline || '',
            poster_url: movie.poster_url || '',
            banner_url: movie.banner_url || '',
            poster: movie.poster_url || movie.poster || '',
            backdrop: movie.banner_url || movie.backdrop || '',
        release_date: releaseDate,
        release_year: movie.release_year || (releaseDate ? String(releaseDate).slice(0, 4) : null),
        year: movie.release_year ? String(movie.release_year) : (releaseDate ? String(releaseDate).slice(0, 4) : 'N/A'),
        runtime: movie.runtime || 0,
            genres,
            rating: movie.rating || '',
            cast: Array.isArray(movie.cast) ? movie.cast : [],
            director: movie.director || '',
            trailer: movie.trailer || '',
            servers: Array.isArray(movie.servers) ? movie.servers : (Array.isArray(movie.playback_sources) ? movie.playback_sources : []),
            featured: Boolean(movie.featured),
            status: movie.status || 'published',
            popularity: Number(movie.popularity || 0)
        };
    };

    window.BugaShared = {
        ...shared,
        ...sharedConfig,
        requestWithTimeout,
        getProfileStorageKey,
        normalizeMovie
    };
})();
