import Link from "next/link";
import { redirect } from "next/navigation";
import { updateProfile } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

import { SiteHeader } from "../site-header";
import { AccountManagement } from "./account-management";

export const metadata = {
  title: "STILLME | 내 계정",
};

export const dynamic = "force-dynamic";

type AccountPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

const CREDIT_TYPE_LABELS: Record<string, string> = {
  trial_grant: "체험 Credit",
  purchase_grant: "구매 Credit",
  promotion_grant: "프로모션 Credit",
  generation_consume: "이미지 생성",
  generation_restore: "생성 실패 복구",
  payment_refund_reversal: "결제 환불",
  expiration: "만료",
  manual_adjustment: "운영 조정",
};

export default async function AccountPage({
  searchParams,
}: AccountPageProps) {
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: profile, error: profileError },
    { data: credit },
    { data: ledger },
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single(),
      supabase
        .from("credit_balances")
        .select("balance, available_balance, reserved_credits")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("credit_ledger_entries")
        .select("id, transaction_type, amount, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
  const availableCredit = Number(credit?.available_balance ?? 0);
  const totalCredit = Number(credit?.balance ?? availableCredit);
  const reservedCredit = Number(credit?.reserved_credits ?? 0);
  const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
  });

  return (
    <>
      <SiteHeader />
      <main className="page-shell" id="main-content" tabIndex={-1}>
        <section
          className="profile-card account-profile-card"
          aria-labelledby="account-title"
        >
          <div className="profile-heading">
            <div>
              <p className="eyebrow">MY ACCOUNT</p>
              <h1 id="account-title">내 계정</h1>
            </div>
          </div>

          {message ? (
            <p className="notice success" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="notice error" role="alert">
              {error}
            </p>
          ) : null}
          {profileError ? (
            <p className="notice error" role="alert">
              프로필을 불러오지 못했습니다.
            </p>
          ) : null}

          <section className="account-section" aria-labelledby="profile-title">
            <div className="account-section-heading">
              <div>
                <p className="eyebrow">PROFILE</p>
                <h2 id="profile-title">프로필</h2>
              </div>
            </div>
            <dl className="profile-details">
              <div>
                <dt>이메일</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>계정 생성일</dt>
                <dd>{dateFormatter.format(new Date(user.created_at))}</dd>
              </div>
            </dl>
            <form action={updateProfile} className="auth-form profile-form">
              <label htmlFor="displayName">표시 이름</label>
              <input
                defaultValue={profile?.display_name ?? ""}
                id="displayName"
                maxLength={80}
                name="displayName"
                required
                type="text"
              />
              <button type="submit">변경사항 저장</button>
            </form>
          </section>

          <section
            className="account-section credit-panel"
            aria-labelledby="credit-title"
          >
            <div className="credit-panel-heading">
              <div>
                <p className="eyebrow">CREDIT BALANCE</p>
                <h2 id="credit-title">내 Credit</h2>
              </div>
              <strong>{totalCredit}</strong>
            </div>
            <dl className="credit-summary">
              <div>
                <dt>사용 가능 Credit</dt>
                <dd>{availableCredit}</dd>
              </div>
              <div>
                <dt>예약 중 Credit</dt>
                <dd>{reservedCredit}</dd>
              </div>
            </dl>
            <h3 className="credit-ledger-title">최근 이용 내역</h3>
            {ledger && ledger.length > 0 ? (
              <ul
                className="credit-ledger"
                aria-label="최근 Credit 이용 내역"
              >
                {ledger.map((entry) => (
                  <li key={entry.id}>
                    <span>
                      {CREDIT_TYPE_LABELS[entry.transaction_type] ??
                        "Credit 변동"}
                    </span>
                    <strong
                      className={
                        entry.amount > 0
                          ? "credit-positive"
                          : "credit-negative"
                      }
                    >
                      {entry.amount > 0 ? "+" : ""}
                      {entry.amount}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="account-empty-message">
                <strong>Credit 사용 내역이 없습니다.</strong>
                <p>
                  Credit을 구매하거나 사진을 생성하면 내역이 여기에
                  표시됩니다.
                </p>
              </div>
            )}
            <Link className="primary-link account-credit-link" href="/credits">
              Credit 구매하기
            </Link>
          </section>

          <section
            className="account-section account-management-section"
            aria-labelledby="account-management-title"
          >
            <div className="account-section-heading">
              <div>
                <p className="eyebrow">ACCOUNT</p>
                <h2 id="account-management-title">계정 관리</h2>
              </div>
            </div>
            <AccountManagement />
          </section>
        </section>
      </main>
    </>
  );
}
