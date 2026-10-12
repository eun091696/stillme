"use client";

import { useState } from "react";

type CreditPurchaseButtonProps = {
  productCode: string;
};

type PaymentOrderResponse = {
  checkoutUrl?: unknown;
  orderId?: unknown;
};

export async function requestPaymentCheckout(
  productCode: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher("/api/payments/orders", {
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      productCode,
    }),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as PaymentOrderResponse | null;
  if (
    !response.ok ||
    typeof result?.orderId !== "string" ||
    typeof result.checkoutUrl !== "string"
  ) {
    throw new Error("PAYMENT_ORDER_FAILED");
  }
  return { checkoutUrl: result.checkoutUrl, orderId: result.orderId };
}

export function CreditPurchaseButton({ productCode }: CreditPurchaseButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function startPayment() {
    if (pending) return;
    setError(false);
    setPending(true);
    try {
      const checkout = await requestPaymentCheckout(productCode);
      window.sessionStorage.setItem("stillme.pendingPaymentOrder", checkout.orderId);
      window.location.assign(checkout.checkoutUrl);
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <div className="credit-purchase-action">
      <button disabled={pending} onClick={startPayment} type="button">
        {pending ? "결제창을 준비하고 있어요" : "구매하기"}
      </button>
      <p aria-live="polite" className="credit-purchase-error">
        {error ? "결제 주문을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." : ""}
      </p>
    </div>
  );
}
