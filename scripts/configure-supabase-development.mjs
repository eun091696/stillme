import { execFile } from "node:child_process";
import { chmod, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  renderDevelopmentEnv,
  selectPublishableKey,
  validateProjectRef,
} from "./lib/supabase-development.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const environmentsPath = path.join(repositoryRoot, "supabase", "environments.json");
const linkedRefPath = path.join(repositoryRoot, "supabase", ".temp", "project-ref");
const envPath = path.join(repositoryRoot, ".env.local");
const temporaryEnvPath = `${envPath}.tmp`;

async function readOptionalFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

async function main() {
  const environments = JSON.parse(await readFile(environmentsPath, "utf8"));
  const expectedRef = validateProjectRef(environments.development?.projectRef ?? "");
  const linkedRef = validateProjectRef((await readFile(linkedRefPath, "utf8")).trim());

  if (linkedRef !== expectedRef) {
    throw new Error(
      `Linked Supabase project does not match development configuration. Run: npx supabase link --project-ref ${expectedRef}`,
    );
  }

  const { stdout } = await execFileAsync(
    "npm",
    [
      "exec",
      "--offline",
      "--",
      "supabase",
      "projects",
      "api-keys",
      "--project-ref",
      expectedRef,
      "--output",
      "json",
    ],
    {
      cwd: repositoryRoot,
      maxBuffer: 1024 * 1024,
    },
  );
  const publishableKey = selectPublishableKey(JSON.parse(stdout));
  const existingContent = await readOptionalFile(envPath);
  const nextContent = renderDevelopmentEnv(existingContent, expectedRef, publishableKey);

  await writeFile(temporaryEnvPath, nextContent, { mode: 0o600 });
  await rename(temporaryEnvPath, envPath);
  await chmod(envPath, 0o600);

  console.log(
    `Configured hosted Supabase development environment for ${expectedRef}. Credential values were not printed.`,
  );
}

main().catch(async (error) => {
  try {
    await unlink(temporaryEnvPath);
  } catch {
    // The temporary file may not exist.
  }

  console.error(error instanceof Error ? error.message : "Development environment setup failed.");
  process.exitCode = 1;
});
