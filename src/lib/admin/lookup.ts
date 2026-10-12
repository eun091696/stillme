const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OperatorLookupTarget =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "valid"; userId: string };

export type OperatorUserLookup = {
  display_name: string;
  joined_at: string;
  user_id: string;
};

export type OperatorCreditLookup = {
  available_balance: number;
  balance: number;
  refund_reserved_credits: number;
  reserved_credits: number;
};

export type OperatorPaymentLookup = {
  amount: number;
  created_at: string;
  credit_amount: number;
  currency: string;
  order_id: string;
  order_number: string;
  paid_at: string | null;
  product_code: string;
  status: string;
};

export type OperatorGenerationLookup = {
  aspect_ratio: string;
  attempt_count: number;
  created_at: string;
  generation_job_id: string;
  last_error_code: string | null;
  model_id: string;
  status: string;
  style: string;
  updated_at: string;
};

export type OperatorLookupResult = {
  credit: OperatorCreditLookup | null;
  generations: OperatorGenerationLookup[];
  payments: OperatorPaymentLookup[];
  user: OperatorUserLookup | null;
};

export type OperatorLookupState =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "denied" }
  | { status: "not_found" }
  | {
      status: "success";
      adjustmentIdempotencyKey: string;
      result: OperatorLookupResult;
    };

export const INITIAL_OPERATOR_LOOKUP_STATE: OperatorLookupState = {
  status: "empty",
};

type RawOperatorLookup = {
  credit: unknown;
  generations: unknown;
  payments: unknown;
  user: unknown;
};

type SanitizedOperatorLookup =
  | { status: "invalid" }
  | { status: "not_found" }
  | { result: OperatorLookupResult; status: "success" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function sanitizeUser(value: unknown): OperatorUserLookup | null | undefined {
  if (value === null) {
    return null;
  }
  if (
    !isRecord(value) ||
    !isString(value.user_id) ||
    !isString(value.display_name) ||
    !isString(value.joined_at)
  ) {
    return undefined;
  }
  return {
    display_name: value.display_name,
    joined_at: value.joined_at,
    user_id: value.user_id,
  };
}

function sanitizeCredit(
  value: unknown,
): OperatorCreditLookup | null | undefined {
  if (value === null) {
    return null;
  }
  if (
    !isRecord(value) ||
    !isSafeInteger(value.available_balance) ||
    !isSafeInteger(value.balance) ||
    !isSafeInteger(value.refund_reserved_credits) ||
    !isSafeInteger(value.reserved_credits)
  ) {
    return undefined;
  }
  return {
    available_balance: value.available_balance,
    balance: value.balance,
    refund_reserved_credits: value.refund_reserved_credits,
    reserved_credits: value.reserved_credits,
  };
}

function sanitizePayment(value: unknown): OperatorPaymentLookup | null {
  if (
    !isRecord(value) ||
    !isSafeInteger(value.amount) ||
    !isString(value.created_at) ||
    !isSafeInteger(value.credit_amount) ||
    !isString(value.currency) ||
    !isString(value.order_id) ||
    !isString(value.order_number) ||
    !isNullableString(value.paid_at) ||
    !isString(value.product_code) ||
    !isString(value.status)
  ) {
    return null;
  }
  return {
    amount: value.amount,
    created_at: value.created_at,
    credit_amount: value.credit_amount,
    currency: value.currency,
    order_id: value.order_id,
    order_number: value.order_number,
    paid_at: value.paid_at,
    product_code: value.product_code,
    status: value.status,
  };
}

function sanitizeGeneration(value: unknown): OperatorGenerationLookup | null {
  if (
    !isRecord(value) ||
    !isString(value.aspect_ratio) ||
    !isSafeInteger(value.attempt_count) ||
    !isString(value.created_at) ||
    !isString(value.generation_job_id) ||
    !isNullableString(value.last_error_code) ||
    !isString(value.model_id) ||
    !isString(value.status) ||
    !isString(value.style) ||
    !isString(value.updated_at)
  ) {
    return null;
  }
  return {
    aspect_ratio: value.aspect_ratio,
    attempt_count: value.attempt_count,
    created_at: value.created_at,
    generation_job_id: value.generation_job_id,
    last_error_code: value.last_error_code,
    model_id: value.model_id,
    status: value.status,
    style: value.style,
    updated_at: value.updated_at,
  };
}

export function sanitizeOperatorLookup(
  raw: RawOperatorLookup,
): SanitizedOperatorLookup {
  const user = sanitizeUser(raw.user);
  if (user === null) {
    return { status: "not_found" };
  }

  const credit = sanitizeCredit(raw.credit);
  if (
    user === undefined ||
    credit === undefined ||
    !Array.isArray(raw.payments) ||
    !Array.isArray(raw.generations)
  ) {
    return { status: "invalid" };
  }

  const payments = raw.payments.map(sanitizePayment);
  const generations = raw.generations.map(sanitizeGeneration);
  if (payments.includes(null) || generations.includes(null)) {
    return { status: "invalid" };
  }

  return {
    status: "success",
    result: {
      credit,
      generations: generations as OperatorGenerationLookup[],
      payments: payments as OperatorPaymentLookup[],
      user,
    },
  };
}

export function parseOperatorLookupTarget(
  value: string | string[] | undefined,
): OperatorLookupTarget {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === undefined || candidate.trim() === "") {
    return { status: "empty" };
  }

  const userId = candidate.trim();
  return UUID_PATTERN.test(userId)
    ? { status: "valid", userId: userId.toLowerCase() }
    : { status: "invalid" };
}

export function formatOperatorDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
