import { describe, expect, it } from "vitest";

import {
  buildOriginalObjectKey,
  downloadNameForAsset,
  isOriginalObjectKey,
  mimeTypeForOriginalObjectKey,
} from "./object-key";

const ids = {
  userId: "11111111-1111-4111-8111-111111111111",
  jobId: "22222222-2222-4222-8222-222222222222",
  assetId: "33333333-3333-4333-8333-333333333333",
};

describe("generation object keys", () => {
  it("builds an immutable key from opaque server IDs", () => {
    const key = buildOriginalObjectKey({
      ...ids,
      mimeType: "image/png",
    });

    expect(key).toBe(
      "users/11111111-1111-4111-8111-111111111111/generation-jobs/22222222-2222-4222-8222-222222222222/assets/33333333-3333-4333-8333-333333333333/original.png",
    );
    expect(isOriginalObjectKey(key)).toBe(true);
  });

  it("maps JPEG and PNG MIME types to stable extensions and download names", () => {
    const jpegKey = buildOriginalObjectKey({ ...ids, mimeType: "image/jpeg" });
    const pngKey = buildOriginalObjectKey({ ...ids, mimeType: "image/png" });

    expect(jpegKey).toMatch(/original\.jpg$/u);
    expect(pngKey).toMatch(/original\.png$/u);
    expect(mimeTypeForOriginalObjectKey(jpegKey)).toBe("image/jpeg");
    expect(mimeTypeForOriginalObjectKey(pngKey)).toBe("image/png");
    expect(downloadNameForAsset(ids.assetId, "image/jpeg", {
      service: "id-photo",
      createdAt: "2026-08-31T03:06:04.000Z",
      candidateNumber: 2,
    })).toBe(
      "stillme-id-photo-20260831-120604-02.jpg",
    );
    expect(downloadNameForAsset(ids.assetId, "image/png", {
      service: "underwater-correction",
      createdAt: "2026-08-31T03:06:04.000Z",
    })).toBe("stillme-underwater-correction-20260831-120604-01.png");
    expect(downloadNameForAsset(ids.assetId, "image/webp", {
      service: "character-avatar",
      createdAt: "2026-08-31T03:06:04.000Z",
      candidateNumber: 5,
    })).toBe("stillme-character-avatar-20260831-120604-05.webp");
  });

  it("rejects non-v4, traversal, and user-controlled identifiers", () => {
    for (const userId of [
      "../private",
      "owner@example.test",
      "11111111-1111-1111-1111-111111111111",
    ]) {
      expect(() =>
        buildOriginalObjectKey({
          ...ids,
          userId,
          mimeType: "image/jpeg",
        }),
      ).toThrowError("Invalid userId");
    }
  });

  it("rejects malformed object keys", () => {
    expect(
      isOriginalObjectKey(
        `${buildOriginalObjectKey({
          ...ids,
          mimeType: "image/webp",
        })}/extra`,
      ),
    ).toBe(false);
    expect(isOriginalObjectKey("users/prompt/assets/image.png")).toBe(false);
  });
});
