CREATE TABLE "asignaciones_docentes" (
  "id" TEXT NOT NULL,
  "materia_id" TEXT NOT NULL,
  "docente_id" TEXT NOT NULL,
  "periodo_academico_id" TEXT NOT NULL,
  "jornada" "Jornada" NOT NULL,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asignaciones_docentes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asignaciones_docentes_unica_key"
ON "asignaciones_docentes"("materia_id", "docente_id", "periodo_academico_id", "jornada");

CREATE INDEX "asignaciones_docentes_materia_id_idx" ON "asignaciones_docentes"("materia_id");
CREATE INDEX "asignaciones_docentes_docente_id_idx" ON "asignaciones_docentes"("docente_id");
CREATE INDEX "asignaciones_docentes_periodo_academico_id_idx" ON "asignaciones_docentes"("periodo_academico_id");
CREATE INDEX "asignaciones_docentes_activa_idx" ON "asignaciones_docentes"("activa");

ALTER TABLE "asignaciones_docentes"
ADD CONSTRAINT "asignaciones_docentes_materia_id_fkey"
FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asignaciones_docentes"
ADD CONSTRAINT "asignaciones_docentes_docente_id_fkey"
FOREIGN KEY ("docente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asignaciones_docentes"
ADD CONSTRAINT "asignaciones_docentes_periodo_academico_id_fkey"
FOREIGN KEY ("periodo_academico_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "horarios" ADD COLUMN "asignacion_docente_id" TEXT;

INSERT INTO "asignaciones_docentes" (
  "id",
  "materia_id",
  "docente_id",
  "periodo_academico_id",
  "jornada",
  "activa",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  h."materia_id",
  h."docente_id",
  h."periodo_academico_id",
  h."jornada",
  BOOL_OR(h."activo"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "horarios" h
WHERE h."docente_id" IS NOT NULL
  AND h."periodo_academico_id" IS NOT NULL
GROUP BY h."materia_id", h."docente_id", h."periodo_academico_id", h."jornada";

UPDATE "horarios" h
SET "asignacion_docente_id" = a."id"
FROM "asignaciones_docentes" a
WHERE a."materia_id" = h."materia_id"
  AND a."docente_id" = h."docente_id"
  AND a."periodo_academico_id" = h."periodo_academico_id"
  AND a."jornada" = h."jornada";

CREATE INDEX "horarios_asignacion_docente_id_idx" ON "horarios"("asignacion_docente_id");

ALTER TABLE "horarios"
ADD CONSTRAINT "horarios_asignacion_docente_id_fkey"
FOREIGN KEY ("asignacion_docente_id") REFERENCES "asignaciones_docentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;