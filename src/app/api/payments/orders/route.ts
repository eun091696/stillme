import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildGrobleCheckoutUrl,
  grobleProductConfiguration,
} from "@/lib/payments/groble";
import { readSameOriginJson } from "@/lib/security/request";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PRODUCT_CODES = new Set(["STARTER-3", "STANDARD-7", "PRO-16"]);

export async function POST(request: Request) {
  const parsed = await readSameOriginJson(request);
  if (!parsed.ok) {
    return Response.json(
      { code: "REQUEST_REJECTED" },
      { status: parsed.status },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = parsed.data;
  if (!body || typeof body !== "object") {
    return Response.json({ code: "ORDER_INVALID" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (
    typeof input.productCode !== "string" ||
    !PRODUCT_CODES.has(input.productCode) ||
    typeof input.idempotencyKey !== "string" ||
    !UUID_V4_PATTERN.test(input.idempotencyKey)
  ) {
    return Response.json({ code: "ORDER_INVALID" }, { status: 400 });
  }

  const product = grobleProductConfiguration(input.productCode);
  if (!product?.paymentUrl) {
    return Response.json({ code: "PAYMENT_NOT_CONFIGURED" }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_payment_order", {
    request_idempotency_key: input.idempotencyKey,
    target_product_code: input.productCode,
    target_user_id: user.id,
  });
  if (error || !Array.isArray(data) || !data[0]) {
    return Response.json({ code: "ORDER_CREATE_FAILED" }, { status: 409 });
  }
  const order = data[0] as Record<string, unknown>;
  if (typeof order.order_number !== "string") {
    return Response.json({ code: "ORDER_CREATE_FAILED" }, { status: 409 });
  }
  const checkoutUrl = buildGrobleCheckoutUrl(
    product.paymentUrl,
    order.order_number,
  );
  if (!checkoutUrl) {
    return Response.json({ code: "ORDER_CREATE_FAILED" }, { status: 409 });
  }
  return Response.json(
    {
      amount: order.amount,
      creditAmount: order.credit_amount,
      currency: order.currency,
      id: order.id,
      orderId: order.order_number,
      status: order.status,
      checkoutUrl,
    },
    { status: 201 },
  );
}
