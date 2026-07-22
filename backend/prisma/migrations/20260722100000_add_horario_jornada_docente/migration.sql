CREATE TYPE "Jornada" AS ENUM ('matutina', 'vespertina', 'nocturna');

ALTER TABLE "horarios"
ADD COLUMN "jornada" "Jornada" NOT NULL DEFAULT 'matutina',
ADD COLUMN "docente_id" TEXT;

UPDATE "horarios" AS h
SET "docente_id" = m."docente_id"
FROM "materias" AS m
WHERE h."materia_id" = m."id"
  AND m."docente_id" IS NOT NULL;

CREATE INDEX "horarios_docente_id_idx" ON "horarios"("docente_id");

ALTER TABLE "horarios"
ADD CONSTRAINT "horarios_docente_id_fkey"
FOREIGN KEY ("docente_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;