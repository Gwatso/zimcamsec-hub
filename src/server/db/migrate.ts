import { MIGRATIONS } from "./migrations";

/** Minimal single-connection SQL interface shared by `pg` and PGlite. */
export interface SqlConnection {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Executes one or more statements without parameters. */
  exec(text: string): Promise<void>;
}

/** Arbitrary constant for pg_advisory_lock so concurrent instances migrate one at a time. */
const MIGRATION_LOCK_ID = 727_274_2026;

/**
 * Applies pending migrations in order. Safe to call from several processes at
 * once: a session-level advisory lock serialises runners, and already-applied
 * migrations are skipped.
 */
export async function runMigrations(
  conn: SqlConnection,
  log: (msg: string) => void = (m) => console.info(m),
): Promise<string[]> {
  await conn.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
  try {
    await conn.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    const rows = await conn.query<{ name: string }>("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));
    const newlyApplied: string[] = [];

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.name)) continue;
      log(`[db] applying migration ${migration.name}`);
      const safeName = migration.name.replace(/'/g, "''");
      await conn.exec(
        `BEGIN;\n${migration.sql}\nINSERT INTO schema_migrations (name) VALUES ('${safeName}');\nCOMMIT;`,
      );
      newlyApplied.push(migration.name);
    }
    return newlyApplied;
  } catch (error) {
    // If a migration failed mid-transaction, make sure the connection is usable again.
    await conn.exec("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await conn.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => undefined);
  }
}
