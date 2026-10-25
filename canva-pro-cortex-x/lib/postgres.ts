import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type NeonSql = NeonQueryFunction<false, false>;

const globalForNeon = globalThis as typeof globalThis & {
  __cortexNeonSql?: NeonSql;
};

export function getPostgresClient(): NeonSql {
  if (globalForNeon.__cortexNeonSql) return globalForNeon.__cortexNeonSql;

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("PostgreSQL is not configured. Set POSTGRES_URL or DATABASE_URL.");
  }

  globalForNeon.__cortexNeonSql = neon(connectionString);
  return globalForNeon.__cortexNeonSql;
}
