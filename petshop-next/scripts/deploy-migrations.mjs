import { spawnSync } from "node:child_process";
import path from "node:path";

const configuredUrl = process.env.DIRECT_URL;

if (!configuredUrl) {
  throw new Error("DIRECT_URL is required to deploy database migrations.");
}

const migrationUrl = new URL(configuredUrl);
if (!['postgres:', 'postgresql:'].includes(migrationUrl.protocol)) {
  throw new Error("DIRECT_URL must be a PostgreSQL connection URL.");
}

// Supabase uses 6543 for transaction pooling and 5432 for session pooling.
// Prisma migrations need a session connection for advisory locks and DDL.
if (migrationUrl.hostname.endsWith(".pooler.supabase.com") && migrationUrl.port === "6543") {
  migrationUrl.port = "5432";
}
migrationUrl.searchParams.delete("pgbouncer");
migrationUrl.searchParams.delete("connection_limit");

console.log(`Running database migrations through ${migrationUrl.hostname}:${migrationUrl.port || "5432"}.`);

if (process.argv.includes("--dry-run")) process.exit(0);

const prismaExecutable = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);
const result = spawnSync(prismaExecutable, ["migrate", "deploy"], {
  env: {
    ...process.env,
    DATABASE_URL: migrationUrl.toString(),
    DIRECT_URL: migrationUrl.toString(),
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
