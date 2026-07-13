# ISTL - Sistema de Asistencia Virtual Docente

Sistema web para el registro, control y reporte de asistencia docente en modalidad presencial, virtual o híbrida del **Instituto Superior Tecnológico Loja (ISTL)**.

El proyecto se encuentra en estado **MVP funcional**: permite autenticación institucional, administracion academica basica, gestion de horarios, marcación de entrada/salida, control de duplicados, geolocalización opcional y reportes.

---

## Estado Actual

- Login institucional con Google OAuth para cuentas `@tecnologicoloja.edu.ec`.
- Login por correo/contraseña disponible como contingencia administrativa.
- Roles principales: TICs, Rectorado, Coordinador y Docente.
- Administración de usuarios, carreras, materias, docentes y horarios.
- Marcación docente de entrada y salida con reglas de horario.
- Bloqueo de marcaciones duplicadas por clase y día.
- Salida habilitada solo desde 10 minutos antes de la hora de fin configurada.
- Registro de geolocalización cuando el navegador entrega permiso.
- Visualizacion de ubicación GPS mediante enlace a Google Maps.
- Reportes con filtros y exportacion PDF/Excel.
- API documentada en Swagger/OpenAPI.
- Docker Compose para levantar frontend, backend, PostgreSQL y Redis.

---

## Stack Tecnológico

| Capa | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL 16 + Prisma ORM |
| Cache / colas | Redis 7 + Bull |
| Contenedores | Docker + Docker Compose |
| Tests | Vitest |

---

## Requisitos Previos

- Docker Desktop 4.x o superior.
- Node.js 20.x o superior y pnpm 9.x, solo para desarrollo local sin Docker.
- Git.
- Credenciales OAuth de Google Cloud para el inicio de sesión institucional.

---

## Instalacion Rapida con Docker

### 1. Configurar variables de entorno

Copiar el archivo de ejemplo:

```bash
cp .env.example .env
```

Editar `.env` y completar los valores reales:

```env
POSTGRES_PASSWORD=...
REDIS_PASSWORD=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
GOOGLE_ALLOWED_DOMAIN=tecnologicoloja.edu.ec
```

Importante: `.env` y los archivos `client_secret_*.json` no deben subirse al repositorio.

### 2. Levantar servicios

```bash
docker compose up -d
```

### 3. Ejecutar migraciones y seed

```bash
docker compose exec backend pnpm exec prisma migrate deploy
docker compose exec backend pnpm run db:seed
```

### 4. Acceder a la aplicacion

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API Backend | http://localhost:3000 |
| Health Check | http://localhost:3000/health |
| API Docs | http://localhost:3000/api/docs |
| OpenAPI JSON | http://localhost:3000/api/openapi.json |
| Prisma Studio | `docker compose exec backend pnpm run db:studio` |

---

## Configuracion de Google OAuth

En Google Cloud Console, el cliente OAuth debe ser de tipo **Aplicacion web**.

Configurar:

| Seccion | Valor local |
|---|---|
| Origenes autorizados de JavaScript | `http://localhost:5173` |
| URI de redireccionamiento autorizado | `http://localhost:3000/api/v1/auth/google/callback` |

Notas:

- El origen JavaScript no debe incluir ruta, solo protocolo, host y puerto.
- El callback si debe ir en **URIs de redireccionamiento autorizados**.
- El backend valida que el correo pertenezca al dominio configurado en `GOOGLE_ALLOWED_DOMAIN`.
- El usuario debe existir previamente en la plataforma para conservar el control de roles.

---

## Desarrollo Local sin Docker

### Backend

```bash
cd backend
pnpm install
pnpm run db:generate
pnpm run db:migrate
pnpm run dev
```

### Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

---

## Comandos de Verificación

### Backend

```bash
cd backend
pnpm test
pnpm run build
```

### Frontend

```bash
cd frontend
pnpm run build
```

### Docker

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

---

## Usuarios de Prueba

Despues de ejecutar el seed:

| Rol | Email | Contraseña |
|---|---|---|
| TICs | `admin@tecnologicoloja.edu.ec` | `Password123` |
| Docente | `docente@tecnologicoloja.edu.ec` | `Password123` |

El seed crea datos de desarrollo para validar el flujo inicial. Para pruebas reales se recomienda crear carreras, materias, docentes y horarios desde el panel administrativo.

---

## Reglas de Marcación

- El docente solo puede marcar dentro de una clase activa del dia.
- Una vez registrada entrada y salida para una clase, no se puede volver a marcar la misma clase.
- La salida queda bloqueada despues de marcar entrada y se habilita desde 10 minutos antes de la hora de fin del horario.
- Si la clase ya finalizó, no se habilita como clase activa para nuevas marcaciones.
- La geolocalización depende del permiso del navegador y del dispositivo.
- Si existe GPS, el sistema guarda latitud, longitud y precision aproximada en metros.

---

## Reportes

El modulo de reportes permite consultar asistencia por filtros como carrera, materia, docente, estado y ciclo.

Los reportes incluyen:

- Resumen estadistico.
- Vista previa de marcaciones.
- Coordenadas GPS cuando estan disponibles.
- Enlace a Google Maps para revisar la ubicación registrada.
- Exportacion PDF con encabezado institucional, resumen y detalle paginado.
- Exportacion Excel.

La especificacion OpenAPI documenta los endpoints principales, OAuth institucional, GPS, estados de marcación y exportaciones.

---

## API Endpoints Principales

| Metodo | Ruta | Descripcion | Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Iniciar sesión con correo/contraseña | Publico |
| `GET` | `/api/v1/auth/google` | Iniciar sesión con Google institucional | Publico |
| `GET` | `/api/v1/auth/google/callback` | Callback OAuth de Google | Publico |
| `POST` | `/api/v1/auth/refresh` | Renovar token | Publico |
| `POST` | `/api/v1/auth/logout` | Cerrar sesión | JWT |
| `GET` | `/api/v1/auth/me` | Perfil del usuario autenticado | JWT |
| `GET` | `/api/v1/horarios` | Listar horarios según rol y filtros | JWT |
| `POST` | `/api/v1/horarios` | Crear horario | Coordinador/TICs/Rectorado |
| `PUT` | `/api/v1/horarios/:id` | Actualizar horario | Coordinador/TICs/Rectorado |
| `DELETE` | `/api/v1/horarios/:id` | Desactivar horario | Coordinador/TICs/Rectorado |
| `GET` | `/api/v1/asistencias` | Listar asistencias según rol | JWT |
| `GET` | `/api/v1/asistencias/estado-actual` | Clase activa y registro abierto | Docente |
| `POST` | `/api/v1/asistencias/entrada` | Marcar ingreso | Docente |
| `POST` | `/api/v1/asistencias/salida` | Marcar salida | Docente |
| `GET` | `/api/v1/reportes/resumen` | Resumen estadistico | JWT |
| `GET` | `/api/v1/reportes/pdf` | Descargar reporte PDF | JWT |
| `GET` | `/api/v1/reportes/excel` | Descargar reporte Excel | JWT |
| `GET` | `/api/v1/admin/usuarios` | Listar usuarios | TICs/Rectorado |
| `POST` | `/api/v1/admin/usuarios` | Crear usuario | TICs/Rectorado |
| `PUT` | `/api/v1/admin/usuarios/:id` | Actualizar usuario | TICs/Rectorado |
| `GET` | `/api/v1/admin/carreras` | Listar carreras | Coordinador/TICs/Rectorado |
| `POST` | `/api/v1/admin/carreras` | Crear carrera | TICs/Rectorado |
| `PUT` | `/api/v1/admin/carreras/:id` | Actualizar carrera | TICs/Rectorado |
| `GET` | `/api/v1/admin/materias` | Listar materias | Coordinador/TICs/Rectorado |
| `POST` | `/api/v1/admin/materias` | Crear materia | Coordinador/TICs/Rectorado |
| `PUT` | `/api/v1/admin/materias/:id` | Actualizar materia | Coordinador/TICs/Rectorado |
| `GET` | `/api/v1/admin/docentes` | Listar docentes activos | Coordinador/TICs/Rectorado |
| `GET` | `/api/docs` | Documentacion HTML de la API | Publico |
| `GET` | `/api/openapi.json` | Especificacion OpenAPI | Publico |
| `GET` | `/health` | Estado del servidor | Publico |

---

## Seguridad

- Rate limiting general configurable con `API_RATE_LIMIT_MAX` y `API_RATE_LIMIT_WINDOW_MS`.
- Rate limiting estricto de login: 5 intentos fallidos por IP cada 15 minutos.
- Tokens JWT de acceso y refresh.
- Refresh token con rotacion.
- Contraseñas hasheadas con bcrypt.
- CORS configurable para produccion.
- Control de acceso por roles.
- Registro de auditoria para eventos relevantes.

---

## Estructura del Proyecto

```text
Asistencias_Virtuales_ISTL/
|-- backend/              # API REST Node.js + Express
|   |-- prisma/           # Schema, migraciones y seed
|   |-- src/
|       |-- config/       # DB, Redis, env
|       |-- modules/      # Auth, asistencias, horarios, reportes, admin
|       |-- shared/       # Middleware y utilidades
|-- frontend/             # React + Vite
|   |-- src/
|       |-- contexts/     # AuthContext
|       |-- pages/        # Login y Dashboard
|       |-- lib/          # Axios y QueryClient
|-- docker-compose.yml
|-- .env.example
```

---

## Validacion Operativa Recomendada

Antes de pasar a un piloto institucional:

1. Crear usuarios reales para TICs, coordinacion, rectorado y docentes.
2. Crear carreras y materias reales.
3. Asignar docentes y coordinadores.
4. Crear horarios del ciclo vigente.
5. Probar login institucional con Google.
6. Probar marcación desde computador y celular.
7. Validar permiso de ubicación GPS en navegadores usados por docentes.
8. Confirmar que la salida se habilite solo en la ventana permitida.
9. Generar reportes por carrera, materia, docente, estado y ciclo.
10. Descargar PDF/Excel y comparar contra la vista previa.

---

## Pendientes Tecnicos Recomendados

1. Dividir `Dashboard.tsx` en componentes mas pequenos para facilitar mantenimiento.
2. Definir texto de privacidad/consentimiento para el uso de geolocalización.
3. Revisar despliegue productivo: HTTPS, dominio real, secretos, backups y URI OAuth definitivo.

---

## Soporte

Contactar al Area de TICs del ISTL: `tics@tecnologicoloja.edu.ec`

---

Desarrollado para el Instituto Superior Tecnológico Loja.
