import { GROBLE_SELLER_REFERENCE_PATTERN } from "@/lib/payments/groble";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;
  if (!GROBLE_SELLER_REFERENCE_PATTERN.test(orderNumber)) {
    return Response.json({ code: "ORDER_INVALID" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ code: "AUTH_REQUIRED" }, { status: 401 });

  const [{ data: order, error }, { data: balance }] = await Promise.all([
    supabase
      .from("payment_orders")
      .select("order_number, status, paid_at")
      .eq("order_number", orderNumber)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("credit_balances")
      .select("available_balance")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (error) return Response.json({ code: "ORDER_LOOKUP_FAILED" }, { status: 503 });
  if (!order) return Response.json({ code: "ORDER_NOT_FOUND" }, { status: 404 });
  return Response.json(
    {
      availableCredit: Number(balance?.available_balance ?? 0),
      orderId: order.order_number,
      paidAt: order.paid_at,
      status: order.status,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
