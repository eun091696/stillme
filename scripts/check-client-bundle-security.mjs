import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { assertClientBundleSafe } from "./lib/client-bundle-security.mjs";

const repositoryRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const staticRoot = path.join(repositoryRoot, ".next", "static");

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
    } else if (entry.isFile() && /\.(?:css|js)$/u.test(entry.name)) {
      files.push({
        content: await readFile(absolutePath, "utf8"),
        file: path.relative(staticRoot, absolutePath),
      });
    }
  }

  return files;
}

const files = await collectFiles(staticRoot);
assertClientBundleSafe(files);
console.log(
  JSON.stringify({ filesScanned: files.length, status: "passed" }, null, 2),
);
