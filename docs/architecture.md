# Arquitectura de Buga

## Frontend

- Sitio estático con HTML, CSS y JavaScript modular.
- Páginas públicas en `frontend/pages/`.
- Recursos compartidos en `frontend/css/`, `frontend/js/` y `frontend/assets/`.

## Backend

- API REST en `backend/`.
- Autenticación JWT, Supabase, perfiles, recomendaciones, HLS y administración.

## Despliegue

- Frontend listo para Vercel.
- Backend pensado para una instancia Node independiente.
- Si frontend y backend viven en dominios distintos, `/api` debe resolverse por proxy o base URL compartida.

## Variables clave

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `TMDB_API_KEY`
