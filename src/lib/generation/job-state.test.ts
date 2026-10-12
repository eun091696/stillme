import { describe, expect, it } from "vitest";

import {
  GenerationJobTransitionError,
  transitionGenerationJob,
  type GenerationJobState,
} from "./job-state";

const queued: GenerationJobState = {
  status: "queued",
  attemptCount: 0,
  maxAttempts: 3,
  retryable: false,
  nextAttemptAt: null,
};

describe("transitionGenerationJob", () => {
  it("moves a queued job through processing to success", () => {
    const processing = transitionGenerationJob(queued, { type: "START" });

    expect(processing).toEqual({
      status: "processing",
      attemptCount: 1,
      retryable: false,
      nextAttemptAt: null,
      lastErrorCode: null,
    });

    expect(
      transitionGenerationJob(
        { ...queued, ...processing },
        { type: "SUCCEED" },
      ),
    ).toEqual({
      status: "succeeded",
      attemptCount: 1,
      retryable: false,
      nextAttemptAt: null,
      lastErrorCode: null,
    });
  });

  it("schedules a bounded retry and preserves attempt identity", () => {
    const retryAt = new Date("2026-07-28T04:01:00.000Z");
    const failed = transitionGenerationJob(
      {
        ...queued,
        status: "processing",
        attemptCount: 1,
      },
      {
        type: "FAIL",
        errorCode: "PROVIDER_UNAVAILABLE",
        retryable: true,
        retryAt,
      },
    );

    expect(failed).toEqual({
      status: "failed",
      attemptCount: 1,
      retryable: true,
      nextAttemptAt: retryAt,
      lastErrorCode: "PROVIDER_UNAVAILABLE",
    });

    expect(() =>
      transitionGenerationJob(
        { ...queued, ...failed },
        { type: "RETRY" },
        new Date("2026-07-28T04:00:59.000Z"),
      ),
    ).toThrowError(
      new GenerationJobTransitionError("RETRY_NOT_READY"),
    );

    expect(
      transitionGenerationJob(
        { ...queued, ...failed },
        { type: "RETRY" },
        retryAt,
      ),
    ).toMatchObject({
      status: "queued",
      attemptCount: 1,
      retryable: false,
    });
  });

  it("stops retrying after the configured attempt limit", () => {
    expect(
      transitionGenerationJob(
        {
          status: "processing",
          attemptCount: 3,
          maxAttempts: 3,
          retryable: false,
          nextAttemptAt: null,
        },
        {
          type: "FAIL",
          errorCode: "PROVIDER_UNAVAILABLE",
          retryable: true,
        },
      ),
    ).toMatchObject({
      status: "failed",
      retryable: false,
      nextAttemptAt: null,
    });
  });

  it("allows cancellation only before a terminal success", () => {
    expect(transitionGenerationJob(queued, { type: "CANCEL" })).toMatchObject({
      status: "cancelled",
      attemptCount: 0,
    });

    expect(() =>
      transitionGenerationJob(
        { ...queued, status: "succeeded" },
        { type: "CANCEL" },
      ),
    ).toThrowError(
      new GenerationJobTransitionError("INVALID_TRANSITION"),
    );
  });

  it("rejects unsafe error codes and invalid transitions", () => {
    expect(() =>
      transitionGenerationJob(
        { ...queued, status: "processing", attemptCount: 1 },
        {
          type: "FAIL",
          errorCode: "provider body: private",
          retryable: false,
        },
      ),
    ).toThrowError(
      new GenerationJobTransitionError("INVALID_ERROR_CODE"),
    );

    expect(() =>
      transitionGenerationJob(queued, { type: "SUCCEED" }),
    ).toThrowError(
      new GenerationJobTransitionError("INVALID_TRANSITION"),
    );
  });
});
