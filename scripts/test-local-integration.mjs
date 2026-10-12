import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { selectLocalSupabaseTestEnvironment } from "./lib/supabase-development.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const { stdout } = await execFileAsync(
    "npm",
    ["exec", "--offline", "--", "supabase", "status", "--output", "json"],
    {
      cwd: repositoryRoot,
      maxBuffer: 1024 * 1024,
    },
  );
  const localEnvironment = selectLocalSupabaseTestEnvironment(JSON.parse(stdout));
  const testProcess = spawn(
    "npm",
    [
      "exec",
      "--offline",
      "--",
      "vitest",
      "run",
      "tests/integration",
      "--maxWorkers=1",
      "--no-file-parallelism",
    ],
    {
      cwd: repositoryRoot,
      env: { ...process.env, ...localEnvironment },
      stdio: "inherit",
    },
  );

  const exitCode = await new Promise((resolve, reject) => {
    testProcess.once("error", reject);
    testProcess.once("exit", (code) => resolve(code ?? 1));
  });

  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Local integration test setup failed.");
  process.exitCode = 1;
});
