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
const migrationEnvironment = {
  ...process.env,
  DATABASE_URL: migrationUrl.toString(),
  DIRECT_URL: migrationUrl.toString(),
};

function runPrisma(arguments_, captureOutput = false) {
  const result = spawnSync(prismaExecutable, arguments_, {
    encoding: captureOutput ? "utf8" : undefined,
    env: migrationEnvironment,
    stdio: captureOutput ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (captureOutput) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  return result;
}

let result = runPrisma(["migrate", "deploy"], true);

if (result.status !== 0 && `${result.stdout || ""}\n${result.stderr || ""}`.includes("P3005")) {
  console.log("Baselining the existing production schema before applying pending migrations.");
  const baseline = runPrisma([
    "migrate",
    "resolve",
    "--applied",
    "20260916000000_product_image_text",
  ]);
  if (baseline.status !== 0) process.exit(baseline.status ?? 1);
  result = runPrisma(["migrate", "deploy"], true);
}

const failedMigrationOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
if (
  result.status !== 0
  && (failedMigrationOutput.includes("P3009") || failedMigrationOutput.includes("P3018"))
  && failedMigrationOutput.includes("20260918000000_operations_upgrade")
) {
  console.log("Recovering the interrupted operations migration and retrying safely.");
  const recovery = runPrisma([
    "migrate",
    "resolve",
    "--rolled-back",
    "20260918000000_operations_upgrade",
  ]);
  if (recovery.status !== 0) process.exit(recovery.status ?? 1);
  result = runPrisma(["migrate", "deploy"]);
}

process.exit(result.status ?? 1);
