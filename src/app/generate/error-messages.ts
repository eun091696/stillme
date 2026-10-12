import type { GenerateImageErrorCode } from "./actions";

export const GENERATE_IMAGE_ERROR_MESSAGES: Record<
  GenerateImageErrorCode,
  string
> = {
  AUTH_REQUIRED: "로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.",
  INVALID_PRESET: "지원하는 사진 유형을 다시 선택해 주세요.",
  INVALID_SOURCE_IMAGE: "JPG, PNG, WEBP 형식의 10MB 이하 사진을 선택해 주세요.",
  ADDITIONAL_REQUEST_REJECTED:
    "동일인성을 크게 바꾸거나 허위 로고·자격을 만드는 요청은 처리할 수 없습니다.",
  PROFESSION_REQUIRED: "비즈니스 프로필에 사용할 직업을 80자 이내로 입력해 주세요.",
  PROFESSION_INVALID:
    "직업에는 직무명만 입력해 주세요. 제어 문자나 Prompt 규칙 변경 요청은 사용할 수 없습니다.",
  INVALID_GENERATION_OPTIONS:
    "사진별 생성 옵션을 확인해 주세요. 지원하는 배경만 선택할 수 있습니다.",
  SERVICE_UNAVAILABLE:
    "사진 생성 서비스 설정을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.",
  INSUFFICIENT_CREDIT: "사진을 만들기 위한 Credit이 부족합니다.",
  REQUEST_OUTDATED:
    "이전 화면의 요청입니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
  REQUEST_FAILED: "사진 생성 요청을 준비하지 못했습니다. 다시 시도해 주세요.",
  PROVIDER_INVALID_REQUEST:
    "이미지 생성 요청을 처리하지 못했습니다. 입력 파일 또는 요청 설정을 확인해 주세요.",
  PROVIDER_AUTHENTICATION_FAILED:
    "이미지 생성 서비스 인증 설정을 확인해 주세요.",
  PROVIDER_ACCESS_DENIED:
    "사진 생성 서비스를 잠시 이용할 수 없습니다. 이번 요청에는 Credit이 차감되지 않았어요. 잠시 후 다시 시도해 주세요.",
  PROVIDER_MODEL_NOT_FOUND:
    "요청한 이미지 모델을 찾을 수 없습니다. 모델 설정을 확인해 주세요.",
  PROVIDER_RATE_LIMITED:
    "현재 요청이 많아 잠시 후 다시 시도해 주세요.",
  PROVIDER_REJECTED:
    "요청한 내용은 이미지 생성 정책에 따라 처리할 수 없습니다.",
  PROVIDER_UNAVAILABLE:
    "이미지 생성 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요.",
  PROVIDER_RESPONSE_INVALID:
    "생성된 이미지를 안전하게 확인하지 못했습니다. 다시 시도해 주세요.",
  PROVIDER_TIMEOUT:
    "사진 생성 시간이 오래 걸려 중단되었습니다. 다시 시도해 주세요.",
  SEMANTIC_VALIDATION_FAILED:
    "원본 특징을 충분히 보존한 결과를 준비하지 못했습니다. 다른 원본 사진으로 다시 시도해 주세요.",
  SEMANTIC_VALIDATION_UNAVAILABLE:
    "생성 결과의 원본 충실도를 안전하게 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  POST_PROCESSING_FAILED:
    "생성된 이미지의 품질을 확인하지 못했습니다. 다시 시도해 주세요.",
  ASSET_STORAGE_FAILED:
    "완성된 사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  GENERATION_FAILED: "사진 생성에 실패했어요. 잠시 후 다시 시도해 주세요.",
};
