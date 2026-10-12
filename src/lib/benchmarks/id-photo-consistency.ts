import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { GENERATION_MODEL_PROVIDER_IDS } from "../generation/model";
import { idPhotoRuntimePrompt } from "../prompts/runtime/id-photo/prompt";

export const ID_PHOTO_BENCHMARK_VERSION = "1.4.0";
export const ID_PHOTO_BENCHMARK_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
export const ID_PHOTO_BENCHMARK_IMAGES_PER_CONDITION = 5;
export const ID_PHOTO_BENCHMARK_MODEL = GENERATION_MODEL_PROVIDER_IDS.flash;
export const ID_PHOTO_BENCHMARK_ASPECT_RATIO = "1:1" as const;
export const ID_PHOTO_BENCHMARK_IMAGE_SIZE = "1K" as const;
export const ID_PHOTO_BENCHMARK_BACKGROUND = "white" as const;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ERROR_MESSAGE_LENGTH = 240;
const MAX_ENCODED_IMAGE_BYTES = 30 * 1024 * 1024;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export type BenchmarkThinkingLevel = "minimal" | "high";
export type BenchmarkExperiment =
  | "abcd"
  | "ef"
  | "final-validation"
  | "g-constrained-edit"
  | "h-skin-intensity";
export type BenchmarkConditionId =
  | "A-current-minimal"
  | "B-current-high"
  | "C-simple-minimal"
  | "D-simple-high"
  | "E-skin-controlled-high"
  | "F-edit-preservation-high"
  | "G-constrained-edit-high"
  | "H-skin-intensity-high";

export type BenchmarkCondition = Readonly<{
  id: BenchmarkConditionId;
  label: string;
  promptKind:
    | "production"
    | "experimental"
    | "skin-controlled"
    | "edit-preservation"
    | "constrained-edit"
    | "skin-intensity";
  thinkingLevel: BenchmarkThinkingLevel;
}>;

export const ID_PHOTO_BENCHMARK_CONDITIONS: readonly BenchmarkCondition[] = [
  {
    id: "A-current-minimal",
    label: "A — Current / Minimal",
    promptKind: "production",
    thinkingLevel: "minimal",
  },
  {
    id: "B-current-high",
    label: "B — Current / High",
    promptKind: "production",
    thinkingLevel: "high",
  },
  {
    id: "C-simple-minimal",
    label: "C — Simplified skin / Minimal",
    promptKind: "experimental",
    thinkingLevel: "minimal",
  },
  {
    id: "D-simple-high",
    label: "D — Simplified skin / High",
    promptKind: "experimental",
    thinkingLevel: "high",
  },
] as const;

export const ID_PHOTO_EF_BENCHMARK_CONDITIONS: readonly BenchmarkCondition[] = [
  {
    id: "E-skin-controlled-high",
    label: "E — Skin controlled / High",
    promptKind: "skin-controlled",
    thinkingLevel: "high",
  },
  {
    id: "F-edit-preservation-high",
    label: "F — Edit preservation / High",
    promptKind: "edit-preservation",
    thinkingLevel: "high",
  },
] as const;

export const ID_PHOTO_FINAL_VALIDATION_CONDITION =
  ID_PHOTO_EF_BENCHMARK_CONDITIONS[1];
export const ID_PHOTO_FINAL_IMAGES_PER_SOURCE = 3;
export const ID_PHOTO_G_CONSTRAINED_EDIT_CONDITION: BenchmarkCondition = {
  id: "G-constrained-edit-high",
  label: "G — Constrained edit / High",
  promptKind: "constrained-edit",
  thinkingLevel: "high",
};
export const ID_PHOTO_H_SKIN_INTENSITY_CONDITION: BenchmarkCondition = {
  id: "H-skin-intensity-high",
  label: "H — Skin intensity / High",
  promptKind: "skin-intensity",
  thinkingLevel: "high",
};

export const SIMPLIFIED_SKIN_SECTION = `[피부]

- 원본 사진의 피부를 기준으로 하세요.
- 일시적인 여드름과 붉은기는 자연스럽게 완화하되, 원본에서 확인되는 고유한 피부 특징은 유지하세요.
- 피부 보정 과정에서 원본에 존재하지 않는 새로운 피부 특징을 생성하지 마세요.
- 보정되지 않은 피부 영역은 원본의 피부 정보를 최대한 유지하고, 보정이 필요한 영역만 최소한으로 수정하세요.
- 전체 피부를 새롭게 생성하거나 재해석하지 마세요.
- 원본의 피부색과 얼굴의 자연스러운 입체감을 유지하세요.
- 과도한 피부 스무딩, 미백, 에어브러시 또는 플라스틱 같은 피부 표현을 만들지 마세요.`;

export const CONTROLLED_SKIN_AND_HAIR_SECTION = `[피부]

- 원본 사진에서 확인되는 피부색과 자연스러운 피부 질감을 기준으로 유지하세요.
- 여드름, 붉은기와 일시적인 피부 트러블은 공식 증명사진에 적합하도록 자연스럽게 완화하여 정돈할 수 있습니다.
- 피부 트러블을 정돈한 영역은 주변의 원래 피부색과 피부 질감이 자연스럽게 이어지도록 표현하세요.
- 원본에서 확인되지 않는 새로운 점, 주근깨, 색소침착, 반점, 흉터 또는 기타 식별 가능한 피부 특징을 생성하지 마세요.
- 제거하거나 완화한 피부 트러블을 점, 주근깨, 색소 또는 다른 피부 특징으로 대체하지 마세요.
- 원본에 존재하는 식별 가능한 영구적 피부 특징은 임의로 추가하거나 위치를 변경하지 마세요.
- 피부톤을 과도하게 밝히거나 피부 전체를 균일하게 만들지 마세요.
- 자연스러운 피부 질감과 얼굴의 입체감을 유지하세요.
- 과도한 피부 스무딩, 에어브러시, 왁스 또는 플라스틱 같은 피부 표현을 사용하지 마세요.

[머리카락]

- 원본의 모발 색상, 대략적인 길이, 헤어라인과 전체적인 머리 형태를 유지하세요.
- 공식 증명사진에 적합하도록 앞머리와 가르마를 자연스럽고 단정하게 정돈할 수 있습니다.
- 눈, 눈썹과 얼굴 윤곽이 명확하게 보이도록 머리카락을 정돈할 수 있습니다.
- 자연스러운 가르마 변경은 허용합니다.
- 과도한 올백, 모발 길이의 큰 변경, 헤어라인 변경 또는 원본과 전혀 다른 헤어스타일로 변경하지 마세요.`;

export const EDIT_PRESERVATION_SECTION = `[Benchmark 편집 보존 원칙]
- 이 작업은 새로운 인물이나 새로운 얼굴을 생성하는 작업이 아닙니다.
- 업로드된 원본 인물을 공식 증명사진 촬영 환경에 맞게 편집하는 작업으로 취급하세요.
- 원본 인물의 얼굴을 새로운 증명사진 얼굴로 재해석하거나 재디자인하지 마세요.
- 얼굴형, 턱선, 광대, 눈, 눈썹, 코, 입술, 귀, 얼굴 비율과 자연스러운 비대칭을 원본에서 직접 보존하세요.
- 피부를 새롭게 설계하거나 사실감을 높이기 위한 임의의 피부 특징을 추가하지 마세요.
- 공식 증명사진 스타일을 적용하기 위해 인물의 고유한 얼굴 특징을 평균화하거나 이상화하지 마세요.`;

export const G_CONSTRAINED_EDIT_PROMPT = `[작업 방식]

이 작업은 새로운 인물이나 새로운 얼굴을 생성하는 작업이 아닙니다.

업로드된 사진을 원본으로 사용하여 공식 증명사진에 필요한 부분만 제한적으로 편집하세요.

원본 이미지를 인물의 정체성, 얼굴, 피부, 머리카락과 개인 특징의 기준으로 사용하세요.

기본적으로 원본을 유지하세요.

아래에서 명시적으로 허용된 변경만 수행하고, 명시되지 않은 인물 특징은 새롭게 생성하거나 재디자인하지 마세요.

[보존 영역]

다음은 원본을 기준으로 보존하세요.

- 얼굴형
- 두상
- 턱선
- 광대
- 눈과 눈꺼풀
- 눈썹
- 코
- 입술
- 귀
- 얼굴 비율
- 자연스러운 얼굴 비대칭
- 헤어라인
- 머리 길이
- 전체적인 헤어스타일
- 모발 색상
- 원래 존재하는 식별 가능한 피부 특징

위 특징을 더 이상적이거나 더 전문적으로 보이도록 재설계하지 마세요.

[허용된 편집]

다음 변경만 허용합니다.

1. 증명사진에 적합한 정면 구도와 중앙 배치
2. 균일한 흰색 배경
3. 부드럽고 균일한 스튜디오 조명
4. 증명사진에 적합한 의상
5. 일시적인 여드름과 붉은기의 자연스러운 완화
6. 얼굴을 가리는 앞머리와 잔머리의 최소한의 정돈
7. 필요한 경우 자연스러운 가르마 정돈

이 목록 밖의 인물 특징 변경은 수행하지 마세요.

[피부 편집]

피부 전체를 새로운 피부로 생성하지 마세요.

원본에서 확인되는 일시적인 여드름과 붉은기만 자연스럽고 약하게 완화하세요.

피부 보정이 필요하지 않은 영역은 원본 피부를 기준으로 유지하세요.

원본에서 확인되지 않는 점, 주근깨, 색소, 반점, 흉터 또는 기타 피부 특징을 새롭게 만들지 마세요.

트러블을 완화한 위치를 새로운 점, 색소 또는 다른 피부 특징으로 대체하지 마세요.

원래 존재하는 식별 가능한 점이나 피부 특징은 임의로 제거하지 마세요.

피부색과 피부의 자연스러운 입체감은 원본을 유지하세요.

과도한 스무딩이나 미용 보정을 하지 마세요.

[머리카락 편집]

원본의 머리 길이, 헤어라인, 모발 색상과 전체적인 헤어스타일을 유지하세요.

증명사진에 적합하도록 앞머리와 잔머리를 최소한으로 정돈할 수 있습니다.

필요한 경우 자연스러운 가르마를 정돈하여 눈과 눈썹이 명확하게 보이도록 할 수 있습니다.

이러한 정돈 과정에서도 머리 길이는 변경하지 마세요.

장발이나 중장발을 짧은 헤어스타일로 바꾸지 마세요.

새로운 헤어스타일을 디자인하지 마세요.

과도한 올백 스타일로 변경하지 마세요.

[액세서리]

원본에 존재하지 않는 액세서리를 새로 추가하지 마세요.

특히 다음을 새로 생성하지 마세요.

- 귀걸이
- 피어싱
- 목걸이
- 안경
- 머리 장식

원본에 존재하는 액세서리를 처리해야 하는 경우에도 액세서리를 제거한 영역의 얼굴이나 귀 구조를 임의로 재디자인하지 마세요.

[표정]

원본 인물의 기본적인 인상과 얼굴 근육 상태를 최대한 유지하세요.

증명사진에 적합한 자연스러운 중립 표정을 사용하세요.

원본에 없는 미소를 새로 만들지 마세요.

입술 형태를 변경하지 마세요.

눈 크기나 눈매를 변경하지 마세요.

[최종 편집 원칙]

결과를 새로운 전문 증명사진 인물로 재해석하지 마세요.

원본 인물을 더 이상적인 사람으로 만들지 마세요.

원본 인물을 기준으로 필요한 부분만 편집한 사진처럼 보여야 합니다.

판단이 애매한 경우 변경하지 말고 원본을 유지하세요.

PRESERVE BY DEFAULT.
EDIT ONLY WHAT IS EXPLICITLY ALLOWED.`;

export const H_SKIN_INTENSITY_POLICY = `[피부 편집]

피부 보정의 목적은 피부를 결점 없는 피부로 만드는 것이 아닙니다.

원본 피부의 상태, 질감과 자연스러운 특징을 유지하면서 일시적인 여드름과 붉은기의 시각적 강도만 완화하세요.

원본에서 확인되는 여드름, 붉은기와 피부 요철을 완전히 제거하지 마세요.

눈에 띄는 붉은기와 염증성 트러블의 강도만 자연스럽게 낮추고, 트러블이 존재했던 사실과 원본 피부 질감이 결과에서도 자연스럽게 인식될 정도로 유지하세요.

트러블이 있던 영역을 결점 없는 피부로 새롭게 생성하거나 주변 피부와 완전히 동일한 상태로 만들지 마세요.

피부 보정이 필요하지 않은 영역은 원본을 기준으로 유지하세요.

피부 전체에 일괄적인 미용 보정을 적용하지 마세요.

원본에 존재하지 않는 점, 주근깨, 색소, 반점, 흉터 또는 기타 피부 특징을 새롭게 생성하지 마세요.

트러블을 제거한 위치를 점, 주근깨, 색소, 반점, 흉터 또는 다른 피부 특징으로 대체하지 마세요.

원본에 실제로 존재하는 식별 가능한 점이나 피부 특징은 임의로 제거하거나 위치를 변경하지 마세요.

원본의 피부색과 얼굴의 자연스러운 명암 및 입체감을 유지하세요.

피부를 도자기처럼 매끄럽게 만들거나 에어브러시, 과도한 스무딩 또는 미용 목적의 피부 개선을 하지 마세요.

세 후보 모두 동일한 피부 보정 원칙을 적용하세요.

후보마다 피부 보정 강도를 임의로 다르게 해석하지 마세요.

판단이 애매한 경우 트러블을 더 많이 제거하는 것보다 원본 피부를 더 많이 유지하는 방향을 우선하세요.`;

const G_SKIN_SECTION_START = "[피부 편집]";
const G_SKIN_SECTION_END = "[머리카락 편집]";

const PRODUCTION_SKIN_SECTION_BOUNDARIES = [
  {
    start: "[피부, 머리카락, 표정과 개인 특징]",
    end: "[편집 범위]",
    identity: "[원본 및 인물 보존]",
  },
  {
    start: "[피부]",
    end: "[머리카락]",
    identity: "[동일인 및 보존 영역]",
  },
] as const;

type BenchmarkCliOptions = Readonly<{
  execute: boolean;
  experiment: BenchmarkExperiment;
  inputPath: string | null;
  longHairInputPath: string | null;
  femaleSkinInputPath: string | null;
  resultsRoot: string;
}>;

type SourceImage = Readonly<{
  bytes: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: ".jpg" | ".png" | ".webp";
  sha256: string;
}>;

type BenchmarkRequest = Readonly<{
  model: typeof ID_PHOTO_BENCHMARK_MODEL;
  input: readonly [
    Readonly<{ type: "text"; text: string }>,
    Readonly<{ type: "image"; mime_type: SourceImage["mimeType"]; data: string }>,
  ];
  generation_config: Readonly<{ thinking_level: BenchmarkThinkingLevel }>;
  response_format: Readonly<{
    type: "image";
    mime_type: "image/jpeg";
    aspect_ratio: typeof ID_PHOTO_BENCHMARK_ASPECT_RATIO;
    image_size: typeof ID_PHOTO_BENCHMARK_IMAGE_SIZE;
  }>;
  store: false;
}>;

type ManifestResult = {
  condition: BenchmarkConditionId;
  sourceId?: "long-hair-man" | "female-skin";
  thinkingLevel: BenchmarkThinkingLevel;
  imageNumber: number;
  outputFilename: string | null;
  apiStatus: "success" | "failed";
  durationMs: number;
  attempts: number;
  retryOccurred: boolean;
  initialHttpStatus: number | null;
  initialFailureCode: string | null;
  httpStatus: number | null;
  failureCode: string | null;
};

type TwoSourceValidationManifest = {
  benchmarkVersion: string;
  experiment: "final-validation" | "g-constrained-edit";
  timestamp: string;
  model: string;
  sources: {
    longHairMale: {
      sha256: string;
      mimeType: SourceImage["mimeType"];
      bytes: number;
    };
    femaleSkinTrouble: {
      sha256: string;
      mimeType: SourceImage["mimeType"];
      bytes: number;
    };
  };
  productionPrompt: { version: string; sha256: string };
  fPrompt: { sha256: string };
  gPrompt: { sha256: string } | null;
  condition: BenchmarkConditionId;
  thinkingLevel: "high";
  fixedConfiguration: {
    presetId: "resume-id";
    aspectRatio: typeof ID_PHOTO_BENCHMARK_ASPECT_RATIO;
    imageSize: typeof ID_PHOTO_BENCHMARK_IMAGE_SIZE;
    background: typeof ID_PHOTO_BENCHMARK_BACKGROUND;
    additionalRequest: null;
    candidateRequest: null;
    imagesPerSource: typeof ID_PHOTO_FINAL_IMAGES_PER_SOURCE;
  };
  productionSideEffects: BenchmarkManifest["productionSideEffects"];
  results: ManifestResult[];
};

type SkinIntensityManifest = {
  benchmarkVersion: string;
  experiment: "h-skin-intensity";
  timestamp: string;
  model: string;
  source: {
    sha256: string;
    mimeType: SourceImage["mimeType"];
    bytes: number;
  };
  productionPrompt: { version: string; sha256: string };
  fPrompt: { sha256: string };
  gPrompt: { sha256: string };
  hPrompt: { sha256: string };
  condition: BenchmarkConditionId;
  thinkingLevel: "high";
  fixedConfiguration: {
    presetId: "resume-id";
    aspectRatio: typeof ID_PHOTO_BENCHMARK_ASPECT_RATIO;
    imageSize: typeof ID_PHOTO_BENCHMARK_IMAGE_SIZE;
    background: typeof ID_PHOTO_BENCHMARK_BACKGROUND;
    additionalRequest: null;
    candidateRequest: null;
    imagesPerSource: typeof ID_PHOTO_FINAL_IMAGES_PER_SOURCE;
  };
  productionSideEffects: BenchmarkManifest["productionSideEffects"];
  results: ManifestResult[];
};

type BenchmarkManifest = {
  benchmarkVersion: string;
  experiment: BenchmarkExperiment;
  timestamp: string;
  model: string;
  source: {
    sha256: string;
    mimeType: SourceImage["mimeType"];
    bytes: number;
  };
  productionPrompt: { version: string; sha256: string };
  experimentalPrompts: Record<string, { sha256: string }>;
  fixedConfiguration: {
    presetId: "resume-id";
    aspectRatio: typeof ID_PHOTO_BENCHMARK_ASPECT_RATIO;
    imageSize: typeof ID_PHOTO_BENCHMARK_IMAGE_SIZE;
    background: typeof ID_PHOTO_BENCHMARK_BACKGROUND;
    additionalRequest: null;
    candidateRequest: null;
    imagesPerCondition: number;
  };
  productionSideEffects: {
    credit: false;
    generationClaim: false;
    history: false;
    supabase: false;
    productionStorage: false;
  };
  results: ManifestResult[];
};

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function replaceProductionSkinSection(
  productionPrompt: string,
  replacement: string,
) {
  const boundary = PRODUCTION_SKIN_SECTION_BOUNDARIES.find(
    ({ start, end }) =>
      productionPrompt.includes(start) && productionPrompt.includes(end),
  );
  if (!boundary) {
    throw new Error("PRODUCTION_SKIN_SECTION_NOT_FOUND");
  }
  const start = productionPrompt.indexOf(boundary.start);
  const end = productionPrompt.indexOf(boundary.end);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("PRODUCTION_SKIN_SECTION_NOT_FOUND");
  }
  if (
    productionPrompt.indexOf(boundary.start, start + 1) >= 0 ||
    productionPrompt.indexOf(boundary.end, end + 1) >= 0
  ) {
    throw new Error("PRODUCTION_SKIN_SECTION_AMBIGUOUS");
  }

  const before = productionPrompt.slice(0, start);
  const after = productionPrompt.slice(end);
  return `${before}${replacement}\n\n${after}`;
}

export function buildExperimentalIdPhotoPrompt(productionPrompt: string) {
  return replaceProductionSkinSection(
    productionPrompt,
    SIMPLIFIED_SKIN_SECTION,
  );
}

export function buildSkinControlledPrompt(productionPrompt: string) {
  return replaceProductionSkinSection(
    productionPrompt,
    CONTROLLED_SKIN_AND_HAIR_SECTION,
  );
}

export function buildEditPreservationPrompt(productionPrompt: string) {
  const skinControlled = buildSkinControlledPrompt(productionPrompt);
  const insertionMarker = PRODUCTION_SKIN_SECTION_BOUNDARIES.find(
    ({ identity }) => skinControlled.includes(identity),
  )?.identity;
  if (!insertionMarker) {
    throw new Error("PRODUCTION_IDENTITY_SECTION_NOT_FOUND");
  }
  const markerIndex = skinControlled.indexOf(insertionMarker);
  if (
    markerIndex < 0 ||
    skinControlled.indexOf(insertionMarker, markerIndex + 1) >= 0
  ) {
    throw new Error("PRODUCTION_IDENTITY_SECTION_AMBIGUOUS");
  }
  return `${skinControlled.slice(0, markerIndex)}${EDIT_PRESERVATION_SECTION}\n\n${skinControlled.slice(markerIndex)}`;
}

export function buildSkinIntensityPrompt(gPrompt: string) {
  const start = gPrompt.indexOf(G_SKIN_SECTION_START);
  const end = gPrompt.indexOf(G_SKIN_SECTION_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("G_SKIN_SECTION_NOT_FOUND");
  }
  if (
    gPrompt.indexOf(G_SKIN_SECTION_START, start + 1) >= 0 ||
    gPrompt.indexOf(G_SKIN_SECTION_END, end + 1) >= 0
  ) {
    throw new Error("G_SKIN_SECTION_AMBIGUOUS");
  }
  return `${gPrompt.slice(0, start)}${H_SKIN_INTENSITY_POLICY}\n\n${gPrompt.slice(end)}`;
}

export function conditionsForExperiment(experiment: BenchmarkExperiment) {
  if (experiment === "h-skin-intensity") {
    return [ID_PHOTO_H_SKIN_INTENSITY_CONDITION] as const;
  }
  if (experiment === "g-constrained-edit") {
    return [ID_PHOTO_G_CONSTRAINED_EDIT_CONDITION] as const;
  }
  if (experiment === "final-validation") {
    return [ID_PHOTO_FINAL_VALIDATION_CONDITION] as const;
  }
  return experiment === "ef"
    ? ID_PHOTO_EF_BENCHMARK_CONDITIONS
    : ID_PHOTO_BENCHMARK_CONDITIONS;
}

export function parseBenchmarkCliArgs(args: readonly string[]): BenchmarkCliOptions {
  let execute = false;
  let experiment: BenchmarkExperiment = "abcd";
  let inputPath = "";
  let longHairInputPath = "";
  let femaleSkinInputPath = "";
  let resultsRoot = "benchmark-results/id-photo";

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--execute") {
      execute = true;
    } else if (argument === "--experiment") {
      const value = args[index + 1];
      if (
        value !== "abcd" &&
        value !== "ef" &&
        value !== "final-validation" &&
        value !== "g-constrained-edit" &&
        value !== "h-skin-intensity"
      ) {
        throw new Error(`UNSUPPORTED_EXPERIMENT:${String(value)}`);
      }
      experiment = value;
      index += 1;
    } else if (argument === "--input") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("MISSING_INPUT_PATH");
      inputPath = value;
      index += 1;
    } else if (argument === "--long-hair-input") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("MISSING_LONG_HAIR_INPUT_PATH");
      }
      longHairInputPath = value;
      index += 1;
    } else if (argument === "--female-skin-input") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("MISSING_FEMALE_SKIN_INPUT_PATH");
      }
      femaleSkinInputPath = value;
      index += 1;
    } else if (argument === "--results-root") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("MISSING_RESULTS_ROOT");
      resultsRoot = value;
      index += 1;
    } else {
      throw new Error(`UNKNOWN_ARGUMENT:${argument}`);
    }
  }
  if (experiment === "h-skin-intensity") {
    if (!femaleSkinInputPath) {
      throw new Error("MISSING_REQUIRED_ARGUMENT:--female-skin-input");
    }
  } else if (
    experiment === "final-validation" ||
    experiment === "g-constrained-edit"
  ) {
    if (!longHairInputPath) {
      throw new Error("MISSING_REQUIRED_ARGUMENT:--long-hair-input");
    }
    if (!femaleSkinInputPath) {
      throw new Error("MISSING_REQUIRED_ARGUMENT:--female-skin-input");
    }
  } else if (!inputPath) {
    throw new Error("MISSING_REQUIRED_ARGUMENT:--input");
  }
  return {
    execute,
    experiment,
    inputPath: inputPath ? resolve(inputPath) : null,
    longHairInputPath: longHairInputPath ? resolve(longHairInputPath) : null,
    femaleSkinInputPath: femaleSkinInputPath
      ? resolve(femaleSkinInputPath)
      : null,
    resultsRoot: resolve(resultsRoot),
  };
}

function detectSourceImage(bytes: Buffer, path: string): SourceImage {
  let mimeType: SourceImage["mimeType"];
  let extension: SourceImage["extension"];
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    mimeType = "image/jpeg";
    extension = ".jpg";
  } else if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    mimeType = "image/png";
    extension = ".png";
  } else if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    mimeType = "image/webp";
    extension = ".webp";
  } else {
    throw new Error(`UNSUPPORTED_INPUT_IMAGE:${basename(path)}`);
  }
  if (bytes.length === 0 || bytes.length > MAX_SOURCE_BYTES) {
    throw new Error("INPUT_IMAGE_SIZE_OUT_OF_RANGE");
  }
  return { bytes, mimeType, extension, sha256: sha256(bytes) };
}

export function buildBenchmarkRequest(
  prompt: string,
  thinkingLevel: BenchmarkThinkingLevel,
  source: Pick<SourceImage, "bytes" | "mimeType">,
): BenchmarkRequest {
  return {
    model: ID_PHOTO_BENCHMARK_MODEL,
    input: [
      { type: "text", text: prompt },
      { type: "image", mime_type: source.mimeType, data: source.bytes.toString("base64") },
    ],
    generation_config: { thinking_level: thinkingLevel },
    response_format: {
      type: "image",
      mime_type: "image/jpeg",
      aspect_ratio: ID_PHOTO_BENCHMARK_ASPECT_RATIO,
      image_size: ID_PHOTO_BENCHMARK_IMAGE_SIZE,
    },
    store: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOutputImage(payload: unknown): { data: string; extension: ".jpg" | ".png" | ".webp" } | null {
  const candidates: unknown[] = [];
  if (isRecord(payload) && isRecord(payload.output_image)) candidates.push(payload.output_image);
  if (isRecord(payload) && Array.isArray(payload.steps)) {
    for (const step of payload.steps) {
      if (isRecord(step) && step.type === "model_output" && Array.isArray(step.content)) {
        candidates.push(...step.content);
      }
    }
  }
  for (const candidate of candidates) {
    if (!isRecord(candidate) || (candidate.type !== undefined && candidate.type !== "image")) continue;
    const mimeType = candidate.mime_type;
    const data = candidate.data;
    if (
      typeof data !== "string" ||
      data.length === 0 ||
      data.length > MAX_ENCODED_IMAGE_BYTES ||
      !BASE64_PATTERN.test(data)
    ) continue;
    if (mimeType === "image/jpeg") return { data, extension: ".jpg" };
    if (mimeType === "image/png") return { data, extension: ".png" };
    if (mimeType === "image/webp") return { data, extension: ".webp" };
  }
  return null;
}

function safeFailureCode(status: number | null, error: unknown) {
  if (status !== null) return `HTTP_${status}`;
  const name = error instanceof Error ? error.name : "UNKNOWN_ERROR";
  return name.replace(/[^A-Za-z0-9_-]/gu, "_").slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function isRetryable(status: number | null, error: unknown) {
  return status === 429 || (status !== null && status >= 500) || (status === null && error instanceof TypeError);
}

async function requestImage(apiKey: string, body: BenchmarkRequest) {
  const response = await fetch(ID_PHOTO_BENCHMARK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const error = new Error(`HTTP_${response.status}`);
    Object.assign(error, { httpStatus: response.status });
    throw error;
  }
  const parsed = parseOutputImage(await response.json());
  if (!parsed) throw new Error("PROVIDER_RESPONSE_INVALID");
  return parsed;
}

function httpStatusFromError(error: unknown) {
  if (!isRecord(error)) return null;
  return typeof error.httpStatus === "number" ? error.httpStatus : null;
}

function timestampForPath(date: Date) {
  return date.toISOString().replace(/[-:.]/gu, "").replace("T", "-");
}

function evaluationMarkdown(
  experiment: BenchmarkExperiment,
  conditions: readonly BenchmarkCondition[],
) {
  if (experiment === "ef") {
    const criteria = `## 평가 기준과 우선순위

1. **New Skin Feature (Hard Failure):** 원본에 없던 점, 주근깨, 색소침착, 반점, 흉터 또는 기타 명확한 피부 특징이 나타나면 FAIL입니다. 이 경우 Overall은 기본적으로 FAIL입니다. 단순 모공이나 미세 질감 차이는 구분합니다.
2. **Existing Identity Feature Preservation:** 원본의 영구적이고 식별 가능한 특징 보존 여부
3. **Temporary Skin Issue Reduction:** 여드름·붉은기 등 일시적 트러블 정돈 품질
4. **Skin Naturalness:** 피부 질감과 입체감의 자연스러움
5. **Face Structure Preservation:** 얼굴형과 이목구비 구조 보존
6. **Identity Preservation:** 동일인 유지 정도
7. **Hair Grooming Naturalness:** 자연스러운 정돈 여부. 단순한 가르마 변경은 실패가 아닙니다.
`;
    const sections = conditions.map((condition) => {
      const rows = Array.from(
        { length: ID_PHOTO_BENCHMARK_IMAGES_PER_CONDITION },
        (_, index) => `| ${condition.id.slice(0, 1)}${String(index + 1).padStart(2, "0")} |  |  |  |  |  |  |  |  |  |`,
      ).join("\n");
      return `## ${condition.label}\n\n| Image | New Skin Feature | Existing Identity Feature Preservation | Temporary Skin Issue Reduction | Skin Naturalness | Face Structure Preservation | Identity Preservation | Hair Grooming Naturalness | Overall Pass/Fail | Notes |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${rows}`;
    }).join("\n\n");
    return `# ID Photo Consistency Benchmark — E/F\n\n${criteria}\n${sections}\n`;
  }

  const criteria = `## 평가 기준

- **New skin artifacts:** PASS = 원본에 없던 점/잡티/반점이 눈에 띄게 생성되지 않음, FAIL = 새 피부 특징이 생성됨
- **Acne cleanup:** 1~5
- **Identity preservation:** 1~5
- **Hair preservation:** 1~5
- **Over-retouch:** PASS / FAIL
`;
  const sections = conditions.map((condition) => {
    const rows = Array.from({ length: ID_PHOTO_BENCHMARK_IMAGES_PER_CONDITION }, (_, index) => {
      const prefix = condition.id.slice(0, 1);
      return `| ${prefix}${String(index + 1).padStart(2, "0")} |  |  |  |  |  |  |`;
    }).join("\n");
    return `## ${condition.label}\n\n| Image | New skin artifacts | Acne cleanup | Identity | Hair | Over-retouch | Notes |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}`;
  }).join("\n\n");
  return `# ID Photo Consistency Benchmark\n\n${criteria}\n${sections}\n`;
}

function finalValidationEvaluationMarkdown() {
  return `# Final Validation — F-edit-preservation-high

## Hard Failure 기준

- 공통: 다른 사람처럼 보임, 얼굴 구조가 명확하게 변경됨, 원본에 없는 명확한 피부 특징이 생성됨
- 장발 남성: 머리 길이가 크게 짧아지거나 장발 형태가 소실됨
- 트러블 여성: 새로운 점·주근깨·색소·흉터 생성, 피부의 과도한 재생성, 미용 목적의 과도한 얼굴 변경
- 위 항목 중 하나라도 발생하면 Overall을 FAIL로 평가할 수 있습니다.

## Long Hair Male

자연스러운 가르마, 앞머리 정돈, 눈썹 노출과 얼굴 윤곽을 위한 최소한의 정돈은 허용합니다. 전체적인 장발 형태, 길이, 헤어라인과 모발 색상은 유지되어야 합니다.

| Image | Identity | Face Structure | Hair Length | Hairline | Hair Grooming | New Skin Feature | Overall | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 |  |  |  |  |  |  |  |  |
| 02 |  |  |  |  |  |  |  |  |
| 03 |  |  |  |  |  |  |  |  |

## Female Skin Trouble

여드름·붉은기·일시적인 트러블의 자연스러운 완화는 허용합니다. 원본에 없던 식별 가능한 피부 특징, 과도하게 재생성된 피부 또는 미화된 얼굴은 Hard Failure입니다.

| Image | Identity | Face Structure | Skin Cleanup | New Skin Feature | Over Retouch | Skin Naturalness | Overall | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 |  |  |  |  |  |  |  |  |
| 02 |  |  |  |  |  |  |  |  |
| 03 |  |  |  |  |  |  |  |  |
`;
}

function gConstrainedEditEvaluationMarkdown() {
  return `# G Constrained Edit Validation

## Hard Failure 기준

- 공통: 다른 사람처럼 보임, 얼굴 구조 변경, 원본에 없는 점·주근깨·색소·흉터 생성, 원본에 없는 액세서리 생성
- 장발 남성: 머리 길이의 명확한 변화, 장발·중장발의 짧은 머리 전환, 헤어스타일 재디자인, 헤어라인 또는 모발 색상 변경, 과도한 올백
- 트러블 여성: 트러블 위치가 다른 피부 특징으로 대체됨, 과도한 피부 스무딩, 이목구비 변경, 원본에 없는 미소 생성
- 위 항목 중 하나라도 발생하면 Overall을 FAIL로 평가할 수 있습니다.

## Long Hair Male

| Image | Identity | Face Structure | Hair Length | Hair Style | New Skin Feature | Accessory Hallucination | Overall | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 |  |  |  |  |  |  |  |  |
| 02 |  |  |  |  |  |  |  |  |
| 03 |  |  |  |  |  |  |  |  |

## Female Skin Trouble

| Image | Identity | Face Structure | Skin Cleanup | New Skin Feature | Over Retouch | Accessory Hallucination | Expression | Overall | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 |  |  |  |  |  |  |  |  |  |
| 02 |  |  |  |  |  |  |  |  |  |
| 03 |  |  |  |  |  |  |  |  |  |
`;
}

function hSkinIntensityEvaluationMarkdown() {
  return `# H Skin Intensity Validation

## Hard Failure 기준

- 트러블이 거의 완전히 사라지거나 결점 없는 피부처럼 재생성됨
- 원본에 없는 점·주근깨·색소·반점·흉터 생성 또는 피부 특징 위치 재구성
- 트러블이 다른 피부 특징으로 대체됨
- 심한 피부 스무딩, 얼굴 구조 변경, 다른 사람처럼 보임
- 귀걸이 등 원본에 없는 액세서리 생성

## Female Skin Trouble

| Image | Identity | Face Structure | Skin Cleanup | Original Skin Retained | New Skin Feature | Over Retouch | Accessory Hallucination | Intensity | Overall | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 |  |  |  |  |  |  |  |  |  |  |
| 02 |  |  |  |  |  |  |  |  |  |  |
| 03 |  |  |  |  |  |  |  |  |  |  |

## Consistency

H-01 / H-02 / H-03 사이의 피부 보정 강도를 비교하세요.

Skin intensity consistency:

- [ ] PASS
- [ ] WARN
- [ ] FAIL

Notes:
`;
}

async function writeManifest(path: string, manifest: BenchmarkManifest) {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
}

async function writeFinalValidationManifest(
  path: string,
  manifest: TwoSourceValidationManifest,
) {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporaryPath, path);
}

async function writeSkinIntensityManifest(
  path: string,
  manifest: SkinIntensityManifest,
) {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporaryPath, path);
}

type BenchmarkPromptSet = Readonly<{
  production: string;
  experimental: string;
  skinControlled: string;
  editPreservation: string;
  constrainedEdit: string;
  skinIntensity: string;
}>;

function promptForCondition(
  condition: BenchmarkCondition,
  prompts: BenchmarkPromptSet,
) {
  if (condition.promptKind === "production") return prompts.production;
  if (condition.promptKind === "experimental") return prompts.experimental;
  if (condition.promptKind === "skin-controlled") return prompts.skinControlled;
  if (condition.promptKind === "edit-preservation") {
    return prompts.editPreservation;
  }
  if (condition.promptKind === "constrained-edit") {
    return prompts.constrainedEdit;
  }
  return prompts.skinIntensity;
}

function printPlan(
  options: BenchmarkCliOptions,
  source: SourceImage,
  conditions: readonly BenchmarkCondition[],
  promptHashes: Record<string, string>,
) {
  const expectedCalls =
    conditions.length * ID_PHOTO_BENCHMARK_IMAGES_PER_CONDITION;
  console.log(`Mode: ${options.execute ? "EXECUTE" : "DRY-RUN"}`);
  console.log(`Model: ${ID_PHOTO_BENCHMARK_MODEL}`);
  console.log(`Input: ${options.inputPath}`);
  console.log(`Input SHA-256: ${source.sha256}`);
  console.log(`Production Prompt Version: ${idPhotoRuntimePrompt.version}`);
  console.log(`Production Prompt SHA-256: ${promptHashes.production}`);
  if (options.experiment === "ef") {
    console.log(`E Prompt SHA-256: ${promptHashes.skinControlled}`);
    console.log(`F Prompt SHA-256: ${promptHashes.editPreservation}`);
  } else {
    console.log(`Experimental Prompt SHA-256: ${promptHashes.experimental}`);
  }
  console.log(`Conditions: ${conditions.map((condition) => `${condition.id}(${condition.thinkingLevel})`).join(", ")}`);
  console.log(`Images per condition: ${ID_PHOTO_BENCHMARK_IMAGES_PER_CONDITION}`);
  console.log(`Total expected generations: ${expectedCalls}`);
  console.log(`Estimated API calls: ${expectedCalls} (up to ${expectedCalls * 2} only if every request requires its single bounded retry)`);
  console.log("Production credit affected: NO");
  console.log("Supabase/history/production storage affected: NO");
}

async function runSkinIntensityValidation(options: BenchmarkCliOptions) {
  if (!options.femaleSkinInputPath) {
    throw new Error("MISSING_REQUIRED_ARGUMENT:--female-skin-input");
  }

  const sourceBytes = await readFile(options.femaleSkinInputPath);
  const source = detectSourceImage(sourceBytes, options.femaleSkinInputPath);
  const productionPrompt = idPhotoRuntimePrompt.body;
  const fPrompt = buildEditPreservationPrompt(productionPrompt);
  const hPrompt = buildSkinIntensityPrompt(G_CONSTRAINED_EDIT_PROMPT);
  const productionPromptHash = sha256(productionPrompt);
  const fPromptHash = sha256(fPrompt);
  const gPromptHash = sha256(G_CONSTRAINED_EDIT_PROMPT);
  const hPromptHash = sha256(hPrompt);

  console.log(`Mode: ${options.execute ? "EXECUTE" : "DRY-RUN"}`);
  console.log("Experiment: h-skin-intensity");
  console.log(`Model: ${ID_PHOTO_BENCHMARK_MODEL}`);
  console.log("Thinking level: high");
  console.log("Sources: 1");
  console.log(`Female-skin input hash: ${source.sha256}`);
  console.log(`Production Prompt Version: ${idPhotoRuntimePrompt.version}`);
  console.log(`Production Prompt SHA-256: ${productionPromptHash}`);
  console.log(`F Prompt SHA-256: ${fPromptHash}`);
  console.log(`G Prompt SHA-256: ${gPromptHash}`);
  console.log(`H Prompt SHA-256: ${hPromptHash}`);
  console.log(`Images per source: ${ID_PHOTO_FINAL_IMAGES_PER_SOURCE}`);
  console.log(`Total expected generations: ${ID_PHOTO_FINAL_IMAGES_PER_SOURCE}`);
  console.log(
    `Estimated API calls: ${ID_PHOTO_FINAL_IMAGES_PER_SOURCE} (up to ${ID_PHOTO_FINAL_IMAGES_PER_SOURCE * 2} only if every request requires its single bounded retry)`,
  );
  console.log(
    `API calls: ${options.execute ? ID_PHOTO_FINAL_IMAGES_PER_SOURCE : 0}`,
  );
  console.log("Production Credit affected: NO");
  console.log("Supabase/history/storage affected: NO");

  if (!options.execute) {
    console.log(
      "Dry-run complete. No Google API request was sent and no result directory was created.",
    );
    return;
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) throw new Error("MISSING_GOOGLE_AI_API_KEY");

  const timestamp = new Date();
  const resultDirectory = resolve(
    options.resultsRoot,
    timestampForPath(timestamp),
  );
  const sourceDirectory = resolve(resultDirectory, "source");
  const outputDirectory = resolve(
    resultDirectory,
    "H-skin-intensity-female",
  );
  await mkdir(options.resultsRoot, { recursive: true, mode: 0o700 });
  await mkdir(resultDirectory, { mode: 0o700 });
  await mkdir(sourceDirectory, { mode: 0o700 });
  await mkdir(outputDirectory, { mode: 0o700 });
  await Promise.all([
    writeFile(
      resolve(sourceDirectory, `female-skin${source.extension}`),
      source.bytes,
      { mode: 0o600 },
    ),
    writeFile(
      resolve(resultDirectory, "evaluation.md"),
      hSkinIntensityEvaluationMarkdown(),
      { mode: 0o600 },
    ),
  ]);

  const manifest: SkinIntensityManifest = {
    benchmarkVersion: ID_PHOTO_BENCHMARK_VERSION,
    experiment: "h-skin-intensity",
    timestamp: timestamp.toISOString(),
    model: ID_PHOTO_BENCHMARK_MODEL,
    source: {
      sha256: source.sha256,
      mimeType: source.mimeType,
      bytes: source.bytes.length,
    },
    productionPrompt: {
      version: idPhotoRuntimePrompt.version,
      sha256: productionPromptHash,
    },
    fPrompt: { sha256: fPromptHash },
    gPrompt: { sha256: gPromptHash },
    hPrompt: { sha256: hPromptHash },
    condition: ID_PHOTO_H_SKIN_INTENSITY_CONDITION.id,
    thinkingLevel: "high",
    fixedConfiguration: {
      presetId: "resume-id",
      aspectRatio: ID_PHOTO_BENCHMARK_ASPECT_RATIO,
      imageSize: ID_PHOTO_BENCHMARK_IMAGE_SIZE,
      background: ID_PHOTO_BENCHMARK_BACKGROUND,
      additionalRequest: null,
      candidateRequest: null,
      imagesPerSource: ID_PHOTO_FINAL_IMAGES_PER_SOURCE,
    },
    productionSideEffects: {
      credit: false,
      generationClaim: false,
      history: false,
      supabase: false,
      productionStorage: false,
    },
    results: [],
  };
  const manifestPath = resolve(resultDirectory, "manifest.json");
  await writeSkinIntensityManifest(manifestPath, manifest);
  const request = buildBenchmarkRequest(hPrompt, "high", source);

  for (
    let imageNumber = 1;
    imageNumber <= ID_PHOTO_FINAL_IMAGES_PER_SOURCE;
    imageNumber += 1
  ) {
    const startedAt = Date.now();
    let attempts = 0;
    let outputFilename: string | null = null;
    let httpStatus: number | null = null;
    let failureCode: string | null = null;
    let initialHttpStatus: number | null = null;
    let initialFailureCode: string | null = null;
    let success = false;
    while (attempts < 2 && !success) {
      attempts += 1;
      try {
        const image = await requestImage(apiKey, request);
        outputFilename = `${String(imageNumber).padStart(2, "0")}${image.extension}`;
        await writeFile(
          resolve(outputDirectory, outputFilename),
          Buffer.from(image.data, "base64"),
          { mode: 0o600 },
        );
        success = true;
      } catch (error) {
        httpStatus = httpStatusFromError(error);
        failureCode = safeFailureCode(httpStatus, error);
        if (attempts === 1) {
          initialHttpStatus = httpStatus;
          initialFailureCode = failureCode;
        }
        if (attempts >= 2 || !isRetryable(httpStatus, error)) break;
      }
    }
    manifest.results.push({
      condition: ID_PHOTO_H_SKIN_INTENSITY_CONDITION.id,
      sourceId: "female-skin",
      thinkingLevel: "high",
      imageNumber,
      outputFilename,
      apiStatus: success ? "success" : "failed",
      durationMs: Date.now() - startedAt,
      attempts,
      retryOccurred: attempts > 1,
      initialHttpStatus,
      initialFailureCode,
      httpStatus: success ? 200 : httpStatus,
      failureCode: success ? null : failureCode,
    });
    await writeSkinIntensityManifest(manifestPath, manifest);
    console.log(
      `H-skin-intensity-female ${String(imageNumber).padStart(2, "0")}: ${success ? "SUCCESS" : `FAILED (${failureCode})`}`,
    );
  }
  console.log(`Benchmark complete: ${resultDirectory}`);
}

async function runTwoSourceValidation(options: BenchmarkCliOptions) {
  if (!options.longHairInputPath) {
    throw new Error("MISSING_REQUIRED_ARGUMENT:--long-hair-input");
  }
  if (!options.femaleSkinInputPath) {
    throw new Error("MISSING_REQUIRED_ARGUMENT:--female-skin-input");
  }

  const [longHairBytes, femaleSkinBytes] = await Promise.all([
    readFile(options.longHairInputPath),
    readFile(options.femaleSkinInputPath),
  ]);
  const longHairSource = detectSourceImage(
    longHairBytes,
    options.longHairInputPath,
  );
  const femaleSkinSource = detectSourceImage(
    femaleSkinBytes,
    options.femaleSkinInputPath,
  );
  const productionPrompt = idPhotoRuntimePrompt.body;
  const fPrompt = buildEditPreservationPrompt(productionPrompt);
  const isConstrainedEdit = options.experiment === "g-constrained-edit";
  const benchmarkPrompt = isConstrainedEdit
    ? G_CONSTRAINED_EDIT_PROMPT
    : fPrompt;
  const condition = isConstrainedEdit
    ? ID_PHOTO_G_CONSTRAINED_EDIT_CONDITION
    : ID_PHOTO_FINAL_VALIDATION_CONDITION;
  const longHairOutputDirectory = isConstrainedEdit
    ? "G-constrained-long-hair-man"
    : "final-long-hair-man";
  const femaleSkinOutputDirectory = isConstrainedEdit
    ? "G-constrained-female-skin"
    : "final-female-skin";
  const productionPromptHash = sha256(productionPrompt);
  const fPromptHash = sha256(fPrompt);
  const gPromptHash = sha256(G_CONSTRAINED_EDIT_PROMPT);
  const expectedImages = ID_PHOTO_FINAL_IMAGES_PER_SOURCE * 2;

  console.log(`Mode: ${options.execute ? "EXECUTE" : "DRY-RUN"}`);
  console.log(`Model: ${ID_PHOTO_BENCHMARK_MODEL}`);
  console.log("Thinking level: high");
  console.log(`Experiment: ${options.experiment}`);
  console.log(`Long-hair input hash: ${longHairSource.sha256}`);
  console.log(`Female-skin input hash: ${femaleSkinSource.sha256}`);
  console.log(`Production Prompt Version: ${idPhotoRuntimePrompt.version}`);
  console.log(`Production Prompt SHA-256: ${productionPromptHash}`);
  console.log(`F Prompt SHA-256: ${fPromptHash}`);
  if (isConstrainedEdit) {
    console.log(`G Prompt SHA-256: ${gPromptHash}`);
  }
  console.log("Sources: 2");
  console.log("Expected sources: 2");
  console.log(`Images per source: ${ID_PHOTO_FINAL_IMAGES_PER_SOURCE}`);
  console.log(`Total expected generations: ${expectedImages}`);
  console.log(
    `Estimated API calls: ${expectedImages} (up to ${expectedImages * 2} only if every request requires its single bounded retry)`,
  );
  console.log(`API calls: ${options.execute ? expectedImages : 0}`);
  console.log("Production Credit affected: NO");
  console.log("Supabase/history/storage affected: NO");

  if (!options.execute) {
    console.log(
      "Dry-run complete. No Google API request was sent and no result directory was created.",
    );
    return;
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) throw new Error("MISSING_GOOGLE_AI_API_KEY");

  const timestamp = new Date();
  const resultDirectory = resolve(
    options.resultsRoot,
    timestampForPath(timestamp),
  );
  await mkdir(options.resultsRoot, { recursive: true, mode: 0o700 });
  await mkdir(resultDirectory, { mode: 0o700 });
  const sourceDirectory = resolve(resultDirectory, "source");
  await mkdir(sourceDirectory, { mode: 0o700 });
  await mkdir(resolve(resultDirectory, longHairOutputDirectory), {
    mode: 0o700,
  });
  await mkdir(resolve(resultDirectory, femaleSkinOutputDirectory), {
    mode: 0o700,
  });
  await Promise.all([
    writeFile(
      resolve(sourceDirectory, `long-hair-man${longHairSource.extension}`),
      longHairSource.bytes,
      { mode: 0o600 },
    ),
    writeFile(
      resolve(sourceDirectory, `female-skin${femaleSkinSource.extension}`),
      femaleSkinSource.bytes,
      { mode: 0o600 },
    ),
    writeFile(
      resolve(resultDirectory, "evaluation.md"),
      isConstrainedEdit
        ? gConstrainedEditEvaluationMarkdown()
        : finalValidationEvaluationMarkdown(),
      { mode: 0o600 },
    ),
  ]);

  const manifest: TwoSourceValidationManifest = {
    benchmarkVersion: ID_PHOTO_BENCHMARK_VERSION,
    experiment: isConstrainedEdit
      ? "g-constrained-edit"
      : "final-validation",
    timestamp: timestamp.toISOString(),
    model: ID_PHOTO_BENCHMARK_MODEL,
    sources: {
      longHairMale: {
        sha256: longHairSource.sha256,
        mimeType: longHairSource.mimeType,
        bytes: longHairSource.bytes.length,
      },
      femaleSkinTrouble: {
        sha256: femaleSkinSource.sha256,
        mimeType: femaleSkinSource.mimeType,
        bytes: femaleSkinSource.bytes.length,
      },
    },
    productionPrompt: {
      version: idPhotoRuntimePrompt.version,
      sha256: productionPromptHash,
    },
    fPrompt: { sha256: fPromptHash },
    gPrompt: isConstrainedEdit ? { sha256: gPromptHash } : null,
    condition: condition.id,
    thinkingLevel: "high",
    fixedConfiguration: {
      presetId: "resume-id",
      aspectRatio: ID_PHOTO_BENCHMARK_ASPECT_RATIO,
      imageSize: ID_PHOTO_BENCHMARK_IMAGE_SIZE,
      background: ID_PHOTO_BENCHMARK_BACKGROUND,
      additionalRequest: null,
      candidateRequest: null,
      imagesPerSource: ID_PHOTO_FINAL_IMAGES_PER_SOURCE,
    },
    productionSideEffects: {
      credit: false,
      generationClaim: false,
      history: false,
      supabase: false,
      productionStorage: false,
    },
    results: [],
  };
  const manifestPath = resolve(resultDirectory, "manifest.json");
  await writeFinalValidationManifest(manifestPath, manifest);

  const sourceRuns = [
    {
      id: "long-hair-man" as const,
      outputDirectory: longHairOutputDirectory,
      source: longHairSource,
    },
    {
      id: "female-skin" as const,
      outputDirectory: femaleSkinOutputDirectory,
      source: femaleSkinSource,
    },
  ];
  for (const sourceRun of sourceRuns) {
    const request = buildBenchmarkRequest(
      benchmarkPrompt,
      "high",
      sourceRun.source,
    );
    for (
      let imageNumber = 1;
      imageNumber <= ID_PHOTO_FINAL_IMAGES_PER_SOURCE;
      imageNumber += 1
    ) {
      const startedAt = Date.now();
      let attempts = 0;
      let outputFilename: string | null = null;
      let httpStatus: number | null = null;
      let failureCode: string | null = null;
      let initialHttpStatus: number | null = null;
      let initialFailureCode: string | null = null;
      let success = false;
      while (attempts < 2 && !success) {
        attempts += 1;
        try {
          const image = await requestImage(apiKey, request);
          outputFilename = `${String(imageNumber).padStart(2, "0")}${image.extension}`;
          await writeFile(
            resolve(
              resultDirectory,
              sourceRun.outputDirectory,
              outputFilename,
            ),
            Buffer.from(image.data, "base64"),
            { mode: 0o600 },
          );
          success = true;
        } catch (error) {
          httpStatus = httpStatusFromError(error);
          failureCode = safeFailureCode(httpStatus, error);
          if (attempts === 1) {
            initialHttpStatus = httpStatus;
            initialFailureCode = failureCode;
          }
          if (attempts >= 2 || !isRetryable(httpStatus, error)) break;
        }
      }
      manifest.results.push({
        condition: condition.id,
        sourceId: sourceRun.id,
        thinkingLevel: "high",
        imageNumber,
        outputFilename,
        apiStatus: success ? "success" : "failed",
        durationMs: Date.now() - startedAt,
        attempts,
        retryOccurred: attempts > 1,
        initialHttpStatus,
        initialFailureCode,
        httpStatus: success ? 200 : httpStatus,
        failureCode: success ? null : failureCode,
      });
      await writeFinalValidationManifest(manifestPath, manifest);
      console.log(
        `${sourceRun.outputDirectory} ${String(imageNumber).padStart(2, "0")}: ${success ? "SUCCESS" : `FAILED (${failureCode})`}`,
      );
    }
  }
  console.log(`Benchmark complete: ${resultDirectory}`);
}

export async function runIdPhotoConsistencyBenchmark(args: readonly string[]) {
  const options = parseBenchmarkCliArgs(args);
  if (options.experiment === "h-skin-intensity") {
    await runSkinIntensityValidation(options);
    return;
  }
  if (
    options.experiment === "final-validation" ||
    options.experiment === "g-constrained-edit"
  ) {
    await runTwoSourceValidation(options);
    return;
  }
  if (!options.inputPath) {
    throw new Error("MISSING_REQUIRED_ARGUMENT:--input");
  }
  const inputBytes = await readFile(options.inputPath);
  const source = detectSourceImage(inputBytes, options.inputPath);
  const productionPrompt = idPhotoRuntimePrompt.body;
  const experimentalPrompt = buildExperimentalIdPhotoPrompt(productionPrompt);
  const skinControlledPrompt = buildSkinControlledPrompt(productionPrompt);
  const editPreservationPrompt = buildEditPreservationPrompt(productionPrompt);
  const prompts: BenchmarkPromptSet = {
    production: productionPrompt,
    experimental: experimentalPrompt,
    skinControlled: skinControlledPrompt,
    editPreservation: editPreservationPrompt,
    constrainedEdit: G_CONSTRAINED_EDIT_PROMPT,
    skinIntensity: buildSkinIntensityPrompt(G_CONSTRAINED_EDIT_PROMPT),
  };
  const promptHashes = {
    production: sha256(productionPrompt),
    experimental: sha256(experimentalPrompt),
    skinControlled: sha256(skinControlledPrompt),
    editPreservation: sha256(editPreservationPrompt),
    constrainedEdit: sha256(G_CONSTRAINED_EDIT_PROMPT),
    skinIntensity: sha256(
      buildSkinIntensityPrompt(G_CONSTRAINED_EDIT_PROMPT),
    ),
  };
  const conditions = conditionsForExperiment(options.experiment);
  printPlan(options, source, conditions, promptHashes);

  if (!options.execute) {
    console.log("Dry-run complete. No Google API request was sent and no result directory was created.");
    return;
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) throw new Error("MISSING_GOOGLE_AI_API_KEY");

  const timestamp = new Date();
  const resultDirectory = resolve(options.resultsRoot, timestampForPath(timestamp));
  const sourceDirectory = resolve(resultDirectory, "source");
  await mkdir(options.resultsRoot, { recursive: true, mode: 0o700 });
  await mkdir(resultDirectory, { mode: 0o700 });
  await mkdir(sourceDirectory, { recursive: true, mode: 0o700 });
  for (const condition of conditions) {
    await mkdir(resolve(resultDirectory, condition.id), { recursive: true, mode: 0o700 });
  }
  await writeFile(resolve(sourceDirectory, `original${source.extension}`), source.bytes, { mode: 0o600 });
  await writeFile(
    resolve(resultDirectory, "evaluation.md"),
    evaluationMarkdown(options.experiment, conditions),
    { mode: 0o600 },
  );

  const manifest: BenchmarkManifest = {
    benchmarkVersion: ID_PHOTO_BENCHMARK_VERSION,
    experiment: options.experiment,
    timestamp: timestamp.toISOString(),
    model: ID_PHOTO_BENCHMARK_MODEL,
    source: { sha256: source.sha256, mimeType: source.mimeType, bytes: source.bytes.length },
    productionPrompt: {
      version: idPhotoRuntimePrompt.version,
      sha256: promptHashes.production,
    },
    experimentalPrompts: Object.fromEntries(
      conditions
        .filter((condition) => condition.promptKind !== "production")
        .map((condition) => [
          condition.id,
          { sha256: sha256(promptForCondition(condition, prompts)) },
        ]),
    ),
    fixedConfiguration: {
      presetId: "resume-id",
      aspectRatio: ID_PHOTO_BENCHMARK_ASPECT_RATIO,
      imageSize: ID_PHOTO_BENCHMARK_IMAGE_SIZE,
      background: ID_PHOTO_BENCHMARK_BACKGROUND,
      additionalRequest: null,
      candidateRequest: null,
      imagesPerCondition: ID_PHOTO_BENCHMARK_IMAGES_PER_CONDITION,
    },
    productionSideEffects: {
      credit: false,
      generationClaim: false,
      history: false,
      supabase: false,
      productionStorage: false,
    },
    results: [],
  };
  const manifestPath = resolve(resultDirectory, "manifest.json");
  await writeManifest(manifestPath, manifest);

  for (const condition of conditions) {
    const prompt = promptForCondition(condition, prompts);
    const request = buildBenchmarkRequest(prompt, condition.thinkingLevel, source);
    for (let imageNumber = 1; imageNumber <= ID_PHOTO_BENCHMARK_IMAGES_PER_CONDITION; imageNumber += 1) {
      const startedAt = Date.now();
      let attempts = 0;
      let outputFilename: string | null = null;
      let httpStatus: number | null = null;
      let failureCode: string | null = null;
      let initialHttpStatus: number | null = null;
      let initialFailureCode: string | null = null;
      let success = false;
      while (attempts < 2 && !success) {
        attempts += 1;
        try {
          const image = await requestImage(apiKey, request);
          outputFilename = `${String(imageNumber).padStart(2, "0")}${image.extension}`;
          await writeFile(
            resolve(resultDirectory, condition.id, outputFilename),
            Buffer.from(image.data, "base64"),
            { mode: 0o600 },
          );
          success = true;
        } catch (error) {
          httpStatus = httpStatusFromError(error);
          failureCode = safeFailureCode(httpStatus, error);
          if (attempts === 1) {
            initialHttpStatus = httpStatus;
            initialFailureCode = failureCode;
          }
          if (attempts >= 2 || !isRetryable(httpStatus, error)) break;
        }
      }
      manifest.results.push({
        condition: condition.id,
        thinkingLevel: condition.thinkingLevel,
        imageNumber,
        outputFilename,
        apiStatus: success ? "success" : "failed",
        durationMs: Date.now() - startedAt,
        attempts,
        retryOccurred: attempts > 1,
        initialHttpStatus,
        initialFailureCode,
        httpStatus: success ? 200 : httpStatus,
        failureCode: success ? null : failureCode,
      });
      await writeManifest(manifestPath, manifest);
      console.log(`${condition.id} ${String(imageNumber).padStart(2, "0")}: ${success ? "SUCCESS" : `FAILED (${failureCode})`}`);
    }
  }
  console.log(`Benchmark complete: ${resultDirectory}`);
}
