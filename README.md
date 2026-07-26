# Buga

Plataforma de streaming premium con frontend estático, backend separado y base de datos en Supabase.

## Estructura

- `frontend/`: interfaz pública, páginas y recursos estáticos.
- `backend/`: API REST, autenticación JWT, perfiles, recomendaciones, administración, HLS y Supabase.
- `docs/`: documentación técnica y de despliegue.

## Desarrollo

- Frontend: sirve `frontend/` como sitio estático.
- Backend: ejecuta `backend/server.js` con Node.js + Express.

## Producción

- Despliega `frontend/` en Vercel.
- Despliega `backend/` en un servicio Node independiente.
- El frontend necesita apuntar al backend de Render mediante `/api` proxy o una base URL compartida.

## Variables de entorno del backend

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `TMDB_API_KEY`
- `ADMIN_EMAILS`

## Contrato del reproductor

### Adaptadores soportados

- `YouTubeAdapter`
- `Html5Adapter`
- `HlsAdapter`
- `IframeAdapter`

### Interfaz obligatoria

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

- `PlayerManager` es la única fuente de verdad para detectar el servidor y elegir el adaptador.
- La UI debe leer `capabilities` o `supports`, no asumir capacidades por tipo.
- `Html5Adapter` y `HlsAdapter` deben usar siempre `<video>`.
- `YouTubeAdapter` debe usar su propio contenedor dedicado.
- `IframeAdapter` y embeds externos no deben fingir timeline, seek ni volumen si el proveedor no lo soporta.
- `wireAdapterToUI()` solo debe mostrar controles que el adaptador realmente soporte.
- El adaptador anterior debe destruirse antes de montar uno nuevo.
