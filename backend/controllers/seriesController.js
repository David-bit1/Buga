const { insertOne, selectMany, selectOne, updateRows, deleteRows } = require('../services/supabaseRepository');
const { parseServers } = require('../services/serverNormalizer');
const { toInteger, normalizeGenres, normalizeCast } = require('./movieController');

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const serializeSeries = (series) => ({
  id: series.id,
  tmdb_id: series.tmdb_id || null,
  title: series.title,
  original_title: series.original_title || series.title || '',
  description: series.overview || series.description || '',
  overview: series.overview || '',
  poster_url: series.poster_url || '',
  banner_url: series.banner_url || '',
  poster_srcset: series.poster_srcset || '',
  banner_srcset: series.banner_srcset || '',
  release_year: series.release_year || 0,
  first_air_date: series.first_air_date || '',
  genres: series.genres || [],
  rating: series.rating || '',
  cast: series.cast || [],
  creator: series.creator || '',
  trailer: series.trailer || '',
  featured: Boolean(series.featured),
  status: series.status || 'published',
  popularity: series.popularity || 0,
  content_type: series.content_type || 'independent',
  creator_name: series.creator_name || '',
  rights_holder: series.rights_holder || '',
  license_info: series.license_info || '',
  source_url: series.source_url || '',
  created_by: series.created_by,
  created_at: series.created_at,
  updated_at: series.updated_at
});

const serializeSeason = (season) => ({
  id: season.id,
  series_id: season.series_id,
  season_number: season.season_number,
  title: season.title,
  description: season.description || '',
  overview: season.overview || '',
  poster_url: season.poster_url || '',
  banner_url: season.banner_url || '',
  release_date: season.release_date || '',
  tmdb_id: season.tmdb_id || null,
  status: season.status || 'published',
  created_by: season.created_by,
  created_at: season.created_at,
  updated_at: season.updated_at
});

const serializeEpisode = (episode) => ({
  id: episode.id,
  season_id: episode.season_id,
  episode_number: episode.episode_number,
  title: episode.title,
  description: episode.description || '',
  overview: episode.overview || '',
  thumbnail_url: episode.thumbnail_url || '',
  runtime: episode.runtime || 0,
  release_date: episode.release_date || '',
  tmdb_id: episode.tmdb_id || null,
  servers: episode.servers || [],
  status: episode.status || 'published',
  created_by: episode.created_by,
  created_at: episode.created_at,
  updated_at: episode.updated_at
});

// SERIES
const listSeries = async (_req, res, next) => {
  try {
    const series = await selectMany('series', { 
      filters: [{ type: 'eq', column: 'status', value: 'published' }],
      order: { column: 'created_at', ascending: false } 
    });
    return res.json({ series: series.map(serializeSeries) });
  } catch (error) {
    return next(error);
  }
};

const adminListSeries = async (_req, res, next) => {
  try {
    const series = await selectMany('series', { order: { column: 'created_at', ascending: false } });
    return res.json({ series: series.map(serializeSeries) });
  } catch (error) {
    return next(error);
  }
};

const getSeries = async (req, res, next) => {
  try {
    const series = await selectOne('series', { filters: [{ type: 'eq', column: 'id', value: req.params.seriesId }] });
    if (!series) {
      return res.status(404).json({ message: 'Serie no encontrada' });
    }
    return res.json({ series: serializeSeries(series) });
  } catch (error) {
    return next(error);
  }
};

const createSeries = async (req, res, next) => {
  try {
    const { tmdbId, title, servers } = req.body;

    if (!title && !tmdbId) {
      return res.status(400).json({ message: 'Se requiere un título o un TMDb ID.' });
    }

    let tmdbPayload = null;
    // TODO: Add TMDb series lookup if needed

    const finalTitle = String(req.body.title || tmdbPayload?.title || '').trim();
    if (!finalTitle) {
      return res.status(400).json({ message: 'No se pudo determinar un título para la serie.' });
    }

    const insertPayload = {
      tmdb_id: toInteger(req.body.tmdbId || tmdbId, null),
      title: finalTitle,
      original_title: String(req.body.original_title || tmdbPayload?.original_title || '').trim(),
      description: String(req.body.description || tmdbPayload?.description || '').trim(),
      overview: String(req.body.overview || req.body.description || tmdbPayload?.overview || '').trim(),
      poster_url: String(req.body.poster_url || tmdbPayload?.poster_url || '').trim(),
      banner_url: String(req.body.banner_url || tmdbPayload?.banner_url || '').trim(),
      poster_srcset: String(req.body.poster_srcset || tmdbPayload?.poster_srcset || '').trim(),
      banner_srcset: String(req.body.banner_srcset || tmdbPayload?.banner_srcset || '').trim(),
      release_year: toInteger(req.body.release_year || tmdbPayload?.release_year, null),
      first_air_date: String(req.body.first_air_date || tmdbPayload?.first_air_date || '').trim(),
      genres: normalizeGenres(req.body.genres || tmdbPayload?.genres || []),
      rating: String(req.body.rating || tmdbPayload?.rating || '').trim(),
      cast: normalizeCast(req.body.cast || tmdbPayload?.cast || []),
      creator: String(req.body.creator || tmdbPayload?.creator || '').trim(),
      trailer: String(req.body.trailer || tmdbPayload?.trailer || '').trim(),
      featured: Boolean(req.body.featured),
      status: String(req.body.status || 'published'),
      created_by: req.user.id,
      popularity: tmdbPayload?.popularity || 0,
      content_type: String(req.body.content_type || 'independent').trim(),
      creator_name: String(req.body.creator_name || '').trim(),
      rights_holder: String(req.body.rights_holder || '').trim(),
      license_info: String(req.body.license_info || '').trim(),
      source_url: String(req.body.source_url || '').trim(),
    };

    const series = await insertOne('series', insertPayload);
    return res.status(201).json({
      message: 'Serie creada correctamente',
      series: serializeSeries(series)
    });
  } catch (error) {
    if (String(error.code || '').includes('23505') || String(error.message || '').includes('duplicate')) {
      return res.status(409).json({ message: 'Ya existe una serie con ese TMDB ID' });
    }
    return next(error);
  }
};

const updateSeries = async (req, res, next) => {
  try {
    const { seriesId } = req.params;
    const series = await selectOne('series', {
      filters: [{ type: 'eq', column: 'id', value: seriesId }]
    });

    if (!series) {
      return res.status(404).json({ message: 'Serie no encontrada' });
    }

    const updatePayload = {};
    const fields = [
      'tmdbId', 'title', 'original_title', 'description', 'overview', 'poster_url', 'banner_url',
      'poster_srcset', 'banner_srcset',
      'release_year', 'first_air_date', 'rating', 'creator', 'trailer',
      'featured', 'status', 'popularity',
      'content_type', 'creator_name', 'rights_holder', 'license_info', 'source_url'
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        const map = { tmdbId: 'tmdb_id' };
        const target = map[field] || field;
        let value = req.body[field];

        if (['release_year', 'popularity'].includes(field)) {
          value = toInteger(value, series[target]);
        } else if (field === 'tmdbId') {
          value = toInteger(value, null);
        } else if (field === 'featured') {
          value = Boolean(value);
        } else if (field === 'content_type') {
          value = String(value || 'independent').trim();
        } else if (typeof value === 'string') {
          value = value.trim();
        }

        updatePayload[target] = value;
      }
    }

    if (req.body.genres !== undefined) {
      updatePayload.genres = normalizeGenres(req.body.genres);
    }

    if (req.body.cast !== undefined) {
      updatePayload.cast = normalizeCast(req.body.cast);
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ message: 'No se enviaron datos para actualizar' });
    }

    const [updatedSeries] = await updateRows('series', [{ type: 'eq', column: 'id', value: seriesId }], updatePayload);
    return res.json({
      message: 'Serie actualizada correctamente',
      series: serializeSeries(updatedSeries)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteSeries = async (req, res, next) => {
  try {
    const { seriesId } = req.params;
    const deleted = await deleteRows('series', [{ type: 'eq', column: 'id', value: seriesId }]);

    if (!deleted.length) {
      return res.status(404).json({ message: 'Serie no encontrada' });
    }

    return res.json({ message: 'Serie eliminada correctamente' });
  } catch (error) {
    return next(error);
  }
};

// SEASONS
const listSeasons = async (req, res, next) => {
  try {
    const { seriesId } = req.params;
    const seasons = await selectMany('seasons', { 
      filters: [{ type: 'eq', column: 'series_id', value: seriesId }],
      order: { column: 'season_number', ascending: true }
    });
    return res.json({ seasons: seasons.map(serializeSeason) });
  } catch (error) {
    return next(error);
  }
};

const getSeason = async (req, res, next) => {
  try {
    const { seasonId } = req.params;
    const season = await selectOne('seasons', { filters: [{ type: 'eq', column: 'id', value: seasonId }] });
    if (!season) {
      return res.status(404).json({ message: 'Temporada no encontrada' });
    }
    return res.json({ season: serializeSeason(season) });
  } catch (error) {
    return next(error);
  }
};

const createSeason = async (req, res, next) => {
  try {
    const { seriesId } = req.params;
    const { season_number, title, description, overview, poster_url, banner_url, release_date, tmdbId, status } = req.body;

    if (!season_number) {
      return res.status(400).json({ message: 'El número de temporada es obligatorio' });
    }

    const existing = await selectOne('seasons', {
      filters: [
        { type: 'eq', column: 'series_id', value: seriesId },
        { type: 'eq', column: 'season_number', value: season_number }
      ]
    });

    if (existing) {
      return res.status(409).json({ message: 'Ya existe una temporada con ese número para esta serie' });
    }

    const season = await insertOne('seasons', {
      series_id: seriesId,
      season_number: toInteger(season_number),
      title: String(title || '').trim(),
      description: String(description || '').trim(),
      overview: String(overview || '').trim(),
      poster_url: String(poster_url || '').trim(),
      banner_url: String(banner_url || '').trim(),
      release_date: String(release_date || '').trim(),
      tmdb_id: tmdbId ? toInteger(tmdbId) : null,
      status: String(status || 'published'),
      created_by: req.user.id
    });

    return res.status(201).json({
      message: 'Temporada creada correctamente',
      season: serializeSeason(season)
    });
  } catch (error) {
    return next(error);
  }
};

const updateSeason = async (req, res, next) => {
  try {
    const { seasonId } = req.params;
    const season = await selectOne('seasons', {
      filters: [{ type: 'eq', column: 'id', value: seasonId }]
    });

    if (!season) {
      return res.status(404).json({ message: 'Temporada no encontrada' });
    }

    const updatePayload = {};
    const fields = [
      'title', 'description', 'overview', 'poster_url', 'banner_url', 
      'release_date', 'tmdbId', 'status'
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        const map = { tmdbId: 'tmdb_id' };
        const target = map[field] || field;
        let value = req.body[field];
        if (typeof value === 'string') {
          value = value.trim();
        }
        updatePayload[target] = value;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ message: 'No se enviaron datos para actualizar' });
    }

    const [updatedSeason] = await updateRows('seasons', [{ type: 'eq', column: 'id', value: seasonId }], updatePayload);
    return res.json({
      message: 'Temporada actualizada correctamente',
      season: serializeSeason(updatedSeason)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteSeason = async (req, res, next) => {
  try {
    const { seasonId } = req.params;
    const deleted = await deleteRows('seasons', [{ type: 'eq', column: 'id', value: seasonId }]);

    if (!deleted.length) {
      return res.status(404).json({ message: 'Temporada no encontrada' });
    }

    return res.json({ message: 'Temporada eliminada correctamente' });
  } catch (error) {
    return next(error);
  }
};

// EPISODES
const listEpisodes = async (req, res, next) => {
  try {
    const { seasonId } = req.params;
    const episodes = await selectMany('episodes', { 
      filters: [{ type: 'eq', column: 'season_id', value: seasonId }],
      order: { column: 'episode_number', ascending: true }
    });
    return res.json({ episodes: episodes.map(serializeEpisode) });
  } catch (error) {
    return next(error);
  }
};

const getEpisode = async (req, res, next) => {
  try {
    const { episodeId } = req.params;
    const episode = await selectOne('episodes', { filters: [{ type: 'eq', column: 'id', value: episodeId }] });
    if (!episode) {
      return res.status(404).json({ message: 'Episodio no encontrado' });
    }
    return res.json({ episode: serializeEpisode(episode) });
  } catch (error) {
    return next(error);
  }
};

const createEpisode = async (req, res, next) => {
  try {
    const { seasonId } = req.params;
    const { episode_number, title, description, overview, thumbnail_url, runtime, release_date, tmdbId, servers, status } = req.body;

    if (!episode_number || !title) {
      return res.status(400).json({ message: 'El número de episodio y título son obligatorios' });
    }

    const existing = await selectOne('episodes', {
      filters: [
        { type: 'eq', column: 'season_id', value: seasonId },
        { type: 'eq', column: 'episode_number', value: episode_number }
      ]
    });

    if (existing) {
      return res.status(409).json({ message: 'Ya existe un episodio con ese número para esta temporada' });
    }

    const episode = await insertOne('episodes', {
      season_id: seasonId,
      episode_number: toInteger(episode_number),
      title: String(title || '').trim(),
      description: String(description || '').trim(),
      overview: String(overview || '').trim(),
      thumbnail_url: String(thumbnail_url || '').trim(),
      runtime: toInteger(runtime, 0),
      release_date: String(release_date || '').trim(),
      tmdb_id: tmdbId ? toInteger(tmdbId) : null,
      servers: parseServers(servers || []),
      status: String(status || 'published'),
      created_by: req.user.id
    });

    return res.status(201).json({
      message: 'Episodio creado correctamente',
      episode: serializeEpisode(episode)
    });
  } catch (error) {
    return next(error);
  }
};

const updateEpisode = async (req, res, next) => {
  try {
    const { episodeId } = req.params;
    const episode = await selectOne('episodes', {
      filters: [{ type: 'eq', column: 'id', value: episodeId }]
    });

    if (!episode) {
      return res.status(404).json({ message: 'Episodio no encontrado' });
    }

    const updatePayload = {};
    const fields = [
      'title', 'description', 'overview', 'thumbnail_url', 'runtime', 
      'release_date', 'tmdbId', 'servers', 'status'
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        const map = { tmdbId: 'tmdb_id' };
        const target = map[field] || field;
        let value = req.body[field];

        if (['runtime'].includes(field)) {
          value = toInteger(value, episode[target]);
        } else if (field === 'tmdbId') {
          value = toInteger(value, null);
        } else if (field === 'servers') {
          value = parseServers(value || []);
        } else if (typeof value === 'string') {
          value = value.trim();
        }

        updatePayload[target] = value;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ message: 'No se enviaron datos para actualizar' });
    }

    const [updatedEpisode] = await updateRows('episodes', [{ type: 'eq', column: 'id', value: episodeId }], updatePayload);
    return res.json({
      message: 'Episodio actualizado correctamente',
      episode: serializeEpisode(updatedEpisode)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteEpisode = async (req, res, next) => {
  try {
    const { episodeId } = req.params;
    const deleted = await deleteRows('episodes', [{ type: 'eq', column: 'id', value: episodeId }]);

    if (!deleted.length) {
      return res.status(404).json({ message: 'Episodio no encontrado' });
    }

    return res.json({ message: 'Episodio eliminado correctamente' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listSeries,
  adminListSeries,
  getSeries,
  createSeries,
  updateSeries,
  deleteSeries,
  listSeasons,
  getSeason,
  createSeason,
  updateSeason,
  deleteSeason,
  listEpisodes,
  getEpisode,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  serializeSeries,
  serializeSeason,
  serializeEpisode
};