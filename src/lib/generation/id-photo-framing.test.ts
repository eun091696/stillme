import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { computeIdPhotoCrop, ID_FACE_HEIGHT_RATIO, ID_FACE_TOP_RATIO, ID_MAX_ZOOM } from "./id-photo-framing";

describe("computeIdPhotoCrop", () => {
  it("zooms a small face in to the target size and position, keeping 3:4", () => {
    // This fixture must reach the target without exceeding the 1.5x zoom cap.
    const crop = computeIdPhotoCrop({ left: 0.4, top: 0.2, width: 0.2, height: 0.4 }, 900, 1200)!;
    expect(crop.height).toBeCloseTo((0.4 * 1200) / ID_FACE_HEIGHT_RATIO, -1);
    expect(crop.width / crop.height).toBeCloseTo(0.75, 2);
    expect((0.2 * 1200 - crop.top) / crop.height).toBeCloseTo(ID_FACE_TOP_RATIO, 1);
    expect(crop.left + crop.width / 2).toBeCloseTo(450, -1);
  });

  it("leaves a face that is already at or above the target size unchanged", () => {
    expect(computeIdPhotoCrop({ left: 0.25, top: 0.08, width: 0.5, height: 0.6 }, 900, 1200)).toBeNull();
  });

  it("caps zoom and keeps the crop inside the image", () => {
    const crop = computeIdPhotoCrop({ left: 0.02, top: 0.02, width: 0.1, height: 0.1 }, 900, 1200)!;
    expect(crop.height).toBe(Math.round(1200 / ID_MAX_ZOOM));
    expect(crop.left).toBeGreaterThanOrEqual(0);
    expect(crop.top).toBeGreaterThanOrEqual(0);
  });

  it("preserves the zoom cap when the tighter face target requires too much enlargement", () => {
    const crop = computeIdPhotoCrop({ left: 0.4, top: 0.2, width: 0.2, height: 0.3 }, 900, 1200)!;
    expect(crop.height).toBe(Math.round(1200 / ID_MAX_ZOOM));
    expect(crop.width / crop.height).toBeCloseTo(0.75, 2);
    expect((0.3 * 1200) / crop.height).toBeLessThan(ID_FACE_HEIGHT_RATIO);
    expect((0.2 * 1200 - crop.top) / crop.height).toBeCloseTo(ID_FACE_TOP_RATIO, 2);
  });

  it("rejects invalid boxes", () => {
    expect(computeIdPhotoCrop({ left: Number.NaN, top: 0, width: 0.1, height: 0.1 }, 900, 1200)).toBeNull();
  });
});
