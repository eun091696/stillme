import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "../site-header";
import { CreditPurchaseButton } from "./credit-purchase-button";
import { PaymentStatusPanel } from "./payment-status-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "STILLME | Credit 구매",
};

export const dynamic = "force-dynamic";

type Product = {
  code: string;
  display_name: string;
  amount: number;
  credit_amount: number;
  currency: string;
};

export default async function CreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/credits");
  }

  const [{ data: products }, { data: balance }] = await Promise.all([
    supabase
      .from("credit_products")
      .select("code, display_name, amount, credit_amount, currency")
      .eq("active", true)
      .order("amount", { ascending: true }),
    supabase
      .from("credit_balances")
      .select("available_balance")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="page-shell credits-shell" id="main-content" tabIndex={-1}>
        <section className="credits-card" aria-labelledby="credits-title">
          <header className="credits-heading">
            <div>
              <p className="eyebrow">CREDIT · PRICING</p>
              <h1 id="credits-title">필요한 만큼,<br />간결하게</h1>
              <p className="muted">
                현재 사용 가능 Credit: <strong>{Number(balance?.available_balance ?? 0)}</strong>
              </p>
            </div>
          </header>

          <p className="notice" role="status">
            신규 가입자는 사진 제작 2회에 해당하는 프로모션 Credit 2개를 한 번 받습니다.
            프로모션은 상품 가격 할인이나 쿠폰과 중복되지 않습니다.
            1 Credit으로 한 번의 사진 제작을 시작하고 후보 3장을 받습니다.
            결제 완료 후 Credit 반영까지 잠시 걸릴 수 있습니다.
          </p>
          <PaymentStatusPanel />

          <div className="credit-products">
            {(products as Product[] | null)?.map((product) => (
              <article className={`credit-product ${/standard/i.test(product.code) || /standard/i.test(product.display_name) ? "is-recommended" : ""}`} key={product.code}>
                {/standard/i.test(product.code) || /standard/i.test(product.display_name) ? <span className="recommended-label">RECOMMENDED</span> : null}
                <p className="eyebrow">{product.code}</p>
                <h2>{product.display_name}</h2>
                <strong className="credit-product-amount">
                  {product.credit_amount} <span>Credits</span>
                </strong>
                <p className="credit-product-price">
                  {new Intl.NumberFormat("ko-KR", {
                    style: "currency",
                    currency: product.currency,
                    maximumFractionDigits: 0,
                  }).format(product.amount)}
                </p>
                <p className="muted">
                  사진 제작 {product.credit_amount}회 · 제작당 후보 3장
                </p>
                <CreditPurchaseButton productCode={product.code} />
                <Link className="text-link" href="/refund-policy">
                  취소 및 환불 정책
                </Link>
              </article>
            ))}
          </div>

          <Link className="primary-link credits-back" href="/generate">
            이미지 생성으로 돌아가기
          </Link>
        </section>
      </main>
    </>
  );
}
