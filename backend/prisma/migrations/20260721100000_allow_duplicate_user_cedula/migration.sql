DROP INDEX IF EXISTS "users_cedula_key";
CREATE INDEX IF NOT EXISTS "users_cedula_idx" ON "users"("cedula");