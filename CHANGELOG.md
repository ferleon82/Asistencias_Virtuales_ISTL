# Bitacora de cambios

Este archivo registra los cambios funcionales y tecnicos relevantes del
sistema. Para el detalle exacto de cada cambio, revise el commit indicado con
`git show <hash>`.

## [En desarrollo]

### Horas administrativas en el dashboard

- El dashboard institucional tiene un selector Clases / Horas administrativas.
  En horas administrativas los indicadores y graficos usan los bloques
  administrativos y el grafico principal se agrupa por docente.
- TICs y Rectorado pueden consultar el reporte de jornada administrativa
  (antes solo Talento Humano y el propio docente). Coordinacion no.
- La lectura rapida del dashboard calcula los porcentajes sobre las clases
  (o bloques) programadas: antes mostraba valores como 4200% en ausencias.

### Panel del frontend (fase 5 del refactor)

- `Dashboard.tsx` paso de 1067 a ~480 lineas: la gestion de horarios y la
  academica viven en `useScheduleManagement` y `useAcademicManagement`, y la
  cabecera, KPIs, pestanas y tarjetas de marcacion son componentes propios.
- Cada modulo se descarga al abrir su pestana (`React.lazy`). El paquete del
  panel bajo de 563 KB a ~45 KB; la libreria de graficos solo se carga en el
  Dashboard.
- Las siete copias de `getApiMessage` se unificaron en `src/lib/apiError.ts`.
- El docente ya no pide carreras, materias ni docentes (respondian 403 cada
  30 s) y su filtro de periodo academico en Reportes vuelve a funcionar.
- Las tarjetas superiores muestran siempre la asistencia del dia actual, sin
  depender de los filtros de Reportes.

### Seguridad de sesion y fotos (fase 4 del refactor)

- En cada peticion se confirma que el usuario siga activo y se usa su rol
  vigente (cache de 30 s). Un usuario desactivado pierde el acceso de
  inmediato en lugar de conservarlo hasta que vence su token (8 h).
- Las fotos de asistencia ya no son publicas en `/uploads`: se entregan con
  enlaces firmados que vencen en `/api/v1/fotos/:archivo` (2 h en pantalla,
  7 dias en el Excel).
- Almacenamiento de fotos configurable con `PHOTO_STORAGE`: `local` en
  desarrollo y bucket privado de Supabase Storage en produccion. Ver README.
- Sin migraciones: las referencias guardadas en la base no cambian.

### Reportes por modulos (fase 3 del refactor)

- `reportes.service.ts` se dividio en consultas y rango de fechas
  (`reportes.query.ts`), calculo de sesiones (`reportes.sessions.ts`), formato,
  PDF (`reportes.pdf.ts`) y Excel (`reportes.excel.ts`). Se verifico que el
  resumen, el Excel y el PDF fueran identicos a los anteriores.
- El rango de fechas de los reportes ya no depende de la zona horaria del
  servidor.
- PDF: se eliminaron las dos paginas en blanco que aparecian despues de cada
  pagina de contenido; el pie ahora muestra "Pagina X de N".
- Nuevas pruebas de rango de fechas, filtros por rol y exportacion.

### Logica comun de marcacion (fase 2 del refactor)

- Clases y jornada administrativa comparten `backend/src/shared/attendance/`:
  reloj de Ecuador, ventanas de marcado, foto, auditoria, bloqueo por docente
  y deteccion de marcaciones abiertas.
- Los calculos de hora ya no dependen de la zona horaria del servidor. Las
  pruebas pueden ejecutarse con `TEST_TZ=UTC pnpm test` para comprobarlo.
- Una marcacion sin salida solo bloquea nuevas entradas mientras su ventana de
  salida sigue abierta, tanto en clases como en jornada administrativa. Antes,
  una salida olvidada de una hora administrativa bloqueaba las clases del resto
  del dia (y viceversa).
- Se puede marcar el ultimo dia de un periodo academico; antes quedaba fuera
  por comparar la fecha del periodo con la hora actual en UTC.
- El domingo, el estado actual responde "sin clase activa" en lugar de un
  error 404.
- La justificacion de una clase sin marcacion valida que el horario sea del dia
  de la semana actual.
- Los plazos de justificacion usan las ventanas configuradas en lugar de 15
  minutos fijos (el valor por defecto sigue siendo 15).
- La configuracion de asistencia se lee en una sola consulta.
- Sin migraciones de base de datos ni cambios en las respuestas de la API.

### Correcciones criticas (fase 1 del refactor)

- La API confia en los saltos de proxy configurados en `TRUST_PROXY`
  (Render = 1). Los limites de peticiones y de intentos de login ahora se
  aplican por usuario y no a toda la institucion, y la IP de auditoria ya no
  puede falsificarse con `X-Forwarded-For`.
- Las marcaciones de entrada y salida (clases y jornada administrativa) se
  procesan con un bloqueo por docente para evitar registros duplicados por
  doble clic o reintentos.
- La salida de clase guarda el GPS en `lat_salida`/`lng_salida`.
- Reportes: las sesiones programadas respetan la vigencia de cada horario, las
  clases que aun no inician no cuentan como ausencias y las justificaciones sin
  marcacion aparecen en el detalle. Las justificadas aprobadas ya no se cuentan
  como ausentes.
- Reportes por periodo academico usan las fechas reales del periodo.
- Un horario de clase ya no puede cruzarse con una hora administrativa.
- El login con contrasena acepta el correo con mayusculas o espacios.
- Sin migraciones de base de datos.

### Paralelos y ubicacion por marcacion

- Se incorporo el paralelo `A`, `B`, `C` o `D` a las asignaciones docentes y
  horarios; el valor inicial es `A`.
- Una misma materia puede tener horarios para distintos paralelos sin crear la
  materia nuevamente.
- Se registra la ubicacion GPS de la entrada y de la salida por separado.
- Reportes y la jornada docente muestran ambos puntos de ubicacion cuando
  existen.
- Se agrego la migracion Prisma
  `20260812120000_add_paralelo_y_gps_por_marcacion`.

## Historial

### 2026-08-12 - Paralelos y GPS por entrada/salida

- Se habilitaron paralelos y GPS independiente para cada momento de la
  asistencia.
- Commit: `5843303`.

### 2026-08-05 - Asignacion docente y salidas pendientes

- Se creo una asignacion docente por materia, periodo y jornada para evitar
  que el docente de una materia se contradiga al crear un horario.
- Se mejoro el tratamiento de marcaciones con entrada registrada y sin salida.
- Commits: `cbe6a3f`, `cc95795`.

### 2026-07-27 - Filtros y permisos de coordinacion

- Se incorporaron filtros y paginacion en horarios y reportes.
- La columna y filtro de carrera se ocultan para coordinadores, porque solo
  administran su propia carrera.
- Commits: `13397d8`, `4a856dc`, `3f3d154`.

### 2026-07-22 - Jornada, periodos y docentes

- Se incorporaron jornadas Matutina, Vespertina y Nocturna en los horarios.
- La asignacion del docente se centralizo en el flujo academico.
- Los campos de fechas de horario se sincronizan con el periodo academico.
- Se mejoro la presentacion de nombre y codigo de los periodos.
- Los selectores de docente muestran solamente usuarios con el rol Docente.
- Commits: `aca8627`, `966e18a`, `7096dd9`, `bef05dd`.

### 2026-07-21 - Usuarios y privacidad de reportes

- Se permite registrar cuentas institucionales distintas con la misma cedula,
  por ejemplo, una de docente y otra de coordinacion.
- Los docentes ven unicamente sus propias asistencias en reportes.
- Commits: `00d5342`, `94c83a8`.

### 2026-07-17 - Navegacion y ortografia

- El dashboard se organizo por secciones para reducir el desplazamiento.
- Se corrigieron etiquetas con caracteres mal codificados en la configuracion
  de modulos.
- Commits: `2795dc5`, `3cc9215`.

### 2026-07-13 a 2026-07-14 - Despliegue inicial

- Se preparo el despliegue con Render para frontend/backend y Supabase para
  PostgreSQL.
- Se corrigio la codificacion de una migracion SQL para su ejecucion en
  Supabase.
- Commits: `fadf486`, `af0ec29`.

### 2026-05-27 - Periodos y panel institucional

- Se agrego el modulo de periodos academicos para separar el historial de
  asistencias por ciclo institucional.
- Se implemento el dashboard institucional con visualizaciones operativas.
- Commit: `1129535`.

### 2026-05-11 a 2026-05-13 - MVP de asistencia

- Se implemento el MVP con autenticacion, roles, gestion academica, horarios,
  marcaciones y reportes.
- Se ajustaron limites de peticiones y se bloquearon marcaciones duplicadas.
- Se definieron las ventanas de entrada y salida, evitando habilitar clases ya
  finalizadas.
- Se incorporaron enlaces a la ubicacion GPS en asistencias.
- Commits: `e8d8bb3`, `67b75d7`, `13f390d`, `f1afdd4`, `90e94a7`, `6dec04e`.

## Como mantener esta bitacora

1. En cada cambio funcional relevante, agregue una entrada dentro de
   **En desarrollo**.
2. Al publicar los cambios, mueva la entrada a **Historial** con la fecha y el
   hash corto del commit.
3. Mantenga el README como guia de instalacion, operacion y arquitectura.
