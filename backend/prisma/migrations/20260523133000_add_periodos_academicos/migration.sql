CREATE TABLE "periodos_academicos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodos_academicos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "periodos_academicos_codigo_key" ON "periodos_academicos"("codigo");
CREATE INDEX "periodos_academicos_activo_idx" ON "periodos_academicos"("activo");
CREATE INDEX "periodos_academicos_fecha_inicio_fecha_fin_idx" ON "periodos_academicos"("fecha_inicio", "fecha_fin");

ALTER TABLE "horarios" ADD COLUMN "periodo_academico_id" TEXT;
CREATE INDEX "horarios_periodo_academico_id_idx" ON "horarios"("periodo_academico_id");

ALTER TABLE "horarios" ADD CONSTRAINT "horarios_periodo_academico_id_fkey"
FOREIGN KEY ("periodo_academico_id") REFERENCES "periodos_academicos"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

