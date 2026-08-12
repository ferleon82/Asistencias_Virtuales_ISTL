# Bitacora de cambios

Este archivo registra los cambios funcionales y tecnicos relevantes del
sistema. Para el detalle exacto de cada cambio, revise el commit indicado con
`git show <hash>`.

## [En desarrollo]

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
