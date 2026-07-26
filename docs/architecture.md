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
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `TMDB_API_KEY`

## Reproductor

### Adaptadores soportados

- `YouTubeAdapter`
- `Html5Adapter`
- `HlsAdapter`
- `IframeAdapter`

### Contrato obligatorio

Todos los adaptadores deben exponer:

- `play()`
- `pause()`
- `mute()`
- `unmute()`
- `setVolume()`
- `seek()`
- `getCurrentTime()`
- `getDuration()`
- `destroy()`
- `on()`
- `off()`

### Reglas de arquitectura

- `PlayerManager` es la única fuente de verdad para detectar servidor y elegir adaptador.
- La UI debe leer `capabilities` o `supports`, no asumir capacidades por tipo.
- `Html5Adapter` y `HlsAdapter` deben usar siempre `<video>`.
- `YouTubeAdapter` debe usar su propio contenedor dedicado.
- `IframeAdapter` y embeds externos no deben fingir timeline, seek ni volumen si el proveedor no lo soporta.
- `wireAdapterToUI()` solo debe mostrar controles que el adaptador realmente soporte.
- El adaptador anterior debe destruirse antes de montar uno nuevo.
