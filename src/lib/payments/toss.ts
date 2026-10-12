const TOSS_API_URL = "https://api.tosspayments.com/v1";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 256 * 1024;

export type TossPaymentSnapshot = {
  approvedAt: string | null;
  balanceAmount: number;
  cancels: TossCancellationSnapshot[];
  currency: string;
  orderId: string;
  paymentKey: string;
  status: string;
  totalAmount: number;
};

export type TossCancellationSnapshot = {
  cancelAmount: number;
  canceledAt: string;
  cancelStatus: string;
  transactionKey: string;
};

type TossPaymentClientOptions = {
  fetch?: typeof globalThis.fetch;
  secretKey: string;
};

function parsePaymentSnapshot(value: unknown): TossPaymentSnapshot {
  if (!value || typeof value !== "object") {
    throw new Error("TOSS_RESPONSE_INVALID");
  }
  const payment = value as Record<string, unknown>;
  if (
    typeof payment.paymentKey !== "string" ||
    payment.paymentKey.length < 6 ||
    payment.paymentKey.length > 200 ||
    typeof payment.orderId !== "string" ||
    payment.orderId.length < 6 ||
    payment.orderId.length > 64 ||
    !Number.isSafeInteger(payment.totalAmount) ||
    Number(payment.totalAmount) < 1 ||
    typeof payment.currency !== "string" ||
    typeof payment.status !== "string" ||
    !/^[A-Z_]{1,32}$/u.test(payment.status) ||
    !/^[A-Z]{3,10}$/u.test(payment.currency) ||
    !Number.isSafeInteger(payment.balanceAmount) ||
    Number(payment.balanceAmount) < 0 ||
    (payment.cancels !== null && !Array.isArray(payment.cancels)) ||
    (payment.approvedAt !== null &&
      (typeof payment.approvedAt !== "string" ||
        payment.approvedAt.length > 64))
  ) {
    throw new Error("TOSS_RESPONSE_INVALID");
  }

  const cancels = (payment.cancels ?? []).map((value) => {
    if (!value || typeof value !== "object") {
      throw new Error("TOSS_RESPONSE_INVALID");
    }
    const cancellation = value as Record<string, unknown>;
    if (
      !Number.isSafeInteger(cancellation.cancelAmount) ||
      Number(cancellation.cancelAmount) < 1 ||
      typeof cancellation.canceledAt !== "string" ||
      cancellation.canceledAt.length > 64 ||
      typeof cancellation.cancelStatus !== "string" ||
      !/^[A-Z_]{1,32}$/u.test(cancellation.cancelStatus) ||
      typeof cancellation.transactionKey !== "string" ||
      cancellation.transactionKey.length < 1 ||
      cancellation.transactionKey.length > 64
    ) {
      throw new Error("TOSS_RESPONSE_INVALID");
    }
    return {
      cancelAmount: Number(cancellation.cancelAmount),
      canceledAt: cancellation.canceledAt,
      cancelStatus: cancellation.cancelStatus,
      transactionKey: cancellation.transactionKey,
    };
  });

  return {
    approvedAt: payment.approvedAt as string | null,
    balanceAmount: Number(payment.balanceAmount),
    cancels,
    currency: payment.currency,
    orderId: payment.orderId,
    paymentKey: payment.paymentKey,
    status: payment.status,
    totalAmount: Number(payment.totalAmount),
  };
}

export function createTossPaymentClient({
  fetch: request = globalThis.fetch,
  secretKey,
}: TossPaymentClientOptions) {
  if (!secretKey || secretKey.startsWith("replace-")) {
    throw new Error("TOSS_SECRET_KEY_MISSING");
  }

  const authorization = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;

  async function send(
    path: string,
    init: RequestInit,
  ): Promise<TossPaymentSnapshot> {
    let response: Response;
    try {
      response = await request(`${TOSS_API_URL}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: authorization,
          "Content-Type": "application/json",
          ...init.headers,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new Error("TOSS_NETWORK_ERROR");
    }

    const rawBody = await response.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_RESPONSE_BYTES) {
      throw new Error("TOSS_RESPONSE_INVALID");
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      body = null;
    }
    if (!response.ok) {
      const rawCode =
        body && typeof body === "object" && "code" in body ? body.code : null;
      const code =
        typeof rawCode === "string" && /^[A-Z0-9_]{1,64}$/u.test(rawCode)
          ? rawCode
          : "TOSS_REQUEST_FAILED";
      throw new Error(code);
    }
    return parsePaymentSnapshot(body);
  }

  return {
    confirm(input: {
      amount: number;
      idempotencyKey: string;
      orderId: string;
      paymentKey: string;
    }) {
      return send("/payments/confirm", {
        body: JSON.stringify({
          amount: input.amount,
          orderId: input.orderId,
          paymentKey: input.paymentKey,
        }),
        headers: { "Idempotency-Key": input.idempotencyKey },
        method: "POST",
      });
    },
    get(paymentKey: string) {
      return send(`/payments/${encodeURIComponent(paymentKey)}`, {
        method: "GET",
      });
    },
    getByOrderId(orderId: string) {
      return send(`/payments/orders/${encodeURIComponent(orderId)}`, {
        method: "GET",
      });
    },
    cancel(input: {
      amount: number;
      idempotencyKey: string;
      paymentKey: string;
      reason: string;
    }) {
      return send(`/payments/${encodeURIComponent(input.paymentKey)}/cancel`, {
        body: JSON.stringify({
          cancelAmount: input.amount,
          cancelReason: input.reason,
        }),
        headers: { "Idempotency-Key": input.idempotencyKey },
        method: "POST",
      });
    },
  };
}

export function createTossPaymentClientFromEnvironment() {
  return createTossPaymentClient({
    secretKey: process.env.TOSS_SECRET_KEY ?? "",
  });
}
