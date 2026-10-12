import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { approveCreditAdjustment } from "@/app/admin/actions";
import { OperatorLookupPanel } from "@/app/admin/operator-lookup-panel";
import { logout } from "@/app/auth/actions";
import {
  authorizeOperator,
  OPERATOR_CONSOLE_PERMISSION,
} from "@/lib/admin/authorization";
import { formatOperatorDate } from "@/lib/admin/lookup";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "STILLME | 운영 콘솔",
};

type AdminPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

type CreditAdjustmentRequest = {
  adjustment_amount: number;
  applied_at: string | null;
  expires_at: string;
  reason_code: string;
  request_id: string;
  requested_at: string;
  requested_by: string;
  status: "applied" | "pending";
  support_case_reference: string;
  target_user_id: string;
};

type CreditAdjustmentQueue = {
  canApprove: boolean;
  requests: CreditAdjustmentRequest[];
};

async function listCreditAdjustments(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CreditAdjustmentQueue> {
  const [listing, permission] = await Promise.all([
    supabase.rpc("operator_list_credit_adjustments"),
    supabase.rpc("operator_has_permission", {
      required_permission: "credit.adjust.approve",
    }),
  ]);

  return {
    canApprove: permission.error === null && permission.data === true,
    requests:
      listing.error === null
        ? ((listing.data as CreditAdjustmentRequest[] | null) ?? [])
        : [],
  };
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = await createClient();
  const authorization = await authorizeOperator({
    async getVerifiedUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user ? { id: user.id } : null;
    },
    async hasPermission(permission) {
      const { data, error } = await supabase.rpc("operator_has_permission", {
        required_permission: permission,
      });
      return error === null && data === true;
    },
  });

  if (authorization.status === "unauthenticated") {
    redirect("/login?next=/admin");
  }
  if (authorization.status === "forbidden") {
    notFound();
  }

  const params = await searchParams;
  const adjustmentQueue = await listCreditAdjustments(supabase);

  return (
    <main
      className="page-shell admin-shell"
      id="main-content"
      tabIndex={-1}
    >
      <section className="admin-card" aria-labelledby="admin-title">
        <header className="admin-heading">
          <div>
            <p className="eyebrow">PROTECTED OPERATIONS</p>
            <h1 id="admin-title">운영 콘솔</h1>
            <p className="muted">
              승인된 운영 작업을 최소 권한과 audit 경계 안에서 수행합니다.
            </p>
          </div>
          <div className="admin-actions">
            <Link className="secondary-link" href="/account">
              내 계정
            </Link>
            <form action={logout}>
              <button className="secondary-button" type="submit">
                로그아웃
              </button>
            </form>
          </div>
        </header>

        <div className="admin-security-status" role="status">
          <span aria-hidden="true">●</span>
          MFA와 <code>{OPERATOR_CONSOLE_PERMISSION}</code> 권한이 확인됐습니다.
        </div>

        {params.message ? (
          <p className="notice success" role="status">
            {params.message}
          </p>
        ) : null}
        {params.error ? (
          <p className="notice error" role="alert">
            {params.error}
          </p>
        ) : null}

        <OperatorLookupPanel />

        <section className="admin-section" aria-labelledby="adjustments-title">
          <div>
            <p className="eyebrow">CORRECTIVE ACTIONS</p>
            <h2 id="adjustments-title">최근 Credit 조정 요청</h2>
            <p className="muted">
              Support는 자신의 요청을 추적하고, Admin은 독립된 요청만 승인할
              수 있습니다.
            </p>
          </div>

          {adjustmentQueue.requests.length === 0 ? (
            <p className="muted">표시할 조정 요청이 없습니다.</p>
          ) : (
            <ul className="admin-adjustment-list">
              {adjustmentQueue.requests.map((request) => {
                const expired = new Date(request.expires_at) <= new Date();
                const canApprove =
                  adjustmentQueue.canApprove &&
                  request.status === "pending" &&
                  !expired &&
                  request.requested_by !== authorization.userId &&
                  request.target_user_id !== authorization.userId;

                return (
                  <li key={request.request_id}>
                    <div className="admin-adjustment-summary">
                      <strong>
                        {request.adjustment_amount > 0 ? "+" : ""}
                        {request.adjustment_amount} credits
                      </strong>
                      <span
                        className={`status-badge status-${
                          request.status === "applied"
                            ? "succeeded"
                            : expired
                              ? "failed"
                              : "queued"
                        }`}
                      >
                        {request.status === "applied"
                          ? "적용됨"
                          : expired
                            ? "만료됨"
                            : "승인 대기"}
                      </span>
                    </div>
                    <dl>
                      <div>
                        <dt>대상</dt>
                        <dd>{request.target_user_id}</dd>
                      </div>
                      <div>
                        <dt>Reason</dt>
                        <dd>{request.reason_code}</dd>
                      </div>
                      <div>
                        <dt>Case</dt>
                        <dd>{request.support_case_reference}</dd>
                      </div>
                      <div>
                        <dt>요청 시각</dt>
                        <dd>{formatOperatorDate(request.requested_at)}</dd>
                      </div>
                    </dl>
                    {canApprove ? (
                      <form
                        action={approveCreditAdjustment}
                        className="admin-approval-form"
                      >
                        <input
                          name="requestId"
                          type="hidden"
                          value={request.request_id}
                        />
                        <label className="admin-confirmation">
                          <input
                            name="confirmed"
                            required
                            type="checkbox"
                            value="yes"
                          />
                          대상, 수량, reason과 case를 독립적으로 검토했습니다.
                        </label>
                        <button type="submit">승인 및 원장 반영</button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="admin-boundary" aria-labelledby="boundary-title">
          <h2 id="boundary-title">운영 보안 경계</h2>
          <p>
            고객 email, 생성 prompt와 결제 key는 반환하지 않습니다. User,
            payment, credit, generation 조회 권한은 database에서 각각
            확인합니다. Credit 조정 rollback은 원 거래를 수정하지 않고 반대
            방향의 새 요청과 독립 승인으로 수행합니다.
          </p>
        </aside>
      </section>
    </main>
  );
}
