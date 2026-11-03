-- Jornada administrativa semanal: los bloques se agrupan por jornada y una
-- jornada puede ser temporal (reemplaza a la regular en sus fechas).
ALTER TABLE "horarios_administrativos"
  ADD COLUMN "grupo_id" TEXT,
  ADD COLUMN "temporal" BOOLEAN NOT NULL DEFAULT false;

-- Agrupa los bloques existentes que comparten docente, período, vigencia,
-- modalidad, ubicación y actividad (el mismo criterio siempre da el mismo grupo).
UPDATE "horarios_administrativos"
SET "grupo_id" = md5(
  "docente_id" || '|' || "periodo_academico_id" || '|' || "fecha_inicio"::text || '|' ||
  "fecha_fin"::text || '|' || "modalidad"::text || '|' ||
  coalesce(trim("ubicacion"), '') || '|' || coalesce(trim("descripcion"), '')
)::uuid::text;

ALTER TABLE "horarios_administrativos" ALTER COLUMN "grupo_id" SET NOT NULL;

CREATE INDEX "horarios_administrativos_grupo_id_idx" ON "horarios_administrativos"("grupo_id");
