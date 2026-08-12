-- Conserva los registros existentes y separa las coordenadas de ingreso y salida.
ALTER TABLE "asignaciones_docentes"
ADD COLUMN "paralelo" TEXT NOT NULL DEFAULT 'A';

DROP INDEX IF EXISTS "asignaciones_docentes_unica_key";
CREATE UNIQUE INDEX "asignaciones_docentes_unica_key"
ON "asignaciones_docentes"("materia_id", "docente_id", "periodo_academico_id", "jornada", "paralelo");

ALTER TABLE "registros_asistencia"
ADD COLUMN "lat_entrada" DECIMAL(10, 8),
ADD COLUMN "lng_entrada" DECIMAL(11, 8),
ADD COLUMN "precision_entrada_m" INTEGER,
ADD COLUMN "lat_salida" DECIMAL(10, 8),
ADD COLUMN "lng_salida" DECIMAL(11, 8),
ADD COLUMN "precision_salida_m" INTEGER;

-- La ubicación histórica no permite distinguir el momento exacto, por eso se conserva
-- como referencia de ambos eventos cuando ya existe una salida registrada.
UPDATE "registros_asistencia"
SET
  "lat_entrada" = "lat",
  "lng_entrada" = "lng",
  "precision_entrada_m" = "precision_m",
  "lat_salida" = CASE WHEN "timestamp_salida" IS NOT NULL THEN "lat" ELSE NULL END,
  "lng_salida" = CASE WHEN "timestamp_salida" IS NOT NULL THEN "lng" ELSE NULL END,
  "precision_salida_m" = CASE WHEN "timestamp_salida" IS NOT NULL THEN "precision_m" ELSE NULL END
WHERE "lat" IS NOT NULL OR "lng" IS NOT NULL OR "precision_m" IS NOT NULL;