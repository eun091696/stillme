"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeOperator } from "@/lib/admin/authorization";
import {
  validateCreditAdjustmentApproval,
  validateCreditAdjustmentRequest,
} from "@/lib/admin/corrective-action";
import {
  type OperatorLookupState,
  parseOperatorLookupTarget,
  sanitizeOperatorLookup,
} from "@/lib/admin/lookup";
import { createClient } from "@/lib/supabase/server";

function adminMessageUrl(
  type: "error" | "message",
  message: string,
) {
  const params = new URLSearchParams({ [type]: message });
  return `/admin?${params.toString()}`;
}

export async function lookupOperatorUser(
  _previousState: OperatorLookupState,
  formData: FormData,
): Promise<OperatorLookupState> {
  const target = parseOperatorLookupTarget(
    String(formData.get("userId") ?? ""),
  );
  if (target.status !== "valid") {
    return { status: "invalid" };
  }

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

  if (authorization.status !== "authorized") {
    return { status: "denied" };
  }

  const request = () => ({
    lookup_request_id: randomUUID(),
    target_user_id: target.userId,
  });
  const [user, credit, payments, generations] = await Promise.all([
    supabase.rpc("operator_lookup_user", request()),
    supabase.rpc("operator_lookup_credit", request()),
    supabase.rpc("operator_lookup_payments", request()),
    supabase.rpc("operator_lookup_generations", request()),
  ]);

  if (user.error || credit.error || payments.error || generations.error) {
    return { status: "denied" };
  }

  const sanitized = sanitizeOperatorLookup({
    user: user.data?.[0] ?? null,
    credit: credit.data?.[0] ?? null,
    payments: payments.data,
    generations: generations.data,
  });
  if (sanitized.status !== "success") {
    return sanitized.status === "not_found"
      ? { status: "not_found" }
      : { status: "denied" };
  }

  return {
    status: "success",
    adjustmentIdempotencyKey: randomUUID(),
    result: sanitized.result,
  };
}

export async function requestCreditAdjustment(formData: FormData) {
  const validation = validateCreditAdjustmentRequest(formData);
  if (!validation.ok) {
    redirect(
      adminMessageUrl(
        "error",
        "조정 요청 입력과 확인 항목을 다시 확인해 주세요.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "request_operator_credit_adjustment",
    {
      adjustment_amount: validation.data.amount,
      request_idempotency_key: validation.data.idempotencyKey,
      request_reason_code: validation.data.reason,
      support_case_reference: validation.data.caseReference,
      target_user_id: validation.data.targetUserId,
    },
  );

  if (error) {
    redirect(
      adminMessageUrl(
        "error",
        "Credit 조정 요청을 만들 수 없습니다. 권한, 잔액과 요청 정보를 확인해 주세요.",
      ),
    );
  }

  revalidatePath("/admin");
  redirect(
    adminMessageUrl(
      "message",
      "Credit 조정 요청을 만들었습니다. 다른 Admin의 승인이 필요합니다.",
    ),
  );
}

export async function approveCreditAdjustment(formData: FormData) {
  const requestId = validateCreditAdjustmentApproval(formData);
  if (!requestId) {
    redirect(
      adminMessageUrl(
        "error",
        "승인할 요청과 확인 항목을 다시 확인해 주세요.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "approve_operator_credit_adjustment",
    { target_request_id: requestId },
  );

  if (error) {
    redirect(
      adminMessageUrl(
        "error",
        "Credit 조정을 승인할 수 없습니다. 권한, 만료와 잔액을 확인해 주세요.",
      ),
    );
  }

  revalidatePath("/admin");
  redirect(
    adminMessageUrl(
      "message",
      "Credit 조정을 승인했고 불변 원장에 반영했습니다.",
    ),
  );
}
