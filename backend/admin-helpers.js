/**
 * Buga Admin Helpers
 *
 * Este script añade la funcionalidad de autocompletar el formulario de películas
 * al introducir un ID de TMDb.
 *
 * Requisitos en el HTML:
 * - Un campo de texto con el id `tmdbId`.
 * - Un botón con el id `fetchTmdbData`.
 * - Campos de formulario con los siguientes ids para autocompletar:
 *   `title`, `original_title`, `overview`, `release_year`, `runtime`, `poster_url`, `banner_url`.
 */
document.addEventListener('DOMContentLoaded', () => {
  const tmdbIdInput = document.getElementById('tmdbId');
  const fetchButton = document.getElementById('fetchTmdbData');

  if (!tmdbIdInput || !fetchButton) {
    console.warn('Admin Helpers: No se encontraron los campos #tmdbId o #fetchTmdbData. La funcionalidad de autocompletar está desactivada.');
    return;
  }

  const fieldsToFill = {
    title: document.getElementById('title'),
    original_title: document.getElementById('original_title'),
    overview: document.getElementById('overview'),
    release_year: document.getElementById('release_year'),
    runtime: document.getElementById('runtime'),
    poster_url: document.getElementById('poster_url'),
    banner_url: document.getElementById('banner_url'),
  };

  const fetchMovieData = async () => {
    const tmdbId = tmdbIdInput.value.trim();
    if (!tmdbId) {
      alert('Por favor, introduce un ID de TMDb.');
      return;
    }

    // Mostramos un estado de carga en el botón
    const originalButtonText = fetchButton.textContent;
    fetchButton.disabled = true;
    fetchButton.textContent = 'Buscando...';

    try {
      // La URL de la API debe ser la de tu backend
      const response = await fetch(`/api/movies/tmdb/${tmdbId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'No se encontró la película o hubo un error en el servidor.');
      }

      // Rellenamos los campos del formulario
      if (fieldsToFill.title) fieldsToFill.title.value = data.title || '';
      if (fieldsToFill.original_title) fieldsToFill.original_title.value = data.original_title || '';
      if (fieldsToFill.overview) fieldsToFill.overview.value = data.overview || '';
      if (fieldsToFill.release_year) fieldsToFill.release_year.value = data.release_date ? data.release_date.substring(0, 4) : '';
      if (fieldsToFill.runtime) fieldsToFill.runtime.value = data.runtime || '';

      // Construimos las URLs de las imágenes de TMDb
      const imageBaseUrl = 'https://image.tmdb.org/t/p/original';
      if (fieldsToFill.poster_url && data.poster_path) {
        fieldsToFill.poster_url.value = `${imageBaseUrl}${data.poster_path}`;
      }
      if (fieldsToFill.banner_url && data.backdrop_path) {
        fieldsToFill.banner_url.value = `${imageBaseUrl}${data.backdrop_path}`;
      }

      alert('Datos de la película cargados correctamente.');

    } catch (error) {
      console.error('Error al obtener datos de TMDb:', error);
      alert(`Error: ${error.message}`);
    } finally {
      // Restauramos el botón
      fetchButton.disabled = false;
      fetchButton.textContent = originalButtonText;
    }
  };

  fetchButton.addEventListener('click', fetchMovieData);
  tmdbIdInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Evita que el formulario se envíe
      fetchMovieData();
    }
  });
});