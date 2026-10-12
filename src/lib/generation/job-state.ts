export const GENERATION_JOB_STATUSES = [
  "queued",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number];

export type GenerationJobState = {
  status: GenerationJobStatus;
  attemptCount: number;
  maxAttempts: number;
  retryable: boolean;
  nextAttemptAt: Date | null;
};

export type GenerationJobEvent =
  | { type: "START" }
  | { type: "SUCCEED" }
  | {
      type: "FAIL";
      errorCode: string;
      retryable: boolean;
      retryAt?: Date;
    }
  | { type: "RETRY" }
  | { type: "CANCEL" };

export type GenerationJobTransition = {
  status: GenerationJobStatus;
  attemptCount: number;
  retryable: boolean;
  nextAttemptAt: Date | null;
  lastErrorCode: string | null;
};

export class GenerationJobTransitionError extends Error {
  constructor(
    readonly code:
      | "INVALID_TRANSITION"
      | "RETRY_NOT_READY"
      | "RETRY_EXHAUSTED"
      | "INVALID_ERROR_CODE",
  ) {
    super(code);
    this.name = "GenerationJobTransitionError";
  }
}

const ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/u;

export function transitionGenerationJob(
  state: GenerationJobState,
  event: GenerationJobEvent,
  now = new Date(),
): GenerationJobTransition {
  if (event.type === "START" && state.status === "queued") {
    if (state.attemptCount >= state.maxAttempts) {
      throw new GenerationJobTransitionError("RETRY_EXHAUSTED");
    }

    return {
      status: "processing",
      attemptCount: state.attemptCount + 1,
      retryable: false,
      nextAttemptAt: null,
      lastErrorCode: null,
    };
  }

  if (event.type === "SUCCEED" && state.status === "processing") {
    return {
      status: "succeeded",
      attemptCount: state.attemptCount,
      retryable: false,
      nextAttemptAt: null,
      lastErrorCode: null,
    };
  }

  if (event.type === "FAIL" && state.status === "processing") {
    if (!ERROR_CODE_PATTERN.test(event.errorCode)) {
      throw new GenerationJobTransitionError("INVALID_ERROR_CODE");
    }

    const retryable =
      event.retryable && state.attemptCount < state.maxAttempts;

    return {
      status: "failed",
      attemptCount: state.attemptCount,
      retryable,
      nextAttemptAt: retryable ? (event.retryAt ?? now) : null,
      lastErrorCode: event.errorCode,
    };
  }

  if (event.type === "RETRY" && state.status === "failed") {
    if (!state.retryable) {
      throw new GenerationJobTransitionError("INVALID_TRANSITION");
    }

    if (state.attemptCount >= state.maxAttempts) {
      throw new GenerationJobTransitionError("RETRY_EXHAUSTED");
    }

    if (state.nextAttemptAt && state.nextAttemptAt.getTime() > now.getTime()) {
      throw new GenerationJobTransitionError("RETRY_NOT_READY");
    }

    return {
      status: "queued",
      attemptCount: state.attemptCount,
      retryable: false,
      nextAttemptAt: null,
      lastErrorCode: null,
    };
  }

  if (
    event.type === "CANCEL" &&
    (state.status === "queued" || state.status === "failed")
  ) {
    return {
      status: "cancelled",
      attemptCount: state.attemptCount,
      retryable: false,
      nextAttemptAt: null,
      lastErrorCode: null,
    };
  }

  throw new GenerationJobTransitionError("INVALID_TRANSITION");
}
