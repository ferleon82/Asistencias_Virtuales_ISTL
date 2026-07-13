CREATE TABLE "system_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

INSERT INTO "system_settings" ("id", "key", "label", "value", "description", "updated_at")
VALUES (
  gen_random_uuid()::text,
  'attendance_photo_required',
  'Registro con imagen',
  'true',
  'Exige capturar una foto del docente al marcar ingreso y salida.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
