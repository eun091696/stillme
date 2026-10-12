import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { idPhotoRuntimePrompt } from "../prompts/runtime/id-photo/prompt";
import {
  buildBenchmarkRequest,
  buildEditPreservationPrompt,
  buildExperimentalIdPhotoPrompt,
  buildSkinControlledPrompt,
  buildSkinIntensityPrompt,
  conditionsForExperiment,
  CONTROLLED_SKIN_AND_HAIR_SECTION,
  EDIT_PRESERVATION_SECTION,
  G_CONSTRAINED_EDIT_PROMPT,
  H_SKIN_INTENSITY_POLICY,
  ID_PHOTO_BENCHMARK_CONDITIONS,
  ID_PHOTO_EF_BENCHMARK_CONDITIONS,
  ID_PHOTO_FINAL_IMAGES_PER_SOURCE,
  ID_PHOTO_FINAL_VALIDATION_CONDITION,
  ID_PHOTO_G_CONSTRAINED_EDIT_CONDITION,
  ID_PHOTO_H_SKIN_INTENSITY_CONDITION,
  ID_PHOTO_BENCHMARK_IMAGES_PER_CONDITION,
  runIdPhotoConsistencyBenchmark,
  SIMPLIFIED_SKIN_SECTION,
  parseBenchmarkCliArgs,
} from "./id-photo-consistency";

describe("id-photo consistency benchmark", () => {
  it("defines exactly four conditions with five fixed generations each", () => {
    expect(ID_PHOTO_BENCHMARK_CONDITIONS).toEqual([
      expect.objectContaining({ id: "A-current-minimal", promptKind: "production", thinkingLevel: "minimal" }),
      expect.objectContaining({ id: "B-current-high", promptKind: "production", thinkingLevel: "high" }),
      expect.objectContaining({ id: "C-simple-minimal", promptKind: "experimental", thinkingLevel: "minimal" }),
      expect.objectContaining({ id: "D-simple-high", promptKind: "experimental", thinkingLevel: "high" }),
    ]);
    expect(ID_PHOTO_BENCHMARK_IMAGES_PER_CONDITION).toBe(5);
  });

  it("replaces only the production skin section in memory", () => {
    const experimental = buildExperimentalIdPhotoPrompt(idPhotoRuntimePrompt.body);
    const [productionBefore, productionAfter] = idPhotoRuntimePrompt.body.split("[피부]");
    const suffix = productionAfter.split("[머리카락]")[1];

    expect(experimental.startsWith(productionBefore)).toBe(true);
    expect(experimental).toContain(SIMPLIFIED_SKIN_SECTION);
    expect(experimental.endsWith(`[머리카락]${suffix}`)).toBe(true);
    expect(experimental).not.toContain("[피부]\n- 피부 전체를 새로운 피부로 생성하지 마세요.");
  });

  it("serializes only the documented Interactions thinking level fields", () => {
    const request = buildBenchmarkRequest("prompt", "high", {
      bytes: Buffer.from("source"),
      mimeType: "image/png",
    });

    expect(request).toMatchObject({
      model: "gemini-3.1-flash-image",
      generation_config: { thinking_level: "high" },
      response_format: { aspect_ratio: "1:1", image_size: "1K", mime_type: "image/jpeg" },
      store: false,
    });
    expect(request.input).toHaveLength(2);
    expect(request).not.toHaveProperty("generationConfig");
    expect(request).not.toHaveProperty("thinkingConfig");
  });

  it("defines E/F as ten high-thinking generations that differ only by prompt", () => {
    const conditions = conditionsForExperiment("ef");
    const ePrompt = buildSkinControlledPrompt(idPhotoRuntimePrompt.body);
    const fPrompt = buildEditPreservationPrompt(idPhotoRuntimePrompt.body);

    expect(conditions).toBe(ID_PHOTO_EF_BENCHMARK_CONDITIONS);
    expect(conditions).toHaveLength(2);
    expect(conditions.every((condition) => condition.thinkingLevel === "high")).toBe(true);
    expect(conditions.length * ID_PHOTO_BENCHMARK_IMAGES_PER_CONDITION).toBe(10);
    expect(ePrompt).toContain(CONTROLLED_SKIN_AND_HAIR_SECTION);
    expect(ePrompt).not.toContain(EDIT_PRESERVATION_SECTION);
    expect(fPrompt).toContain(CONTROLLED_SKIN_AND_HAIR_SECTION);
    expect(fPrompt).toContain(EDIT_PRESERVATION_SECTION);
    expect(fPrompt.replace(`${EDIT_PRESERVATION_SECTION}\n\n`, "")).toBe(ePrompt);
  });

  it("requires explicit execute while defaulting to dry-run", () => {
    const dryRun = parseBenchmarkCliArgs(["--input", "fixture.png"]);
    const execute = parseBenchmarkCliArgs(["--input", "fixture.png", "--execute"]);
    const ef = parseBenchmarkCliArgs(["--input", "fixture.png", "--experiment", "ef"]);

    expect(dryRun.execute).toBe(false);
    expect(dryRun.experiment).toBe("abcd");
    expect(execute.execute).toBe(true);
    expect(ef.experiment).toBe("ef");
    expect(() => parseBenchmarkCliArgs([])).toThrow("MISSING_REQUIRED_ARGUMENT:--input");
    expect(() => parseBenchmarkCliArgs(["--input", "fixture.png", "--experiment", "unknown"])).toThrow("UNSUPPORTED_EXPERIMENT");
  });

  it("recognizes final validation and requires both named inputs", () => {
    const finalValidation = parseBenchmarkCliArgs([
      "--experiment",
      "final-validation",
      "--long-hair-input",
      "long-hair.png",
      "--female-skin-input",
      "female-skin.png",
    ]);

    expect(finalValidation.experiment).toBe("final-validation");
    expect(finalValidation.execute).toBe(false);
    expect(conditionsForExperiment("final-validation")).toEqual([
      ID_PHOTO_FINAL_VALIDATION_CONDITION,
    ]);
    expect(ID_PHOTO_FINAL_IMAGES_PER_SOURCE).toBe(3);
    expect(() =>
      parseBenchmarkCliArgs(["--experiment", "final-validation"]),
    ).toThrow("MISSING_REQUIRED_ARGUMENT:--long-hair-input");
    expect(() =>
      parseBenchmarkCliArgs([
        "--experiment",
        "final-validation",
        "--long-hair-input",
        "long-hair.png",
      ]),
    ).toThrow("MISSING_REQUIRED_ARGUMENT:--female-skin-input");
  });

  it("recognizes G constrained edit and keeps its prompt independent from F and production", () => {
    const constrained = parseBenchmarkCliArgs([
      "--experiment",
      "g-constrained-edit",
      "--long-hair-input",
      "long-hair.png",
      "--female-skin-input",
      "female-skin.png",
    ]);
    const fPrompt = buildEditPreservationPrompt(idPhotoRuntimePrompt.body);

    expect(constrained.experiment).toBe("g-constrained-edit");
    expect(conditionsForExperiment("g-constrained-edit")).toEqual([
      ID_PHOTO_G_CONSTRAINED_EDIT_CONDITION,
    ]);
    expect(G_CONSTRAINED_EDIT_PROMPT).toContain("PRESERVE BY DEFAULT.");
    expect(G_CONSTRAINED_EDIT_PROMPT).toContain(
      "EDIT ONLY WHAT IS EXPLICITLY ALLOWED.",
    );
    expect(G_CONSTRAINED_EDIT_PROMPT).not.toContain(
      EDIT_PRESERVATION_SECTION,
    );
    expect(G_CONSTRAINED_EDIT_PROMPT).not.toBe(fPrompt);
    expect(G_CONSTRAINED_EDIT_PROMPT).not.toContain(idPhotoRuntimePrompt.body);
    expect(() =>
      parseBenchmarkCliArgs(["--experiment", "g-constrained-edit"]),
    ).toThrow("MISSING_REQUIRED_ARGUMENT:--long-hair-input");
    expect(() =>
      parseBenchmarkCliArgs([
        "--experiment",
        "g-constrained-edit",
        "--long-hair-input",
        "long-hair.png",
      ]),
    ).toThrow("MISSING_REQUIRED_ARGUMENT:--female-skin-input");
  });

  it("recognizes H with only female input and replaces only the G skin section", () => {
    const hOptions = parseBenchmarkCliArgs([
      "--experiment",
      "h-skin-intensity",
      "--female-skin-input",
      "female-skin.png",
    ]);
    const hPrompt = buildSkinIntensityPrompt(G_CONSTRAINED_EDIT_PROMPT);
    const [gBeforeSkin, gAfterSkinStart] =
      G_CONSTRAINED_EDIT_PROMPT.split("[피부 편집]");
    const afterSkin = gAfterSkinStart.split("[머리카락 편집]")[1];

    expect(hOptions.experiment).toBe("h-skin-intensity");
    expect(hOptions.longHairInputPath).toBeNull();
    expect(conditionsForExperiment("h-skin-intensity")).toEqual([
      ID_PHOTO_H_SKIN_INTENSITY_CONDITION,
    ]);
    expect(hPrompt.startsWith(gBeforeSkin)).toBe(true);
    expect(hPrompt).toContain(H_SKIN_INTENSITY_POLICY);
    expect(hPrompt.endsWith(`[머리카락 편집]${afterSkin}`)).toBe(true);
    expect(G_CONSTRAINED_EDIT_PROMPT).not.toContain(
      H_SKIN_INTENSITY_POLICY,
    );
    expect(() =>
      parseBenchmarkCliArgs(["--experiment", "h-skin-intensity"]),
    ).toThrow("MISSING_REQUIRED_ARGUMENT:--female-skin-input");
  });

  it("sends zero API requests and creates no result directory in E/F dry-run", async () => {
    const directory = await mkdtemp(join(tmpdir(), "stillme-id-photo-benchmark-"));
    const input = join(directory, "input.png");
    const results = join(directory, "results");
    await writeFile(
      input,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await runIdPhotoConsistencyBenchmark([
        "--input",
        input,
        "--experiment",
        "ef",
        "--results-root",
        results,
      ]);
      expect(fetchSpy).not.toHaveBeenCalled();
      await expect(import("node:fs/promises").then(({ access }) => access(results))).rejects.toThrow();
    } finally {
      fetchSpy.mockRestore();
      logSpy.mockRestore();
      await rm(directory, { recursive: true });
    }
  });

  it("writes a new isolated E/F result set with ten mocked provider responses", async () => {
    const directory = await mkdtemp(join(tmpdir(), "stillme-id-photo-benchmark-execute-"));
    const input = join(directory, "input.png");
    const resultsRoot = join(directory, "results");
    await writeFile(
      input,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    const previousApiKey = process.env.GOOGLE_AI_API_KEY;
    process.env.GOOGLE_AI_API_KEY = "synthetic-test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        output_image: { mime_type: "image/jpeg", data: "aW1hZ2U=" },
      }),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await runIdPhotoConsistencyBenchmark([
        "--input",
        input,
        "--experiment",
        "ef",
        "--results-root",
        resultsRoot,
        "--execute",
      ]);

      expect(fetchSpy).toHaveBeenCalledTimes(10);
      for (const [, init] of fetchSpy.mock.calls) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          model: "gemini-3.1-flash-image",
          generation_config: { thinking_level: "high" },
          response_format: {
            aspect_ratio: "1:1",
            image_size: "1K",
          },
          store: false,
        });
        expect(body.input[1]).toMatchObject({
          type: "image",
          mime_type: "image/png",
        });
      }

      const resultDirectories = await readdir(resultsRoot);
      expect(resultDirectories).toHaveLength(1);
      const resultDirectory = join(resultsRoot, resultDirectories[0]);
      expect(await readdir(join(resultDirectory, "E-skin-controlled-high"))).toHaveLength(5);
      expect(await readdir(join(resultDirectory, "F-edit-preservation-high"))).toHaveLength(5);
      const manifest = JSON.parse(
        await readFile(join(resultDirectory, "manifest.json"), "utf8"),
      );
      expect(manifest).toMatchObject({
        experiment: "ef",
        model: "gemini-3.1-flash-image",
        fixedConfiguration: {
          presetId: "resume-id",
          aspectRatio: "1:1",
          imageSize: "1K",
          background: "white",
          additionalRequest: null,
          candidateRequest: null,
          imagesPerCondition: 5,
        },
        productionSideEffects: {
          credit: false,
          generationClaim: false,
          history: false,
          supabase: false,
          productionStorage: false,
        },
      });
      expect(manifest.results).toHaveLength(10);
      expect(
        await readFile(join(resultDirectory, "evaluation.md"), "utf8"),
      ).toContain("New Skin Feature (Hard Failure)");
    } finally {
      fetchSpy.mockRestore();
      logSpy.mockRestore();
      if (previousApiKey === undefined) delete process.env.GOOGLE_AI_API_KEY;
      else process.env.GOOGLE_AI_API_KEY = previousApiKey;
      await rm(directory, { recursive: true });
    }
  });

  it("dry-runs final validation with two inputs and zero API requests", async () => {
    const directory = await mkdtemp(join(tmpdir(), "stillme-final-validation-dry-"));
    const longHairInput = join(directory, "long-hair.png");
    const femaleSkinInput = join(directory, "female-skin.png");
    const resultsRoot = join(directory, "results");
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    await Promise.all([
      writeFile(longHairInput, pngHeader),
      writeFile(femaleSkinInput, pngHeader),
    ]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await runIdPhotoConsistencyBenchmark([
        "--experiment",
        "final-validation",
        "--long-hair-input",
        longHairInput,
        "--female-skin-input",
        femaleSkinInput,
        "--results-root",
        resultsRoot,
      ]);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith("Expected sources: 2");
      expect(logSpy).toHaveBeenCalledWith("Images per source: 3");
      expect(logSpy).toHaveBeenCalledWith("Total expected generations: 6");
      expect(logSpy).toHaveBeenCalledWith("API calls: 0");
      await expect(
        import("node:fs/promises").then(({ access }) => access(resultsRoot)),
      ).rejects.toThrow();
    } finally {
      fetchSpy.mockRestore();
      logSpy.mockRestore();
      await rm(directory, { recursive: true });
    }
  });

  it("writes three final validation images per source using only the F condition", async () => {
    const directory = await mkdtemp(join(tmpdir(), "stillme-final-validation-execute-"));
    const longHairInput = join(directory, "long-hair.png");
    const femaleSkinInput = join(directory, "female-skin.png");
    const resultsRoot = join(directory, "results");
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    await Promise.all([
      writeFile(longHairInput, pngHeader),
      writeFile(femaleSkinInput, pngHeader),
    ]);
    const previousApiKey = process.env.GOOGLE_AI_API_KEY;
    process.env.GOOGLE_AI_API_KEY = "synthetic-test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({
        output_image: { mime_type: "image/jpeg", data: "aW1hZ2U=" },
      }),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await runIdPhotoConsistencyBenchmark([
        "--experiment",
        "final-validation",
        "--long-hair-input",
        longHairInput,
        "--female-skin-input",
        femaleSkinInput,
        "--results-root",
        resultsRoot,
        "--execute",
      ]);

      expect(fetchSpy).toHaveBeenCalledTimes(6);
      const requestBodies = fetchSpy.mock.calls.map(([, init]) =>
        JSON.parse(String(init?.body)),
      );
      expect(
        requestBodies.every(
          (body) =>
            body.model === "gemini-3.1-flash-image" &&
            body.generation_config.thinking_level === "high" &&
            body.response_format.aspect_ratio === "1:1" &&
            body.response_format.image_size === "1K" &&
            body.store === false,
        ),
      ).toBe(true);
      expect(new Set(requestBodies.map((body) => body.input[0].text)).size).toBe(1);

      const timestampDirectories = await readdir(resultsRoot);
      expect(timestampDirectories).toHaveLength(1);
      const resultDirectory = join(resultsRoot, timestampDirectories[0]);
      expect(await readdir(join(resultDirectory, "final-long-hair-man"))).toHaveLength(3);
      expect(await readdir(join(resultDirectory, "final-female-skin"))).toHaveLength(3);
      expect(await readdir(join(resultDirectory, "source"))).toHaveLength(2);
      const manifest = JSON.parse(
        await readFile(join(resultDirectory, "manifest.json"), "utf8"),
      );
      expect(manifest).toMatchObject({
        experiment: "final-validation",
        condition: "F-edit-preservation-high",
        thinkingLevel: "high",
        model: "gemini-3.1-flash-image",
        fixedConfiguration: {
          presetId: "resume-id",
          background: "white",
          aspectRatio: "1:1",
          imageSize: "1K",
          additionalRequest: null,
          candidateRequest: null,
          imagesPerSource: 3,
        },
      });
      expect(manifest.results).toHaveLength(6);
      expect(new Set(manifest.results.map((result: { condition: string }) => result.condition))).toEqual(
        new Set(["F-edit-preservation-high"]),
      );
      const evaluation = await readFile(
        join(resultDirectory, "evaluation.md"),
        "utf8",
      );
      expect(evaluation).toContain("## Long Hair Male");
      expect(evaluation).toContain("## Female Skin Trouble");
      expect(evaluation).toContain("Hard Failure");
    } finally {
      fetchSpy.mockRestore();
      logSpy.mockRestore();
      if (previousApiKey === undefined) delete process.env.GOOGLE_AI_API_KEY;
      else process.env.GOOGLE_AI_API_KEY = previousApiKey;
      await rm(directory, { recursive: true });
    }
  });

  it("dry-runs G with zero calls, then writes six mocked constrained-edit results", async () => {
    const directory = await mkdtemp(join(tmpdir(), "stillme-g-constrained-edit-"));
    const longHairInput = join(directory, "long-hair.png");
    const femaleSkinInput = join(directory, "female-skin.png");
    const resultsRoot = join(directory, "results");
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    await Promise.all([
      writeFile(longHairInput, pngHeader),
      writeFile(femaleSkinInput, pngHeader),
    ]);
    const previousApiKey = process.env.GOOGLE_AI_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const argumentsWithoutExecute = [
      "--experiment",
      "g-constrained-edit",
      "--long-hair-input",
      longHairInput,
      "--female-skin-input",
      femaleSkinInput,
      "--results-root",
      resultsRoot,
    ];

    try {
      await runIdPhotoConsistencyBenchmark(argumentsWithoutExecute);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith("Experiment: g-constrained-edit");
      expect(logSpy).toHaveBeenCalledWith("Sources: 2");
      expect(logSpy).toHaveBeenCalledWith("Images per source: 3");
      expect(logSpy).toHaveBeenCalledWith("Total expected generations: 6");
      expect(logSpy).toHaveBeenCalledWith("API calls: 0");

      process.env.GOOGLE_AI_API_KEY = "synthetic-test-key";
      fetchSpy.mockImplementation(async () =>
        Response.json({
          output_image: { mime_type: "image/jpeg", data: "aW1hZ2U=" },
        }),
      );
      await runIdPhotoConsistencyBenchmark([
        ...argumentsWithoutExecute,
        "--execute",
      ]);
      expect(fetchSpy).toHaveBeenCalledTimes(6);
      const requestBodies = fetchSpy.mock.calls.map(([, init]) =>
        JSON.parse(String(init?.body)),
      );
      expect(
        requestBodies.every(
          (body) =>
            body.model === "gemini-3.1-flash-image" &&
            body.generation_config.thinking_level === "high" &&
            body.response_format.aspect_ratio === "1:1" &&
            body.response_format.image_size === "1K" &&
            body.store === false &&
            body.input[0].text === G_CONSTRAINED_EDIT_PROMPT,
        ),
      ).toBe(true);

      const timestampDirectories = await readdir(resultsRoot);
      expect(timestampDirectories).toHaveLength(1);
      const resultDirectory = join(resultsRoot, timestampDirectories[0]);
      expect(
        await readdir(join(resultDirectory, "G-constrained-long-hair-man")),
      ).toHaveLength(3);
      expect(
        await readdir(join(resultDirectory, "G-constrained-female-skin")),
      ).toHaveLength(3);
      const manifest = JSON.parse(
        await readFile(join(resultDirectory, "manifest.json"), "utf8"),
      );
      expect(manifest).toMatchObject({
        experiment: "g-constrained-edit",
        condition: "G-constrained-edit-high",
        thinkingLevel: "high",
        model: "gemini-3.1-flash-image",
        fixedConfiguration: {
          presetId: "resume-id",
          background: "white",
          aspectRatio: "1:1",
          imageSize: "1K",
          imagesPerSource: 3,
        },
      });
      expect(manifest.results).toHaveLength(6);
      expect(manifest.gPrompt.sha256).toBeTruthy();
      const evaluation = await readFile(
        join(resultDirectory, "evaluation.md"),
        "utf8",
      );
      expect(evaluation).toContain("# G Constrained Edit Validation");
      expect(evaluation).toContain("Accessory Hallucination");
    } finally {
      fetchSpy.mockRestore();
      logSpy.mockRestore();
      if (previousApiKey === undefined) delete process.env.GOOGLE_AI_API_KEY;
      else process.env.GOOGLE_AI_API_KEY = previousApiKey;
      await rm(directory, { recursive: true });
    }
  });

  it("dry-runs H with zero calls, then writes three mocked skin-intensity results", async () => {
    const directory = await mkdtemp(join(tmpdir(), "stillme-h-skin-intensity-"));
    const femaleSkinInput = join(directory, "female-skin.png");
    const resultsRoot = join(directory, "results");
    await writeFile(
      femaleSkinInput,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    const previousApiKey = process.env.GOOGLE_AI_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const argumentsWithoutExecute = [
      "--experiment",
      "h-skin-intensity",
      "--female-skin-input",
      femaleSkinInput,
      "--results-root",
      resultsRoot,
    ];

    try {
      await runIdPhotoConsistencyBenchmark(argumentsWithoutExecute);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith("Experiment: h-skin-intensity");
      expect(logSpy).toHaveBeenCalledWith("Sources: 1");
      expect(logSpy).toHaveBeenCalledWith("Images per source: 3");
      expect(logSpy).toHaveBeenCalledWith("Total expected generations: 3");
      expect(logSpy).toHaveBeenCalledWith("API calls: 0");

      process.env.GOOGLE_AI_API_KEY = "synthetic-test-key";
      fetchSpy.mockImplementation(async () =>
        Response.json({
          output_image: { mime_type: "image/jpeg", data: "aW1hZ2U=" },
        }),
      );
      await runIdPhotoConsistencyBenchmark([
        ...argumentsWithoutExecute,
        "--execute",
      ]);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      const hPrompt = buildSkinIntensityPrompt(G_CONSTRAINED_EDIT_PROMPT);
      const requestBodies = fetchSpy.mock.calls.map(([, init]) =>
        JSON.parse(String(init?.body)),
      );
      expect(
        requestBodies.every(
          (body) =>
            body.model === "gemini-3.1-flash-image" &&
            body.generation_config.thinking_level === "high" &&
            body.response_format.aspect_ratio === "1:1" &&
            body.response_format.image_size === "1K" &&
            body.store === false &&
            body.input[0].text === hPrompt,
        ),
      ).toBe(true);

      const timestampDirectories = await readdir(resultsRoot);
      expect(timestampDirectories).toHaveLength(1);
      const resultDirectory = join(resultsRoot, timestampDirectories[0]);
      expect(
        await readdir(join(resultDirectory, "H-skin-intensity-female")),
      ).toHaveLength(3);
      expect(await readdir(join(resultDirectory, "source"))).toEqual([
        "female-skin.png",
      ]);
      const manifest = JSON.parse(
        await readFile(join(resultDirectory, "manifest.json"), "utf8"),
      );
      expect(manifest).toMatchObject({
        experiment: "h-skin-intensity",
        condition: "H-skin-intensity-high",
        thinkingLevel: "high",
        model: "gemini-3.1-flash-image",
        fixedConfiguration: {
          presetId: "resume-id",
          background: "white",
          aspectRatio: "1:1",
          imageSize: "1K",
          imagesPerSource: 3,
        },
      });
      expect(manifest.results).toHaveLength(3);
      expect(manifest.hPrompt.sha256).toBeTruthy();
      const evaluation = await readFile(
        join(resultDirectory, "evaluation.md"),
        "utf8",
      );
      expect(evaluation).toContain("# H Skin Intensity Validation");
      expect(evaluation).toContain("Skin intensity consistency");
    } finally {
      fetchSpy.mockRestore();
      logSpy.mockRestore();
      if (previousApiKey === undefined) delete process.env.GOOGLE_AI_API_KEY;
      else process.env.GOOGLE_AI_API_KEY = previousApiKey;
      await rm(directory, { recursive: true });
    }
  });
});
