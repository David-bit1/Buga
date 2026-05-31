const UserPreferences = require('../models/UserPreferences');
const Profile = require('../models/Profile');

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'b24af203b14e23f8c91844baae37cfab';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_LANGUAGE = 'es-ES';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const MAX_PREVIEW_RESULTS = 30;

const DEFAULT_FALLBACK_GENRES = [28, 18, 35, 80, 878, 14];

const tmdbFetch = async (path, params = {}) => {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY no está configurada');
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', params.language || TMDB_LANGUAGE);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && key !== 'language') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB respondió con ${response.status}`);
  }

  return response.json();
};

const normalizeGenres = (genres = []) =>
  Array.isArray(genres)
    ? genres
        .filter(Boolean)
        .map((genre) => ({
          id: Number(genre.id),
          name: String(genre.name || '').trim()
        }))
        .filter((genre) => Number.isFinite(genre.id))
    : [];

const normalizeMovie = (movie, reason = '', source = '') => {
  const posterPath = movie.poster_path || movie.poster || '';
  const backdropPath = movie.backdrop_path || movie.backdrop || '';
  const genres = normalizeGenres(movie.genres);

  return {
    id: Number(movie.id),
    title: movie.title || movie.original_title || `Película ${movie.id}`,
    overview: movie.overview || movie.description || 'Descripción no disponible.',
    poster: posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : '',
    backdrop: backdropPath ? `${TMDB_IMAGE_BASE}${backdropPath}` : '',
    releaseDate: movie.release_date || movie.releaseDate || '',
    year: movie.release_date ? String(movie.release_date).slice(0, 4) : movie.year || 'N/A',
    voteAverage: Number(movie.vote_average || movie.voteAverage || 0),
    popularity: Number(movie.popularity || 0),
    genreLabel: genres.map((genre) => genre.name).filter(Boolean).join(' • '),
    genres,
    reason,
    source
  };
};

const scoreUpsert = (collection, item, increment) => {
  const index = collection.findIndex((entry) => Number(entry.id) === Number(item.id));
  if (index >= 0) {
    collection[index].score = Number(collection[index].score || 0) + increment;
    collection[index].name = item.name || collection[index].name || '';
    return;
  }

  collection.push({
    id: Number(item.id),
    name: item.name || '',
    score: increment
  });
};

const sortScoreCollection = (collection, limit = 10) =>
  collection
    .sort((left, right) => {
      if ((right.score || 0) !== (left.score || 0)) {
        return (right.score || 0) - (left.score || 0);
      }

      return Number(right.id) - Number(left.id);
    })
    .slice(0, limit);

const moveToFront = (items, value, limit = 20) => {
  const normalized = Number(value);
  const nextItems = items.filter((entry) => Number(entry) !== normalized);
  nextItems.unshift(normalized);
  return nextItems.slice(0, limit);
};

const getProfileOrThrow = async (userId, profileId) => {
  const profile = await Profile.findOne({ _id: profileId, user: userId });
  if (!profile) {
    const error = new Error('Perfil no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return profile;
};

const getOrCreatePreferences = async (userId, profileId) => {
  let preferences = await UserPreferences.findOne({ user: userId, profile: profileId });
  if (!preferences) {
    preferences = await UserPreferences.create({
      user: userId,
      profile: profileId
    });
  }

  return preferences;
};

const resolveMovieDetails = async (movieId, moviePayload = {}, options = {}) => {
  const numericId = Number(movieId);
  if (!Number.isFinite(numericId)) {
    const error = new Error('ID de película inválido');
    error.statusCode = 400;
    throw error;
  }

  const shouldFetchCredits = options.fetchCredits !== false;
  const shouldFetchMovie = !moviePayload || !Array.isArray(moviePayload.genres) || moviePayload.genres.length === 0 || shouldFetchCredits;

  if (!shouldFetchMovie) {
    return {
      ...moviePayload,
      id: numericId,
      genres: normalizeGenres(moviePayload.genres),
      credits: moviePayload.credits || null
    };
  }

  const movie = await tmdbFetch(`/movie/${numericId}`, {
    append_to_response: shouldFetchCredits ? 'credits' : undefined
  });
  return {
    ...movie,
    ...moviePayload,
    id: numericId,
    genres: normalizeGenres(moviePayload.genres || movie.genres),
    credits: moviePayload.credits || movie.credits || null
  };
};

const applyGenreSignals = (preferences, genres, weight) => {
  genres.forEach((genre) => {
    scoreUpsert(preferences.genreScores, { id: genre.id, name: genre.name }, weight);
  });
};

const applyCrewSignals = (preferences, credits, weight) => {
  const cast = Array.isArray(credits?.cast) ? credits.cast.slice(0, 5) : [];
  const directors = Array.isArray(credits?.crew)
    ? credits.crew.filter((person) => person.job === 'Director').slice(0, 2)
    : [];

  cast.forEach((person) => {
    scoreUpsert(preferences.actorScores, {
      id: Number(person.id),
      name: person.name
    }, weight);
  });

  directors.forEach((person) => {
    scoreUpsert(preferences.directorScores, {
      id: Number(person.id),
      name: person.name
    }, weight * 1.5);
  });
};

const upsertWatchEntry = (entries, movie, payload, source = 'watch') => {
  const movieId = Number(movie.id);
  const nextEntry = {
    movieId,
    title: movie.title || payload.title || `Película ${movieId}`,
    poster: movie.poster_path || movie.poster || '',
    backdrop: movie.backdrop_path || movie.backdrop || '',
    genres: normalizeGenres(movie.genres),
    progress: Math.max(0, Math.min(100, Number(payload.progress || 0))),
    currentTime: Math.max(0, Number(payload.currentTime || 0)),
    duration: Math.max(0, Number(payload.duration || movie.runtime || 0)),
    runtime: Math.max(0, Number(movie.runtime || payload.runtime || 0)),
    lastViewed: new Date(),
    source
  };

  const nextEntries = entries.filter((entry) => Number(entry.movieId) !== movieId);
  nextEntries.unshift(nextEntry);
  return nextEntries.slice(0, 25);
};

const removeWatchEntry = (entries, movieId) =>
  entries.filter((entry) => Number(entry.movieId) !== Number(movieId));

const ensureRecentMovieId = (items, movieId) => moveToFront(items, movieId, 20);

const recordEvent = async ({ userId, profileId, payload }) => {
  await getProfileOrThrow(userId, profileId);
  const preferences = await getOrCreatePreferences(userId, profileId);

  const movieId = Number(payload.movieId || payload.id);
  const type = String(payload.type || 'view');
  const action = String(payload.action || '').toLowerCase();

  if (!Number.isFinite(movieId)) {
    const error = new Error('movieId es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  const movie = await resolveMovieDetails(movieId, payload.movie || payload, {
    fetchCredits: type !== 'watch'
  });
  preferences.recentMovieIds = ensureRecentMovieId(preferences.recentMovieIds, movieId);
  preferences.lastInteractionAt = new Date();

  if (type === 'favorite') {
    if (action === 'removed' || action === 'remove' || action === 'delete') {
      preferences.favoriteMovieIds = preferences.favoriteMovieIds.filter((id) => Number(id) !== movieId);
    } else if (!preferences.favoriteMovieIds.some((id) => Number(id) === movieId)) {
      preferences.favoriteMovieIds.unshift(movieId);
    }
    applyGenreSignals(preferences, movie.genres, action === 'removed' ? 0.8 : 1.8);
    applyCrewSignals(preferences, movie.credits, action === 'removed' ? 0.5 : 1.2);
  }

  if (type === 'view' || type === 'watch' || type === 'continue') {
    const progress = Math.max(0, Math.min(100, Number(payload.progress || 0)));

    if (progress >= 90 || payload.ended) {
      preferences.continueWatching = removeWatchEntry(preferences.continueWatching, movieId);
    } else {
      preferences.continueWatching = upsertWatchEntry(preferences.continueWatching, movie, payload, 'continue');
    }

    preferences.watchHistory = upsertWatchEntry(preferences.watchHistory, movie, payload, 'watch');
    applyGenreSignals(preferences, movie.genres, progress >= 60 ? 2.2 : 1.2);
    applyCrewSignals(preferences, movie.credits, progress >= 60 ? 1.4 : 0.8);
  }

  if (type === 'genre' && Array.isArray(payload.genres)) {
    applyGenreSignals(preferences, normalizeGenres(payload.genres), 1.3);
  }

  await preferences.save();

  return preferences;
};

const buildReasonLabel = (entry, fallback = 'Te podría gustar') => {
  const reason = String(entry.reason || '').trim();
  if (reason) {
    return reason;
  }

  return fallback;
};

const collectMovieCandidates = async (requests) => {
  const candidates = new Map();

  const mergeMovie = (movie, scoreBoost, source, reason) => {
    if (!movie?.id) {
      return;
    }

    const movieId = Number(movie.id);
    const existing = candidates.get(movieId);
    const normalizedMovie = normalizeMovie(movie, reason, source);

    if (existing) {
      existing.score += scoreBoost + normalizedMovie.voteAverage * 0.12 + normalizedMovie.popularity * 0.0015;
      existing.reasons.add(reason);
      existing.sources.add(source);
      return;
    }

    candidates.set(movieId, {
      ...normalizedMovie,
      score: scoreBoost + normalizedMovie.voteAverage * 0.12 + normalizedMovie.popularity * 0.0015,
      reasons: new Set([reason]),
      sources: new Set([source])
    });
  };

  await Promise.allSettled(
    requests.map(async (request) => {
      const data = await request.loader();
      const movies = Array.isArray(data?.results) ? data.results : [];
      movies.slice(0, request.limit || 12).forEach((movie) => {
        mergeMovie(movie, request.weight, request.source, request.reasonBuilder(movie));
      });
    })
  );

  return candidates;
};

const buildSeedRequests = (preferences) => {
  const favoriteSeeds = (preferences.favoriteMovieIds || []).slice(0, 4).map((movieId) => ({
    source: `favorite:${movieId}`,
    weight: 4.5,
    reasonBuilder: () => 'Porque viste tus favoritos',
    loader: () => tmdbFetch(`/movie/${movieId}/recommendations`, { page: 1 })
  }));

  const historySeeds = (preferences.recentMovieIds || []).slice(0, 4).map((movieId) => ({
    source: `history:${movieId}`,
    weight: 3.25,
    reasonBuilder: () => 'Porque viste recientemente',
    loader: () => tmdbFetch(`/movie/${movieId}/recommendations`, { page: 1 })
  }));

  const continueSeeds = (preferences.continueWatching || []).slice(0, 3).map((entry) => ({
    source: `continue:${entry.movieId}`,
    weight: 3.75,
    reasonBuilder: () => 'Porque dejaste algo a medias',
    loader: () => tmdbFetch(`/movie/${entry.movieId}/recommendations`, { page: 1 })
  }));

  const genreSeeds = (preferences.genreScores || [])
    .slice(0, 4)
    .map((genre) => ({
      source: `genre:${genre.id}`,
      weight: 3,
      reasonBuilder: () => `Por tus gustos en ${genre.name || 'este género'}`,
      loader: () => tmdbFetch('/discover/movie', {
        page: 1,
        sort_by: 'popularity.desc',
        with_genres: genre.id,
        vote_count_gte: 80
      })
    }));

  const actorSeeds = (preferences.actorScores || [])
    .slice(0, 2)
    .map((actor) => ({
      source: `actor:${actor.id}`,
      weight: 2.25,
      reasonBuilder: () => `Porque te gusta ${actor.name || 'este actor'}`,
      loader: () => tmdbFetch('/discover/movie', {
        page: 1,
        sort_by: 'popularity.desc',
        with_cast: actor.id,
        vote_count_gte: 60
      })
    }));

  const directorSeeds = (preferences.directorScores || [])
    .slice(0, 2)
    .map((director) => ({
      source: `director:${director.id}`,
      weight: 2,
      reasonBuilder: () => `Porque te gusta ${director.name || 'este director'}`,
      loader: () => tmdbFetch('/discover/movie', {
        page: 1,
        sort_by: 'popularity.desc',
        with_crew: director.id,
        vote_count_gte: 60
      })
    }));

  return [...favoriteSeeds, ...continueSeeds, ...historySeeds, ...genreSeeds, ...actorSeeds, ...directorSeeds];
};

const buildFallbackRequests = () => DEFAULT_FALLBACK_GENRES.slice(0, 3).map((genreId) => ({
  source: `fallback:${genreId}`,
  weight: 1.2,
  reasonBuilder: () => 'Te podría gustar',
  loader: () => tmdbFetch('/discover/movie', {
    page: 1,
    sort_by: 'popularity.desc',
    with_genres: genreId,
    vote_count_gte: 100
  })
}));

const getRecommendationsForProfile = async ({ userId, profileId, limit = 12 }) => {
  await getProfileOrThrow(userId, profileId);
  const preferences = await getOrCreatePreferences(userId, profileId);

  const requests = buildSeedRequests(preferences);
  const fallbackRequests = buildFallbackRequests();
  const candidates = await collectMovieCandidates(requests.length > 0 ? requests : fallbackRequests);

  const excludedIds = new Set([
    ...(preferences.favoriteMovieIds || []).map(Number),
    ...(preferences.recentMovieIds || []).map(Number),
    ...(preferences.continueWatching || []).map((entry) => Number(entry.movieId)),
    ...(preferences.watchHistory || []).map((entry) => Number(entry.movieId))
  ]);

  const topMovies = [...candidates.values()]
    .filter((movie) => movie.id && !excludedIds.has(Number(movie.id)))
    .sort((left, right) => {
      if ((right.score || 0) !== (left.score || 0)) {
        return (right.score || 0) - (left.score || 0);
      }

      return (right.voteAverage || 0) - (left.voteAverage || 0);
    })
    .slice(0, limit)
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      overview: movie.overview,
      poster: movie.poster,
      backdrop: movie.backdrop,
      releaseDate: movie.releaseDate,
      year: movie.year,
      voteAverage: movie.voteAverage,
      popularity: movie.popularity,
      genreLabel: movie.genreLabel,
      genres: movie.genres,
      reason: buildReasonLabel({
        reason: [...movie.reasons][0] || movie.reason
      }),
      reasons: [...movie.reasons],
      sources: [...movie.sources],
      score: Number(movie.score.toFixed(2))
    }));

  if (topMovies.length >= limit) {
    return {
      profileId,
      count: topMovies.length,
      recommendations: topMovies
    };
  }

  const fillers = await collectMovieCandidates(fallbackRequests);
  const fillerMovies = [...fillers.values()]
    .filter((movie) => movie.id && !excludedIds.has(Number(movie.id)))
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, limit - topMovies.length)
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      overview: movie.overview,
      poster: movie.poster,
      backdrop: movie.backdrop,
      releaseDate: movie.releaseDate,
      year: movie.year,
      voteAverage: movie.voteAverage,
      popularity: movie.popularity,
      genreLabel: movie.genreLabel,
      genres: movie.genres,
      reason: buildReasonLabel({
        reason: [...movie.reasons][0] || movie.reason
      }),
      reasons: [...movie.reasons],
      sources: [...movie.sources],
      score: Number(movie.score.toFixed(2))
    }));

  return {
    profileId,
    count: topMovies.length + fillerMovies.length,
    recommendations: [...topMovies, ...fillerMovies].slice(0, limit)
  };
};

module.exports = {
  getOrCreatePreferences,
  recordEvent,
  getRecommendationsForProfile
};
