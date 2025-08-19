-- This will only run on first initialization
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'postnify-clive-user') THEN
      CREATE USER "postnify-clive-user" WITH PASSWORD 'poPassNewLvi334';
   END IF;
END
$$;

CREATE DATABASE "postnify-db-clive" OWNER "postnify-clive-user";
GRANT ALL PRIVILEGES ON DATABASE "postnify-db-clive" TO "postnify-clive-user";