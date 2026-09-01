CREATE TABLE "horarios_administrativos" (
  "id" TEXT NOT NULL,
  "docente_id" TEXT NOT NULL,
  "periodo_academico_id" TEXT NOT NULL,
  "dia_semana" "DiaSemana" NOT NULL,
  "hora_inicio" TEXT NOT NULL,
  "hora_fin" TEXT NOT NULL,
  "jornada" "Jornada" NOT NULL DEFAULT 'matutina',
  "modalidad" "Modalidad" NOT NULL DEFAULT 'presencial',
  "ubicacion" TEXT,
  "descripcion" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "fecha_inicio" DATE NOT NULL,
  "fecha_fin" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "horarios_administrativos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registros_administrativos" (
  "id" TEXT NOT NULL,
  "docente_id" TEXT NOT NULL,
  "horario_administrativo_id" TEXT NOT NULL,
  "timestamp_entrada" TIMESTAMP(3),
  "timestamp_salida" TIMESTAMP(3),
  "ip_entrada" TEXT,
  "ip_salida" TEXT,
  "foto_entrada_url" TEXT,
  "foto_salida_url" TEXT,
  "lat_entrada" DECIMAL(10,8),
  "lng_entrada" DECIMAL(11,8),
  "precision_entrada_m" INTEGER,
  "lat_salida" DECIMAL(10,8),
  "lng_salida" DECIMAL(11,8),
  "precision_salida_m" INTEGER,
  "estado" "EstadoAsistencia" NOT NULL DEFAULT 'ausente',
  "justificacion" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "registros_administrativos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "horarios_administrativos_docente_id_dia_semana_activo_idx" ON "horarios_administrativos"("docente_id", "dia_semana", "activo");
CREATE INDEX "horarios_administrativos_periodo_academico_id_idx" ON "horarios_administrativos"("periodo_academico_id");
CREATE INDEX "horarios_administrativos_fecha_inicio_fecha_fin_idx" ON "horarios_administrativos"("fecha_inicio", "fecha_fin");
CREATE UNIQUE INDEX "registros_administrativos_docente_id_horario_administrativo_id_timestamp_entrada_key" ON "registros_administrativos"("docente_id", "horario_administrativo_id", "timestamp_entrada");
CREATE INDEX "registros_administrativos_docente_id_idx" ON "registros_administrativos"("docente_id");
CREATE INDEX "registros_administrativos_horario_administrativo_id_idx" ON "registros_administrativos"("horario_administrativo_id");
CREATE INDEX "registros_administrativos_estado_idx" ON "registros_administrativos"("estado");
CREATE INDEX "registros_administrativos_timestamp_entrada_idx" ON "registros_administrativos"("timestamp_entrada");

ALTER TABLE "horarios_administrativos" ADD CONSTRAINT "horarios_administrativos_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_administrativos" ADD CONSTRAINT "horarios_administrativos_periodo_academico_id_fkey" FOREIGN KEY ("periodo_academico_id") REFERENCES "periodos_academicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registros_administrativos" ADD CONSTRAINT "registros_administrativos_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registros_administrativos" ADD CONSTRAINT "registros_administrativos_horario_administrativo_id_fkey" FOREIGN KEY ("horario_administrativo_id") REFERENCES "horarios_administrativos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El módulo es visible únicamente para Talento Humano; las rutas además lo
-- verifican en el backend para que no dependa de la interfaz.
INSERT INTO "module_permissions" ("id", "module_key", "module_label", "rol", "enabled", "created_at", "updated_at")
VALUES
  (gen_random_uuid()::text, 'administrative_hours', 'Horas administrativas', 'docente', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'administrative_hours', 'Horas administrativas', 'coordinador', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'administrative_hours', 'Horas administrativas', 'tics', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'administrative_hours', 'Horas administrativas', 'rectorado', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'administrative_hours', 'Horas administrativas', 'talento_humano', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("module_key", "rol") DO NOTHING;
