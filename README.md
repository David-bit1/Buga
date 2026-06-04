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
