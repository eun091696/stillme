"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "stillme.pendingPaymentOrder";
const MAX_ATTEMPTS = 12;

export function PaymentStatusPanel() {
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const storedOrder = stored;
    setOrderId(storedOrder);
    let cancelled = false;
    let attempts = 0;
    async function check() {
      attempts += 1;
      setMessage("결제 확인 중입니다. 결제 webhook 반영을 기다리고 있어요.");
      try {
        const response = await fetch(
          `/api/payments/orders/${encodeURIComponent(storedOrder)}`,
          { cache: "no-store", credentials: "same-origin" },
        );
        const result = await response.json();
        if (cancelled) return;
        if (response.ok && result.status === "paid") {
          window.sessionStorage.removeItem(STORAGE_KEY);
          setMessage(`결제가 확인되었습니다. 사용 가능 Credit은 ${result.availableCredit}입니다.`);
          return;
        }
      } catch {
        // A finite retry below handles temporary network errors.
      }
      if (!cancelled && attempts < MAX_ATTEMPTS) {
        window.setTimeout(check, 2500);
      } else if (!cancelled) {
        setMessage("결제 확인에 시간이 걸리고 있습니다. 잠시 후 다시 확인해 주세요.");
      }
    }
    void check();
    return () => { cancelled = true; };
  }, []);

  if (!orderId) return null;
  return <p className="notice" role="status">{message}</p>;
}
