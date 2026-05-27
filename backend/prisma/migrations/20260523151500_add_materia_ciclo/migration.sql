ALTER TABLE "materias" ADD COLUMN "ciclo" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "materias_carrera_id_ciclo_idx" ON "materias"("carrera_id", "ciclo");

