import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDirectory = fileURLToPath(new URL("..", import.meta.url));

function stylesheets(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

describe("photo framing", () => {
  it("does not crop displayed photos through cover-fit CSS", () => {
    for (const file of stylesheets(appDirectory)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/object-fit\s*:\s*cover\b/u);
    }
  });

  it("keeps portrait category cards at their source aspect ratio", () => {
    const catalog = readFileSync(join(appDirectory, "ux.module.css"), "utf8");
    const profile = readFileSync(join(appDirectory, "generate/profile/profile-hub.module.css"), "utf8");
    expect(catalog).toContain(".categoryCatalogImage { aspect-ratio: 4 / 5;");
    expect(profile).toContain(".image { display: block; position: relative; aspect-ratio: 4 / 5;");
    expect(profile).not.toMatch(/@media[^}]+\.image\s*\{\s*aspect-ratio/u);
  });
});
