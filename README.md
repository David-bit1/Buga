# Buga

Plataforma de streaming premium con frontend estático y backend separado.

## Estructura

- `frontend/`: interfaz pública, páginas y recursos estáticos.
- `backend/`: API REST, autenticación, perfiles, recomendaciones, administración y HLS.
- `docs/`: documentación técnica y de despliegue.

## Desarrollo

- Frontend: sirve `frontend/` como sitio estático.
- Backend: ejecuta `backend/server.js` con Node.js + Express.

## Producción

- Despliega `frontend/` en Vercel.
- Despliega `backend/` en un servicio Node independiente.
- Las peticiones a `/api` asumen mismo origen o un proxy hacia el backend.
