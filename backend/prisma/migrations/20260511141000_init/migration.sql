-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('docente', 'coordinador', 'tics', 'rectorado');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('virtual', 'presencial', 'hibrida');

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('puntual', 'tardanza', 'ausente', 'justificado');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('aviso_entrada', 'alerta_ausencias', 'resumen_diario', 'alerta_coordinador');

-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('email', 'sistema');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'docente',
    "telefono" TEXT,
    "avatar_url" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carreras" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "coordinador_id" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carreras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "carrera_id" TEXT NOT NULL,
    "docente_id" TEXT,
    "creditos" INTEGER NOT NULL DEFAULT 3,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios" (
    "id" TEXT NOT NULL,
    "materia_id" TEXT NOT NULL,
    "dia_semana" "DiaSemana" NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "ciclo" TEXT NOT NULL,
    "modalidad" "Modalidad" NOT NULL DEFAULT 'virtual',
    "url_aula_virtual" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_inicio_ciclo" DATE NOT NULL,
    "fecha_fin_ciclo" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_asistencia" (
    "id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "horario_id" TEXT NOT NULL,
    "timestamp_entrada" TIMESTAMP(3),
    "timestamp_salida" TIMESTAMP(3),
    "ip_entrada" TEXT,
    "ip_salida" TEXT,
    "lat" DECIMAL(10,8),
    "lng" DECIMAL(11,8),
    "precision_m" INTEGER,
    "estado" "EstadoAsistencia" NOT NULL DEFAULT 'ausente',
    "justificacion" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registros_asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clases_recuperacion" (
    "id" TEXT NOT NULL,
    "materia_id" TEXT NOT NULL,
    "docente_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "url_aula_virtual" TEXT,
    "motivo" TEXT,
    "aprobada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clases_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones_log" (
    "id" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "destinatario_id" TEXT NOT NULL,
    "enviado_at" TIMESTAMP(3),
    "canal" "CanalNotificacion" NOT NULL DEFAULT 'email',
    "contenido" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "enviado_exitoso" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "accion" TEXT NOT NULL,
    "tabla_afectada" TEXT NOT NULL,
    "registro_id" TEXT,
    "datos_anteriores" JSONB,
    "datos_nuevos" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revocado" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_cedula_key" ON "users"("cedula");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_rol_idx" ON "users"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "carreras_codigo_key" ON "carreras"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "materias_codigo_key" ON "materias"("codigo");

-- CreateIndex
CREATE INDEX "materias_carrera_id_idx" ON "materias"("carrera_id");

-- CreateIndex
CREATE INDEX "materias_docente_id_idx" ON "materias"("docente_id");

-- CreateIndex
CREATE INDEX "horarios_materia_id_idx" ON "horarios"("materia_id");

-- CreateIndex
CREATE INDEX "horarios_dia_semana_ciclo_idx" ON "horarios"("dia_semana", "ciclo");

-- CreateIndex
CREATE INDEX "registros_asistencia_docente_id_idx" ON "registros_asistencia"("docente_id");

-- CreateIndex
CREATE INDEX "registros_asistencia_horario_id_idx" ON "registros_asistencia"("horario_id");

-- CreateIndex
CREATE INDEX "registros_asistencia_estado_idx" ON "registros_asistencia"("estado");

-- CreateIndex
CREATE INDEX "registros_asistencia_timestamp_entrada_idx" ON "registros_asistencia"("timestamp_entrada");

-- CreateIndex
CREATE UNIQUE INDEX "registros_asistencia_docente_id_horario_id_timestamp_entrad_key" ON "registros_asistencia"("docente_id", "horario_id", "timestamp_entrada");

-- CreateIndex
CREATE INDEX "clases_recuperacion_docente_id_idx" ON "clases_recuperacion"("docente_id");

-- CreateIndex
CREATE INDEX "clases_recuperacion_fecha_idx" ON "clases_recuperacion"("fecha");

-- CreateIndex
CREATE INDEX "notificaciones_log_destinatario_id_idx" ON "notificaciones_log"("destinatario_id");

-- CreateIndex
CREATE INDEX "notificaciones_log_tipo_idx" ON "notificaciones_log"("tipo");

-- CreateIndex
CREATE INDEX "notificaciones_log_enviado_at_idx" ON "notificaciones_log"("enviado_at");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_tabla_afectada_idx" ON "audit_log"("tabla_afectada");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- AddForeignKey
ALTER TABLE "carreras" ADD CONSTRAINT "carreras_coordinador_id_fkey" FOREIGN KEY ("coordinador_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materias" ADD CONSTRAINT "materias_carrera_id_fkey" FOREIGN KEY ("carrera_id") REFERENCES "carreras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materias" ADD CONSTRAINT "materias_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "horarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases_recuperacion" ADD CONSTRAINT "clases_recuperacion_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases_recuperacion" ADD CONSTRAINT "clases_recuperacion_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones_log" ADD CONSTRAINT "notificaciones_log_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
