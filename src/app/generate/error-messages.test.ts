import { describe, expect, it } from "vitest";

import { GENERATE_IMAGE_ERROR_MESSAGES } from "./error-messages";

describe("generate image error messages", () => {
  it.each([
    ["PROVIDER_INVALID_REQUEST", "이미지 생성 요청을 처리하지 못했습니다. 입력 파일 또는 요청 설정을 확인해 주세요."],
    ["PROVIDER_AUTHENTICATION_FAILED", "이미지 생성 서비스 인증 설정을 확인해 주세요."],
    ["PROVIDER_ACCESS_DENIED", "사진 생성 서비스를 잠시 이용할 수 없습니다. 이번 요청에는 Credit이 차감되지 않았어요. 잠시 후 다시 시도해 주세요."],
    ["PROVIDER_MODEL_NOT_FOUND", "요청한 이미지 모델을 찾을 수 없습니다. 모델 설정을 확인해 주세요."],
    ["PROVIDER_REJECTED", "요청한 내용은 이미지 생성 정책에 따라 처리할 수 없습니다."],
    ["PROVIDER_RATE_LIMITED", "현재 요청이 많아 잠시 후 다시 시도해 주세요."],
    ["PROVIDER_UNAVAILABLE", "이미지 생성 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요."],
  ] as const)("maps %s to a bounded Korean message", (code, message) => {
    expect(GENERATE_IMAGE_ERROR_MESSAGES[code]).toBe(message);
  });
});
