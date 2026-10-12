"use client";

import { useActionState } from "react";

import {
  lookupOperatorUser,
  requestCreditAdjustment,
} from "@/app/admin/actions";
import { CREDIT_ADJUSTMENT_REASONS } from "@/lib/admin/corrective-action";
import {
  formatOperatorDate,
  INITIAL_OPERATOR_LOOKUP_STATE,
} from "@/lib/admin/lookup";

export function OperatorLookupPanel() {
  const [state, lookupAction, isPending] = useActionState(
    lookupOperatorUser,
    INITIAL_OPERATOR_LOOKUP_STATE,
  );

  const lookup = state.status === "success" ? state.result : null;

  return (
    <section className="admin-section" aria-labelledby="lookup-title">
      <div>
        <p className="eyebrow">CUSTOMER LOOKUP</p>
        <h2 id="lookup-title">사용자 운영 조회</h2>
        <p className="muted">
          지원 요청에 포함된 사용자 UUID로만 조회하며 식별자를 URL에 남기지
          않습니다. 모든 성공 조회는 domain별로 기록됩니다.
        </p>
      </div>

      <form action={lookupAction} className="admin-lookup-form">
        <label htmlFor="userId">사용자 UUID</label>
        <div>
          <input
            aria-describedby="userId-help"
            autoComplete="off"
            id="userId"
            name="userId"
            placeholder="00000000-0000-0000-0000-000000000000"
            required
            type="text"
          />
          <button disabled={isPending} type="submit">
            {isPending ? "조회 중…" : "조회"}
          </button>
        </div>
        <p className="field-help" id="userId-help">
          Email, 이름 또는 prompt 검색은 지원하지 않습니다.
        </p>
      </form>

      {state.status === "invalid" ? (
        <p className="notice error" role="alert">
          올바른 사용자 UUID를 입력해 주세요.
        </p>
      ) : null}
      {state.status === "denied" ? (
        <p className="notice error" role="alert">
          조회할 수 없습니다. 권한과 사용자 UUID를 확인해 주세요.
        </p>
      ) : null}
      {state.status === "not_found" ? (
        <p className="notice error" role="alert">
          사용자를 찾을 수 없습니다.
        </p>
      ) : null}

      {lookup?.user ? (
        <div className="admin-results">
          <section aria-labelledby="user-result-title">
            <h3 id="user-result-title">사용자</h3>
            <dl>
              <div>
                <dt>표시 이름</dt>
                <dd>{lookup.user.display_name}</dd>
              </div>
              <div>
                <dt>UUID</dt>
                <dd>{lookup.user.user_id}</dd>
              </div>
              <div>
                <dt>가입 시각</dt>
                <dd>{formatOperatorDate(lookup.user.joined_at)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="credit-result-title">
            <h3 id="credit-result-title">Credit</h3>
            {lookup.credit ? (
              <dl>
                <div>
                  <dt>원장 잔액</dt>
                  <dd>{lookup.credit.balance}</dd>
                </div>
                <div>
                  <dt>사용 가능</dt>
                  <dd>{lookup.credit.available_balance}</dd>
                </div>
                <div>
                  <dt>생성 예약</dt>
                  <dd>{lookup.credit.reserved_credits}</dd>
                </div>
                <div>
                  <dt>환불 예약</dt>
                  <dd>{lookup.credit.refund_reserved_credits}</dd>
                </div>
              </dl>
            ) : (
              <p className="muted">Credit account가 없습니다.</p>
            )}
          </section>

          <section aria-labelledby="payment-result-title">
            <h3 id="payment-result-title">최근 결제 주문</h3>
            {lookup.payments.length > 0 ? (
              <ul className="admin-result-list">
                {lookup.payments.map((payment) => (
                  <li key={payment.order_id}>
                    <strong>
                      {payment.amount.toLocaleString("ko-KR")}{" "}
                      {payment.currency}
                    </strong>
                    <span>
                      {payment.product_code} · {payment.status} ·{" "}
                      {payment.credit_amount} credits
                    </span>
                    <span>
                      {payment.order_number} ·{" "}
                      {formatOperatorDate(payment.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">결제 주문이 없습니다.</p>
            )}
          </section>

          <section aria-labelledby="generation-result-title">
            <h3 id="generation-result-title">최근 생성 작업</h3>
            {lookup.generations.length > 0 ? (
              <ul className="admin-result-list">
                {lookup.generations.map((generation) => (
                  <li key={generation.generation_job_id}>
                    <strong>{generation.status}</strong>
                    <span>
                      {generation.style} · {generation.aspect_ratio} ·{" "}
                      {generation.model_id}
                    </span>
                    <span>
                      시도 {generation.attempt_count}회 ·{" "}
                      {generation.last_error_code ?? "error 없음"} ·{" "}
                      {formatOperatorDate(generation.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">생성 작업이 없습니다.</p>
            )}
          </section>
        </div>
      ) : null}

      {lookup?.user && lookup.credit ? (
        <section
          className="admin-corrective-card"
          aria-labelledby="corrective-title"
        >
          <div>
            <p className="eyebrow">DUAL CONTROL</p>
            <h3 id="corrective-title">Credit 조정 요청</h3>
            <p className="muted">
              ±150 credits 이내에서 요청합니다. 승인되기 전에는 잔액이 바뀌지
              않습니다.
            </p>
          </div>
          <form
            action={requestCreditAdjustment}
            className="admin-corrective-form"
          >
            <input
              name="targetUserId"
              type="hidden"
              value={lookup.user.user_id}
            />
            <input
              name="idempotencyKey"
              type="hidden"
              value={
                state.status === "success"
                  ? state.adjustmentIdempotencyKey
                  : ""
              }
            />

            <label htmlFor="adjustmentAmount">조정 Credit</label>
            <input
              id="adjustmentAmount"
              inputMode="numeric"
              max="150"
              min="-150"
              name="amount"
              placeholder="예: 10 또는 -10"
              required
              step="1"
              type="number"
            />

            <label htmlFor="adjustmentReason">Reason code</label>
            <select id="adjustmentReason" name="reason" required>
              {CREDIT_ADJUSTMENT_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>

            <label htmlFor="caseReference">Support case reference</label>
            <input
              id="caseReference"
              maxLength={128}
              name="caseReference"
              pattern="[A-Z0-9][A-Z0-9._:-]{2,127}"
              placeholder="SUPPORT-2026-001"
              required
              type="text"
            />

            <label className="admin-confirmation">
              <input name="confirmed" required type="checkbox" value="yes" />
              대상, 수량, reason과 case reference를 확인했습니다.
            </label>
            <button type="submit">조정 요청</button>
          </form>
        </section>
      ) : null}
    </section>
  );
}
