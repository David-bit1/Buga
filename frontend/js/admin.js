(function () {
const ADMIN_API = '/api/admin';

const adminSidebar = document.getElementById('adminSidebar');
const adminLogout = document.getElementById('adminLogout');
const adminRefresh = document.getElementById('adminRefresh');
const pageLoader = document.getElementById('pageLoader');

const adminStats = document.getElementById('adminStats');
const recentUsers = document.getElementById('recentUsers');
const recentMovies = document.getElementById('recentMovies');

const moviesTable = document.getElementById('moviesTable');
const usersTable = document.getElementById('usersTable');
const genresTable = document.getElementById('genresTable');

const movieForm = document.getElementById('movieForm');
const movieId = document.getElementById('movieId');
const movieTmdbId = document.getElementById('movieTmdbId');
const fetchTmdbDataButton = document.getElementById('fetchTmdbData');
const movieTitle = document.getElementById('movieTitle');
const movieOriginalTitle = document.getElementById('movieOriginalTitle');
const movieOverview = document.getElementById('movieOverview');
const movieDescription = document.getElementById('movieDescription');
const moviePosterUrl = document.getElementById('moviePosterUrl');
const movieBannerUrl = document.getElementById('movieBannerUrl');
const movieReleaseYear = document.getElementById('movieReleaseYear');
const movieReleaseDate = document.getElementById('movieReleaseDate');
const movieRuntime = document.getElementById('movieRuntime');
const movieCountry = document.getElementById('movieCountry');
const movieLanguage = document.getElement<|tool_call_begin|>api<|tool_call_begin|><|tool_call_begin|>orm<|tool_call_begin|>ant<|tool_call_begin|>a