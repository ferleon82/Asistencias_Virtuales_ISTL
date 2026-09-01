# Guía del Repositorio

## Estructura del Proyecto y Organización de Módulos

Este es un sistema de asistencia docente del ISTL con aplicaciones TypeScript separadas:

- `frontend/`: interfaz React 18 + Vite. Coloque clientes reutilizables en `src/lib/`, estado en `src/contexts/` y funcionalidades del panel en `src/pages/dashboard/`. Los recursos institucionales estáticos están en `public/brand/`.
- `backend/`: API Express. Mantenga el código de dominio en `src/modules/<funcionalidad>/` (rutas, controlador, servicio y pruebas); use `src/config/` para validar el entorno y `src/shared/` para middleware y utilidades transversales.
- `backend/prisma/`: esquema Prisma, migraciones y datos semilla. Nunca edite una migración ya aplicada.
- Los archivos Docker Compose de la raíz levantan todo el entorno local. `docker-compose.override.yml` es local y no debe versionarse.

## Comandos de Compilación, Pruebas y Desarrollo

Ejecute los comandos desde el directorio de la aplicación correspondiente:

```bash
cd frontend && pnpm run dev       # Servidor de desarrollo Vite
cd frontend && pnpm run build     # Verifica tipos y genera el paquete de producción
cd frontend && pnpm run lint      # Ejecuta ESLint sobre la interfaz
cd backend && pnpm run dev        # API Express en modo observación
cd backend && pnpm test           # Suite de Vitest
cd backend && pnpm run build      # Compila TypeScript en dist/
cd backend && pnpm run db:migrate:deploy  # Aplica migraciones Prisma existentes
```

Para el entorno con contenedores, copie `.env.example` a `.env`, configure secretos reales y ejecute `docker compose up -d`.

## Estilo de Código y Convenciones de Nombres

Use TypeScript con configuración estricta del compilador. Mantenga la indentación de dos espacios, comillas simples, punto y coma y exportaciones nombradas cuando sea práctico. Use PascalCase en componentes React (`SpanishDatePicker.tsx`), camelCase en funciones y hooks (`useReports.ts`) y directorios de funcionalidades en minúsculas (`modules/asistencias/`). Prefiera el alias `@/` para importar código fuente. Ejecute lint o compilación antes de enviar cambios.

## Guía de Pruebas

Las pruebas del backend usan Vitest con Node y cobertura V8. Coloque las pruebas unitarias o de integración junto a su módulo como `*.test.ts`; la configuración común está en `backend/src/tests/setup.ts`. Agregue pruebas de comportamiento API, autorización y validación cuando cambie la lógica del backend. Ejecute `pnpm test` antes de abrir un pull request; use `pnpm run test:coverage` al modificar reglas críticas.

## Guía de Commits y Pull Requests

Use asuntos de commit concisos e imperativos en español, como `Mejorar selector de fechas en reportes` o `Agregar paralelos y GPS por entrada y salida`. Mantenga cada commit limitado a un cambio. Los pull requests deben explicar el resultado visible para el usuario, identificar cambios de API o migraciones, enlazar el issue cuando exista e incluir capturas para cambios de interfaz. No versione `.env`, credenciales, secretos de producción ni archivos generados en `dist/`.
