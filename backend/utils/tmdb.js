const TMDB_API_KEY = process.env.TMDB_API_KEY || 'b24af203b14e23f8c91844baae37cfab';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_LANGUAGE = 'es-ES';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMAGE_BASE_W780 = 'https://image.tmdb.org/t/p/w780';

const toInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const toBoolean = (value) =>
  value === true || value === 'true' || value === 1 || value === '1' || value === 'on';

const tmdbFetch = async (path) => {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY no está configurada');
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', TMDB_LANGUAGE);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Could not read error body');
      throw new Error(`TMDb responded with status ${response.status}: ${errorBody}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const buildTmdbMoviePayload = async (tmdbId) => {
  if (!tmdbId) {
    return null;
  }

  const movie = await tmdbFetch(`/movie/${tmdbId}?append_to_response=credits,videos`);
  console.log('[BUGA TMDB RAW]', JSON.stringify(movie, null, 2));

  const credits = movie.credits || {};
  const videos = movie.videos || {};
  const productionCompanies = Array.isArray(movie.production_companies)
    ? movie.production_companies.map((company) => company.name).filter(Boolean)
    : [];

  const genres = Array.isArray(movie.genres)
    ? movie.genres.map((genre) => genre.name).filter(Boolean)
    : [];

  const trailer = (Array.isArray(videos.results) ? videos.results : [])
    .find(video =>
      video.site === 'YouTube' &&
      (video.type === 'Trailer' || video.type === 'Teaser')
    )?.key || '';

  const cast = Array.isArray(credits.cast) ? credits.cast.slice(0, 10).map(c => c.name) : [];

  const director = (Array.isArray(credits.crew) ? credits.crew : [])
    .find(person => person.job === 'Director')?.name || '';

  const payload = {
    tmdb_id: Number(movie.id),
    title: String(movie.title || movie.original_title || '').trim(),
    original_title: String(movie.original_title || movie.title || '').trim(),
    description: String(movie.overview || '').trim(),
    overview: String(movie.overview || '').trim(),
    poster_url: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : '',
    poster_srcset: movie.poster_path
      ? `https://image.tmdb.org/t/p/w185${movie.poster_path} 185w, https://image.tmdb.org/t/p/w342${movie.poster_path} 342w, https://image.tmdb.org/t/p/w500${movie.poster_path} 500w`
      : '',
    banner_url: movie.backdrop_path ? `${TMDB_IMAGE_BASE_W780}${movie.backdrop_path}` : '',
    banner_srcset: movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w300${movie.backdrop_path} 300w, https://image.tmdb.org/t/p/w780${movie.backdrop_path} 780w, https://image.tmdb.org/t/p/w1280${movie.backdrop_path} 1280w`
      : '',
    release_year: toInteger(String(movie.release_date || '').slice(0, 4), 0),
    release_date: movie.release_date || '',
    runtime: toInteger(movie.runtime, 0),
    country: Array.isArray(movie.production_countries) && movie.production_countries.length > 0
      ? String(movie.production_countries[0]?.name || movie.production_countries[0]?.iso_3166_1 || '').trim()
      : (Array.isArray(movie.origin_country) && movie.origin_country.length > 0
        ? String(movie.origin_country[0] || '').trim()
        : ''),
    language: String(movie.spoken_languages?.[0]?.english_name || movie.spoken_languages?.[0]?.name || movie.original_language || '').trim(),
    genres,
    rating: movie.vote_average > 0 ? String(movie.vote_average.toFixed(1)) : '',
    cast,
    director,
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer}` : '',
    popularity: Number(movie.popularity || 0),
    creator_name: productionCompanies[0] || '',
    rights_holder: productionCompanies.join(', '),
    source_url: `https://www.themoviedb.org/movie/${movie.id}`,
    production_companies: productionCompanies
  };

  console.log('[BUGA TMDB NORMALIZED]', JSON.stringify(payload, null, 2));
  return payload;
};

const buildTmdbSeriesPayload = async (tmdbId) => {
  if (!tmdbId) {
    return null;
  }

  const series = await tmdbFetch(`/tv/${tmdbId}?append_to_response=credits,videos,content_ratings`);
  const credits = series.credits || {};
  const videos = series.videos || {};
  const contentRatings = series.content_ratings || {};
  const productionCompanies = Array.isArray(series.production_companies)
    ? series.production_companies.map((company) => company.name).filter(Boolean)
    : [];
  const networks = Array.isArray(series.networks)
    ? series.networks.map((network) => network.name).filter(Boolean)
    : [];
  const firstAirDate = String(series.first_air_date || '').trim();

  const trailer = (Array.isArray(videos.results) ? videos.results : [])
    .find((video) => video.site === 'YouTube' && (video.type === 'Trailer' || video.type === 'Teaser'))?.key || '';

  const cast = Array.isArray(credits.cast) ? credits.cast.slice(0, 10).map((person) => person.name).filter(Boolean) : [];
  const creator = Array.isArray(series.created_by) && series.created_by.length > 0
    ? String(series.created_by[0]?.name || '').trim()
    : '';
  const rating = (Array.isArray(contentRatings.results) ? contentRatings.results : [])
    .find((item) => item.iso_3166_1 === 'US')?.rating
    || (Array.isArray(contentRatings.results) ? contentRatings.results[0]?.rating : '')
    || '';
  const genres = Array.isArray(series.genres) ? series.genres.map((genre) => genre.name).filter(Boolean) : [];

  return {
    tmdb_id: Number(series.id),
    title: String(series.name || series.original_name || '').trim(),
    original_title: String(series.original_name || series.name || '').trim(),
    description: String(series.overview || '').trim(),
    overview: String(series.overview || '').trim(),
    poster_url: series.poster_path ? `${TMDB_IMAGE_BASE}${series.poster_path}` : '',
    poster_srcset: series.poster_path
      ? `https://image.tmdb.org/t/p/w185${series.poster_path} 185w, https://image.tmdb.org/t/p/w342${series.poster_path} 342w, https://image.tmdb.org/t/p/w500${series.poster_path} 500w`
      : '',
    banner_url: series.backdrop_path ? `${TMDB_IMAGE_BASE_W780}${series.backdrop_path}` : '',
    banner_srcset: series.backdrop_path
      ? `https://image.tmdb.org/t/p/w300${series.backdrop_path} 300w, https://image.tmdb.org/t/p/w780${series.backdrop_path} 780w, https://image.tmdb.org/t/p/w1280${series.backdrop_path} 1280w`
      : '',
    release_year: toInteger(firstAirDate.slice(0, 4), 0),
    first_air_date: firstAirDate,
    genres,
    rating,
    cast,
    creator,
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer}` : '',
    popularity: Number(series.popularity || 0),
    creator_name: creator,
    rights_holder: [...productionCompanies, ...networks].join(', '),
    source_url: `https://www.themoviedb.org/tv/${series.id}`,
    production_companies: productionCompanies,
    networks
  };
};

module.exports = {
  tmdbFetch,
  buildTmdbMoviePayload,
  buildTmdbSeriesPayload,
  toInteger,
  toBoolean,
  TMDB_API_KEY,
  TMDB_BASE_URL,
  TMDB_LANGUAGE,
  TMDB_IMAGE_BASE,
  TMDB_IMAGE_BASE_W780
};