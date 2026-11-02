-- Calendario institucional de días no laborables (feriados).
CREATE TABLE "dias_no_laborables" (
  "id" TEXT NOT NULL,
  "fecha" DATE NOT NULL,
  "descripcion" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "dias_no_laborables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dias_no_laborables_fecha_key" ON "dias_no_laborables"("fecha");

-- Igual que el resto de tablas (migración secure_supabase_public_schema): solo
-- el backend accede, nunca la Data API de Supabase.
ALTER TABLE "dias_no_laborables" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE "dias_no_laborables" FROM anon, authenticated, service_role;
  END IF;
END
$$;
