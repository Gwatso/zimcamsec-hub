/**
 * Database access. Two interchangeable backends behind one Drizzle API:
 *
 *  - PostgreSQL via `pg` when DATABASE_URL is set (production, multi-instance).
 *  - Embedded PGlite (Postgres compiled to WASM) otherwise — zero-setup local
 *    development and small single-process installs (e.g. a school server).
 *
 * Both speak the same SQL dialect, so migrations and queries are identical.
 * The handle is cached on globalThis to survive Next.js dev hot reloads.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getEnv } from "../env";
import { runMigrations, type SqlConnection } from "./migrate";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export interface DbHandle {
  kind: "postgres" | "pglite";
  db: Db;
  /** Runs `fn` on a single dedicated connection (needed for advisory locks). */
  withConnection<T>(fn: (conn: SqlConnection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const globalForDb = globalThis as unknown as { __zchDb?: Promise<DbHandle> };

export function getDbHandle(): Promise<DbHandle> {
  if (!globalForDb.__zchDb) {
    globalForDb.__zchDb = initialise().catch((error: unknown) => {
      // Allow a retry on the next request instead of caching the failure forever.
      globalForDb.__zchDb = undefined;
      throw error;
    });
  }
  return globalForDb.__zchDb;
}

export async function getDb(): Promise<Db> {
  return (await getDbHandle()).db;
}

async function initialise(): Promise<DbHandle> {
  const env = getEnv();
  const handle = env.DATABASE_URL ? await connectPostgres(env.DATABASE_URL) : await connectPglite(env.PGLITE_DIR);

  // With AUTO_MIGRATE=false (e.g. the db CLI) the caller owns migrating and seeding.
  if (env.AUTO_MIGRATE) {
    await handle.withConnection((conn) => runMigrations(conn));
    const { seedDatabase } = await import("./seed");
    await seedDatabase(handle.db, { demoContent: env.SEED_DEMO_CONTENT });
  }
  return handle;
}

async function connectPostgres(url: string): Promise<DbHandle> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const env = getEnv();
  const pool = new Pool({
    connectionString: url,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
  });
  // An idle client losing its connection must not crash the process.
  pool.on("error", (error) => console.error("[db] idle client error", error));

  return {
    kind: "postgres",
    db: drizzle({ client: pool, schema }),
    async withConnection(fn) {
      const client = await pool.connect();
      try {
        return await fn({
          query: async (text, params) => (await client.query(text, params)).rows,
          exec: async (text) => {
            await client.query(text);
          },
        });
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function connectPglite(dir: string): Promise<DbHandle> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  // "memory://" gives an ephemeral database (used by the integration tests).
  const dataDir = dir.startsWith("memory://") ? dir : resolve(dir);
  if (!dir.startsWith("memory://")) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  await client.waitReady;

  const conn: SqlConnection = {
    query: async <T>(text: string, params?: unknown[]) => (await client.query<T>(text, params)).rows,
    exec: async (text) => {
      await client.exec(text);
    },
  };

  return {
    kind: "pglite",
    // Same query-builder surface as node-postgres; only the driver differs.
    db: drizzle({ client, schema }) as unknown as Db,
    withConnection: (fn) => fn(conn),
    close: () => client.close(),
  };
}
