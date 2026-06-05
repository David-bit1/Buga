(function () {
    const shared = window.BugaShared || {};

    const sharedConfig = {
        API_ORIGIN: 'https://buga.onrender.com',
        API_KEY: 'b24af203b14e23f8c91844baae37cfab',
        TMDB_BASE_URL: 'https://api.themoviedb.org/3',
        IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
        IMAGE_BASE_URL_W780: 'https://image.tmdb.org/t/p/w780',
        POSTER_BASE_URL: 'https://image.tmdb.org/t/p/w500',
        FALLBACK_POSTER: 'https://via.placeholder.com/500x750?text=No+Poster',
        DEFAULT_VIDEO_SOURCE: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        FEATURED_MOVIE_IDS: [653, 19, 962, 961, 10098, 643, 22596, 40574, 701, 23282],
        REQUEST_TIMEOUT_MS: 9000,
        TOAST_DURATION: 4200,
        TOAST_STACK_LIMIT: 4,
        STORAGE_KEYS: {
            AUTH: 'buga-auth',
            ACTIVE_PROFILE: 'buga-active-profile',
            TOAST_FLASH: 'buga-toast-flash',
            FAVORITES: 'buga-favorites',
            WATCH_HISTORY: 'buga-watch-history'
        },
        API_BASES: {
            auth: 'https://buga.onrender.com/api/auth',
            recommendations: 'https://buga.onrender.com/api/recommendations',
            profiles: 'https://buga.onrender.com/api/profiles',
            movies: 'https://buga.onrender.com/api/movies',
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

    const getProfileStorageKey = (suffix) => {
        if (window.BugaAuth?.getProfileStorageKey) {
            return window.BugaAuth.getProfileStorageKey(suffix);
        }

        return suffix;
    };

    window.BugaShared = {
        ...shared,
        ...sharedConfig,
        requestWithTimeout,
        getProfileStorageKey
    };
})();
