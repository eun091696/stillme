import { spawn } from "node:child_process";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const sourceDirectory = path.join(repositoryRoot, "supabase", "tests");

async function run() {
  const temporaryDirectory = await mkdtemp(
    path.join(process.platform === "darwin" ? "/private/tmp" : os.tmpdir(), "aps-db-"),
  );

  try {
    const sourceFiles = (await readdir(sourceDirectory))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort();
    if (sourceFiles.length === 0) {
      throw new Error("No pgTAP test files were found.");
    }

    const testPaths = [];
    for (const [index, sourceFile] of sourceFiles.entries()) {
      const testPath = path.join(
        temporaryDirectory,
        `${String(index + 1).padStart(2, "0")}_${sourceFile
          .replace(/\.test\.sql$/, "")
          .replace(/_test\.sql$/, "")}_test.sql`,
      );
      await cp(path.join(sourceDirectory, sourceFile), testPath);
      testPaths.push(testPath);
    }

    const testProcess = spawn(
      "npm",
      ["exec", "--offline", "--", "supabase", "test", "db", "--local", ...testPaths],
      { cwd: repositoryRoot, stdio: "inherit" },
    );
    const exitCode = await new Promise((resolve, reject) => {
      testProcess.once("error", reject);
      testProcess.once("exit", (code) => resolve(code ?? 1));
    });
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "DB tests failed.");
  process.exitCode = 1;
});
