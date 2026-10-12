import { describe, expect, it } from "vitest";

import {
  generationFailureMessage,
  generationRetryPath,
  generationServiceName,
  generationStatusLabel,
  historyErrorMessage,
  summarizePrompt,
} from "./history";

describe("generation history presentation", () => {
  it("maps every durable state to a user-facing label", () => {
    expect(
      ["queued", "processing", "succeeded", "failed", "cancelled"].map(
        (status) =>
          generationStatusLabel(
            status as Parameters<typeof generationStatusLabel>[0],
          ),
      ),
    ).toEqual(["대기 중", "생성 중", "완료", "실패", "취소됨"]);
  });

  it("uses bounded failure messages without exposing raw errors", () => {
    expect(generationFailureMessage("PROVIDER_UNAVAILABLE")).toBe(
      "이미지 생성 서비스에 일시적인 문제가 발생했습니다.",
    );
    expect(generationFailureMessage("raw provider body")).toBe(
      "이미지를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("normalizes and bounds prompt summaries", () => {
    expect(summarizePrompt("  서울의\n\n밤거리  ")).toBe("서울의 밤거리");
    expect(summarizePrompt("가".repeat(100), 10)).toBe("가".repeat(9) + "…");
  });

  it("maps internal prompt ids to customer-facing services and retry routes", () => {
    expect(generationServiceName("id-photo.resume-id")).toBe("증명사진");
    expect(generationServiceName("business-profile")).toBe("비즈니스 프로필");
    expect(generationServiceName("profile-photo")).toBe("프로필 사진");
    expect(generationServiceName("underwater-correction")).toBe("물속 사진 보정");
    expect(generationServiceName("character-avatar")).toBe("캐릭터 프로필");
    expect(generationRetryPath("id-photo.resume-id")).toBe("/generate/id-photo");
    expect(generationRetryPath("underwater-correction")).toBe("/generate/underwater-correction");
    expect(generationRetryPath("character-avatar")).toBe("/generate/character-avatar");
    expect(generationRetryPath("unknown")).toBe("/generate");
  });

  it("maps URL error codes without reflecting arbitrary input", () => {
    expect(historyErrorMessage("download_unavailable")).toBe(
      "다운로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(historyErrorMessage("<script>alert(1)</script>")).toBe(
      "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
