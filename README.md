# ISTL — Sistema de Asistencia Virtual Docente

Sistema web para el registro de asistencia de docentes en modalidad híbrida del **Instituto Superior Tecnológico Loja (ISTL)**.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Base de Datos | PostgreSQL 16 + Prisma ORM |
| Caché / Colas | Redis 7 + Bull |
| Contenedores | Docker + Docker Compose |
| Tests | Vitest |

---

## Requisitos Previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 4.x
- [Node.js](https://nodejs.org/) ≥ 20.x (solo para desarrollo local sin Docker)
- Git

---

## Instalación Rápida (Docker — Recomendado)

### 1. Clonar e inicializar variables de entorno

```bash
git clone https://github.com/istl/asistencia-virtual.git
cd Asistencias_Virtuales_ISTL

# Copiar y editar variables de entorno
cp .env.example .env
# ⚠️ Editar .env con tus credenciales reales antes de continuar
```

### 2. Levantar todos los servicios

```bash
docker-compose up -d
```

### 3. Ejecutar migraciones de base de datos

```bash
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma db seed
```

### 4. Acceder a la aplicación

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API Backend | http://localhost:3000 |
| Health Check | http://localhost:3000/health |
| API Docs | http://localhost:3000/api/docs |
| OpenAPI JSON | http://localhost:3000/api/openapi.json |
| Prisma Studio | `docker-compose exec backend npm run db:studio` |

---

## Instalación para Desarrollo Local (sin Docker)

### Backend

```bash
cd backend
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con DATABASE_URL y REDIS_URL locales

# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Iniciar en modo desarrollo (hot-reload)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Ejecutar Tests

```bash
cd backend

# Todos los tests
npm test

# Con coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## Usuarios de Prueba

Después de ejecutar `npm run db:seed`:

| Rol | Email | Contraseña |
|---|---|---|
| TICs | `admin@tecnologicoloja.edu.ec` | `Password123` |
| Docente | `docente@tecnologicoloja.edu.ec` | `Password123` |

El seed crea una clase de desarrollo para el docente en el día actual, con una ventana cercana a la hora de ejecución del seed.

---

## Estructura del Proyecto

```
Asistencias_Virtuales_ISTL/
├── backend/          # API REST (Node.js + Express)
│   ├── prisma/       # Schema y migraciones
│   └── src/
│       ├── config/   # DB, Redis, env
│       ├── modules/  # Auth, asistencia, reportes...
│       └── shared/   # Middleware, utils
├── frontend/         # React 18 + Vite
│   └── src/
│       ├── contexts/ # AuthContext
│       ├── pages/    # Login, Dashboard...
│       └── lib/      # Axios, QueryClient
├── docker-compose.yml
└── .env.example
```

---

## Variables de Entorno

Ver `.env.example` en la raíz del proyecto para la lista completa de variables requeridas.

> ⚠️ **NUNCA** incluir `.env` en el repositorio. Está excluido por `.gitignore`.

---

## API Endpoints (v1)

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Iniciar sesión | Público |
| `GET` | `/api/v1/auth/google` | Iniciar sesión con Google institucional | Público |
| `GET` | `/api/v1/auth/google/callback` | Callback OAuth de Google | Público |
| `POST` | `/api/v1/auth/refresh` | Renovar token | Público |
| `POST` | `/api/v1/auth/logout` | Cerrar sesión | JWT |
| `GET` | `/api/v1/auth/me` | Perfil del usuario | JWT |
| `PUT` | `/api/v1/auth/change-password` | Cambiar contraseña | JWT |
| `GET` | `/api/v1/horarios` | Listar horarios según rol y filtros | JWT |
| `GET` | `/api/v1/horarios/:id` | Obtener detalle de horario | JWT |
| `POST` | `/api/v1/horarios` | Crear horario | Coordinador/TICs/Rectorado |
| `PUT` | `/api/v1/horarios/:id` | Actualizar horario | Coordinador/TICs/Rectorado |
| `DELETE` | `/api/v1/horarios/:id` | Desactivar horario | Coordinador/TICs/Rectorado |
| `GET` | `/api/v1/asistencias` | Listar registros de asistencia según rol | JWT |
| `GET` | `/api/v1/asistencias/estado-actual` | Clase activa y registro abierto del docente | Docente |
| `POST` | `/api/v1/asistencias/entrada` | Marcar ingreso con geolocalización opcional | Docente |
| `POST` | `/api/v1/asistencias/salida` | Marcar salida con geolocalización opcional | Docente |
| `GET` | `/api/v1/reportes/resumen` | Resumen estadístico de asistencias | JWT |
| `GET` | `/api/v1/reportes/pdf` | Descargar reporte PDF | JWT |
| `GET` | `/api/v1/reportes/excel` | Descargar reporte Excel | JWT |
| `GET` | `/api/v1/admin/usuarios` | Listar usuarios institucionales | TICs/Rectorado |
| `POST` | `/api/v1/admin/usuarios` | Crear usuario | TICs/Rectorado |
| `PUT` | `/api/v1/admin/usuarios/:id` | Actualizar usuario o reiniciar contrasena | TICs/Rectorado |
| `GET` | `/api/v1/admin/carreras` | Listar carreras según rol | Coordinador/TICs/Rectorado |
| `POST` | `/api/v1/admin/carreras` | Crear carrera | TICs/Rectorado |
| `PUT` | `/api/v1/admin/carreras/:id` | Actualizar carrera | TICs/Rectorado |
| `GET` | `/api/v1/admin/materias` | Listar materias según rol | Coordinador/TICs/Rectorado |
| `POST` | `/api/v1/admin/materias` | Crear materia | Coordinador/TICs/Rectorado |
| `PUT` | `/api/v1/admin/materias/:id` | Actualizar materia | Coordinador/TICs/Rectorado |
| `GET` | `/api/v1/admin/docentes` | Listar docentes activos | Coordinador/TICs/Rectorado |
| `GET` | `/api/docs` | Documentación HTML de la API | Público |
| `GET` | `/api/openapi.json` | Especificación OpenAPI 3.0 | Público |
| `GET` | `/health` | Estado del servidor | Público |

---

## Seguridad

- Rate limiting general de API configurable con `API_RATE_LIMIT_MAX`/`API_RATE_LIMIT_WINDOW_MS`
- Rate limiting de login: **5 intentos fallidos** por IP cada 15 minutos
- Tokens JWT: Access (8h) + Refresh con rotación (7d)
- CORS restringido a dominios ISTL en producción
- Contraseñas hasheadas con bcrypt (12 rounds)
- Logs de auditoría de todos los accesos

---

## Módulos Disponibles (Roadmap)

- [x] Autenticación (JWT + roles)
- [x] Gestión de horarios
- [x] Registro de asistencia + geolocalización
- [x] Panel de reportes (PDF + Excel)
- [x] API pública OpenAPI 3.0
- [x] Inicio de sesión institucional con Google OAuth (`@tecnologicoloja.edu.ec`)
  - Acceso principal mediante cuenta Google institucional.
  - Mantener login por contraseña solo como contingencia/admin local.
  - Permitir ingreso solo a usuarios existentes en la plataforma para conservar control de roles.
  - Requiere `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, callback OAuth y dominio autorizado.

---

## Validación Operativa

Antes de pasar a un piloto institucional, validar este flujo con datos reales:

1. Crear usuarios de prueba para TICs, coordinación y docentes.
2. Crear carreras, materias y asignar docentes/coordinadores.
3. Crear horarios del ciclo vigente con modalidad y URL de aula virtual.
4. Ingresar como docente y validar horario del día, aula virtual, entrada, salida y justificación.
5. Ingresar como coordinación/TICs y aprobar o rechazar justificaciones.
6. Generar reportes con filtros por carrera, materia, docente, estado y ciclo.
7. Descargar PDF/Excel y verificar que coincidan con la vista previa.

Pruebas automáticas actuales:

- Autenticación y JWT.
- Validaciones de administración: usuarios, carreras y materias.
- Validaciones de horarios.
- Validaciones de filtros de reportes.

---

## Soporte

Contactar al **Área de TICs** del ISTL: `tics@tecnologicoloja.edu.ec`

---

*Desarrollado para el Instituto Superior Tecnológico Loja — Ministerio de Educación del Ecuador*
