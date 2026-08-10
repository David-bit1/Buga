const episodeSubmit = document.getElementById('episodeSubmit');
const clearEpisodeFormButton = document.getElementById('clearEpisodeForm');
const pageLoader = document.getElementById('pageLoader');

let seriesCache = [];
let seasonsCache = [];
let episodesCache = [];

const adminAuthFetch = (url, options = {}) => window.BugaAuth?.authFetch?.(url, options) || fetch(url, options);
const notify = (options) => window.BugaToast?.show?.(options);

const requireAdmin = () => {
    const session = window.BugaAuth?.getAuthSession?.();
    if (!session?.token) {
        window.location.href = '/pages/login.html';
        return false;
    }
    if (session.user?.role !== 'admin') {
        window.location.href = '/index.html';
        return false;
    }
    return true;
};

const showLoader = () => {
    document.body.classList.add('is-loading');
    pageLoader?.setAttribute('aria-busy', 'true');
};

const hideLoader = () => {
    document.body.classList.remove('is-loading');
    pageLoader?.setAttribute('aria-busy', 'false');
};

const escapeText = (value) =>
    String(value || '')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, ''');

const fetchJson = async (url, options = {}) => {
    const response = await adminAuthFetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || 'La operación no pudo completarse');
        error.status = response.status;
        throw error;
    }
    return data;
};