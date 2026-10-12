import type { GenerationJobStatus } from "./job-state";

const STATUS_LABELS: Record<GenerationJobStatus, string> = {
  queued: "대기 중",
  processing: "생성 중",
  succeeded: "완료",
  failed: "실패",
  cancelled: "취소됨",
};

const FAILURE_MESSAGES: Record<string, string> = {
  PROVIDER_INVALID_REQUEST:
    "입력 파일 또는 요청 설정을 확인하지 못해 생성하지 못했습니다.",
  PROVIDER_AUTHENTICATION_FAILED:
    "이미지 생성 서비스 인증 설정 문제로 생성하지 못했습니다.",
  PROVIDER_ACCESS_DENIED:
    "이미지 생성 모델의 권한 또는 결제 설정 문제로 생성하지 못했습니다.",
  PROVIDER_MODEL_NOT_FOUND:
    "요청한 이미지 모델을 찾지 못해 생성하지 못했습니다.",
  PROVIDER_RATE_LIMITED: "요청이 많아 생성이 지연됐습니다.",
  PROVIDER_UNAVAILABLE: "이미지 생성 서비스에 일시적인 문제가 발생했습니다.",
  PROVIDER_REJECTED: "요청을 처리할 수 없어 생성하지 못했습니다.",
  PROVIDER_RESPONSE_INVALID: "생성 결과를 안전하게 확인하지 못했습니다.",
  IMAGE_DATA_INVALID: "생성된 이미지 파일을 확인하지 못했습니다.",
  IMAGE_FORMAT_UNSUPPORTED: "지원하지 않는 이미지 형식이 생성됐습니다.",
  IMAGE_METADATA_PROHIBITED: "안전하지 않은 이미지 메타데이터가 감지됐습니다.",
  IMAGE_DIMENSIONS_INVALID: "이미지 크기가 지원 범위를 벗어났습니다.",
  IMAGE_ASPECT_RATIO_MISMATCH: "요청한 화면 비율과 결과가 일치하지 않습니다.",
};

const HISTORY_ERROR_MESSAGES: Record<string, string> = {
  asset_invalid: "다운로드할 이미지를 확인하지 못했습니다.",
  asset_not_found: "다운로드할 이미지를 찾을 수 없습니다.",
  asset_delete_failed:
    "이미지를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  download_unavailable:
    "다운로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  generation_failed:
    "이미지를 생성하지 못했습니다. 사용한 Credit은 환불되었습니다.",
  reconciliation_required:
    "생성 결과 확인이 필요합니다. Credit 상태를 확인한 뒤 다시 안내해 드립니다.",
};

export function generationStatusLabel(status: GenerationJobStatus) {
  return STATUS_LABELS[status];
}

export function generationFailureMessage(errorCode: string | null) {
  if (!errorCode) {
    return "이미지를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  return (
    FAILURE_MESSAGES[errorCode] ??
    "이미지를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."
  );
}

export function historyErrorMessage(errorCode: string | undefined) {
  if (!errorCode) {
    return null;
  }

  return (
    HISTORY_ERROR_MESSAGES[errorCode] ??
    "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
  );
}

const SERVICE_PRESENTATION = [
  { prefix: "id-photo", name: "증명사진", path: "/generate/id-photo" },
  { prefix: "business-profile", name: "비즈니스 프로필", path: "/generate/business-profile" },
  { prefix: "profile-photo", name: "프로필 사진", path: "/generate/profile-photo" },
  { prefix: "underwater-correction", name: "물속 사진 보정", path: "/generate/underwater-correction" },
  { prefix: "character-avatar", name: "캐릭터 프로필", path: "/generate/character-avatar" },
] as const;

export function generationServiceName(promptId: string) {
  return (
    SERVICE_PRESENTATION.find(({ prefix }) => promptId.startsWith(prefix))?.name ??
    "프로필 사진"
  );
}

export function generationRetryPath(promptId: string) {
  return (
    SERVICE_PRESENTATION.find(({ prefix }) => promptId.startsWith(prefix))?.path ??
    "/generate"
  );
}

export function summarizePrompt(prompt: string, limit = 80) {
  const normalized = prompt.replace(/\s+/gu, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}
