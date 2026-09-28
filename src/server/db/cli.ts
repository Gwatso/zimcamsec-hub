/**
 * Deployment CLI:  npm run db:migrate  |  npm run db:seed
 * (With the embedded PGlite backend both happen automatically on server start;
 * don't run the CLI while the dev server holds the PGlite directory.)
 */
import { getEnv } from "../env";
import { getDbHandle } from "./client";
import { runMigrations } from "./migrate";
import { seedDatabase } from "./seed";

async function main() {
  const command = process.argv[2];
  if (command !== "migrate" && command !== "seed") {
    console.error("Usage: tsx src/server/db/cli.ts <migrate|seed>");
    process.exit(2);
  }

  // Take manual control of migrations/seeding for this process.
  process.env.AUTO_MIGRATE = "false";
  process.env.SEED_DEMO_CONTENT ??= "false";
  const handle = await getDbHandle();
  try {
    if (command === "migrate") {
      const applied = await handle.withConnection((conn) => runMigrations(conn));
      console.info(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
    } else {
      await handle.withConnection((conn) => runMigrations(conn));
      await seedDatabase(handle.db, { demoContent: getEnv().SEED_DEMO_CONTENT });
      console.info("Seed complete.");
    }
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
