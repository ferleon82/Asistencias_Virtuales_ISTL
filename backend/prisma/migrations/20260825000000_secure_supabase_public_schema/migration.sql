-- Supabase expone el esquema public mediante su Data API. Esta aplicación usa
-- Prisma desde el backend, por lo que ningún cliente debe acceder a estas
-- tablas directamente con las claves anon, authenticated o service_role.
-- RLS y los privilegios se configuran juntos para evitar accesos por la API.

DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated, service_role',
      table_name
    );
  END LOOP;
END
$$;

-- Las tablas y secuencias futuras creadas por las migraciones no deben recibir
-- permisos automáticos para los roles expuestos por la Data API.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated, service_role;
