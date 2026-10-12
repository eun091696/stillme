"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  authEmailErrorMessage,
  isAuthEmailRateLimit,
} from "@/lib/auth/email-delivery";
import {
  AUTHENTICATED_HOME_PATH,
  safeAuthCallbackPath,
} from "@/lib/auth/redirect";
import {
  validateAuthFields,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
} from "@/lib/auth/validation";
import { socialAuthProvider } from "@/lib/auth/social";
import { socialProviderIsEnabled } from "@/lib/auth/social-readiness";
import {
  acceptedRequiredPolicies,
  REQUIRED_POLICY_VERSION,
} from "@/lib/policies";
import { applicationOrigin } from "@/lib/security/request";
import { deleteStoredAsset } from "@/lib/storage/asset-deletion";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function messageUrl(path: string, type: "error" | "message", message: string) {
  const params = new URLSearchParams({ [type]: message });
  return `${path}?${params.toString()}`;
}

function safeInternalPath(value: FormDataEntryValue | null) {
  return safeAuthCallbackPath(String(value ?? ""));
}

function appUrl() {
  const origin = applicationOrigin();

  if (!origin) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid application origin.");
  }

  return origin;
}

export async function login(formData: FormData) {
  const result = validateAuthFields(formData);

  if (!result.ok) {
    redirect(messageUrl("/login", "error", result.errors.join(" ")));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    redirect(
      messageUrl(
        "/login",
        "error",
        error.code === "email_not_confirmed"
          ? "이메일 인증 후 로그인해 주세요."
          : "이메일 또는 비밀번호를 확인해 주세요.",
      ),
    );
  }

  revalidatePath("/", "layout");
  redirect(safeInternalPath(formData.get("next")));
}

export async function loginWithSocialProvider(formData: FormData) {
  const provider = socialAuthProvider(formData.get("provider"));
  const next = safeInternalPath(formData.get("next"));

  if (!provider) {
    redirect(
      messageUrl("/login", "error", "지원하지 않는 로그인 방식입니다."),
    );
  }

  const providerEnabled = await socialProviderIsEnabled(provider);

  if (providerEnabled === false) {
    redirect(
      messageUrl(
        "/login",
        "error",
        "소셜 로그인 설정이 아직 완료되지 않았습니다. 관리자에게 문의해 주세요.",
      ),
    );
  }

  const callbackUrl = new URL("/auth/confirm", appUrl());
  callbackUrl.searchParams.set("next", next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl.toString(),
      ...(provider === "kakao"
        ? {
            queryParams: {
              scope: "account_email profile_nickname",
            },
          }
        : {}),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    redirect(
      messageUrl(
        "/login",
        "error",
        "소셜 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      ),
    );
  }

  redirect(data.url);
}

export async function signup(formData: FormData) {
  if (!acceptedRequiredPolicies(formData)) {
    redirect(
      messageUrl(
        "/signup",
        "error",
        "이용약관과 개인정보처리방침에 모두 동의해 주세요.",
      ),
    );
  }
  const result = validateAuthFields(formData, {
    requirePasswordConfirmation: true,
  });

  if (!result.ok) {
    redirect(messageUrl("/signup", "error", result.errors.join(" ")));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/confirm?next=${AUTHENTICATED_HOME_PATH}`,
    },
  });

  if (error) {
    redirect(
      messageUrl(
        "/signup",
        "error",
        isAuthEmailRateLimit(error)
          ? authEmailErrorMessage(error)
          : "가입 요청을 완료하지 못했습니다. 입력을 확인하거나 잠시 후 다시 시도해 주세요.",
      ),
    );
  }

  if (!data.user) {
    redirect(
      messageUrl(
        "/signup",
        "error",
        "가입 정보를 확인하지 못했습니다. 다시 시도해 주세요.",
      ),
    );
  }
  const admin = createAdminClient();
  const { error: consentError } = await admin.rpc(
    "record_required_policy_consents",
    {
      target_policy_version: REQUIRED_POLICY_VERSION,
      target_user_id: data.user.id,
    },
  );
  if (consentError) {
    redirect(
      messageUrl(
        "/signup",
        "error",
        "계정은 생성되었지만 정책 동의를 저장하지 못했습니다. 이메일 인증 후 로그인해 다시 동의해 주세요.",
      ),
    );
  }

  revalidatePath("/", "layout");

  if (data.session) {
    redirect(AUTHENTICATED_HOME_PATH);
  }

  redirect(
    messageUrl(
      "/verify-email",
      "message",
      "확인 이메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.",
    ),
  );
}

export async function acceptRequiredPolicies(formData: FormData) {
  if (!acceptedRequiredPolicies(formData)) {
    redirect(
      messageUrl(
        "/consent",
        "error",
        "이용약관과 개인정보처리방침에 모두 동의해 주세요.",
      ),
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_required_policy_consents", {
    target_policy_version: REQUIRED_POLICY_VERSION,
    target_user_id: user.id,
  });
  if (error) {
    redirect(
      messageUrl(
        "/consent",
        "error",
        "정책 동의를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      ),
    );
  }
  redirect(safeInternalPath(formData.get("next")));
}

export async function requestPasswordReset(formData: FormData) {
  const validation = validateEmail(formData.get("email"));

  if ("error" in validation) {
    redirect(messageUrl("/forgot-password", "error", validation.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    validation.email,
    {
      redirectTo: `${appUrl()}/auth/confirm?next=/reset-password`,
    },
  );

  if (error) {
    redirect(
      messageUrl(
        "/forgot-password",
        "error",
        authEmailErrorMessage(error),
      ),
    );
  }

  redirect(
    messageUrl(
      "/forgot-password",
      "message",
      "계정이 존재하면 비밀번호 재설정 이메일을 보냈습니다.",
    ),
  );
}

export async function resendSignupConfirmation(formData: FormData) {
  const validation = validateEmail(formData.get("email"));

  if ("error" in validation) {
    redirect(messageUrl("/verify-email", "error", validation.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    email: validation.email,
    options: {
      emailRedirectTo: `${appUrl()}/auth/confirm?next=${AUTHENTICATED_HOME_PATH}`,
    },
    type: "signup",
  });

  if (error) {
    redirect(
      messageUrl(
        "/verify-email",
        "error",
        authEmailErrorMessage(error),
      ),
    );
  }

  redirect(
    messageUrl(
      "/verify-email",
      "message",
      "계정이 확인 대기 중이면 인증 이메일을 다시 보냈습니다.",
    ),
  );
}

export async function updatePassword(formData: FormData) {
  const validation = validateNewPassword(
    formData.get("password"),
    formData.get("confirmPassword"),
  );

  if ("error" in validation) {
    redirect(messageUrl("/reset-password", "error", validation.error));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?reason=recovery_required");
  }

  const { error } = await supabase.auth.updateUser({
    password: validation.password,
  });

  if (error) {
    redirect(
      messageUrl(
        "/reset-password",
        "error",
        "비밀번호를 변경하지 못했습니다. 재설정 이메일을 다시 요청해 주세요.",
      ),
    );
  }

  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");
  redirect(
    messageUrl(
      "/login",
      "message",
      "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.",
    ),
  );
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect(
      messageUrl(
        "/account",
        "error",
        "로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      ),
    );
  }

  revalidatePath("/", "layout");
  redirect("/login");
}

export async function updateProfile(formData: FormData) {
  const validation = validateDisplayName(formData.get("displayName"));

  if ("error" in validation) {
    redirect(messageUrl("/account", "error", validation.error));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: validation.displayName })
    .eq("id", user.id);

  if (error) {
    redirect(
      messageUrl(
        "/account",
        "error",
        "프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      ),
    );
  }

  revalidatePath("/account");
  redirect(messageUrl("/account", "message", "프로필을 저장했습니다."));
}

export async function deleteAccount(formData: FormData) {
  if (String(formData.get("confirmation") ?? "").trim() !== "탈퇴") {
    redirect(
      messageUrl("/account", "error", "회원탈퇴 확인 문구를 입력해 주세요."),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const requestedAt = new Date().toISOString();
  const { error: blockError } = await admin
    .from("profiles")
    .update({ deletion_requested_at: requestedAt })
    .eq("id", user.id);
  if (blockError) {
    redirect(
      messageUrl(
        "/account",
        "error",
        "회원탈퇴를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      ),
    );
  }

  const { data: activeJobs, error: activeJobsError } = await admin
    .from("generation_jobs")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["queued", "processing"])
    .limit(1);
  if (activeJobsError || (activeJobs?.length ?? 0) > 0) {
    redirect(
      messageUrl(
        "/account",
        "error",
        activeJobsError
          ? "회원탈퇴 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."
          : "진행 중인 이미지 생성이 끝난 뒤 회원탈퇴를 다시 요청해 주세요.",
      ),
    );
  }

  const { data: assets, error: assetsError } = await admin
    .from("assets")
    .select("id")
    .eq("user_id", user.id)
    .neq("status", "deleted");
  if (assetsError) {
    redirect(
      messageUrl(
        "/account",
        "error",
        "저장된 이미지 목록을 확인하지 못했습니다. 다시 시도해 주세요.",
      ),
    );
  }

  try {
    for (const asset of assets ?? []) {
      await deleteStoredAsset(asset.id, user.id);
    }
  } catch {
    redirect(
      messageUrl(
        "/account",
        "error",
        "저장된 이미지를 정리하지 못했습니다. 다시 시도해 주세요.",
      ),
    );
  }

  const { count: remainingAssets, error: remainingAssetsError } = await admin
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "deleted");
  if (remainingAssetsError || (remainingAssets ?? 0) > 0) {
    redirect(
      messageUrl(
        "/account",
        "error",
        "이미지 정리가 아직 끝나지 않았습니다. 다시 시도해 주세요.",
      ),
    );
  }

  const { error: prepareDeletionError } = await admin.rpc(
    "prepare_account_deletion",
    { target_user_id: user.id },
  );
  if (prepareDeletionError) {
    redirect(
      messageUrl(
        "/account",
        "error",
        "거래 기록을 안전하게 분리하지 못했습니다. 다시 시도해 주세요.",
      ),
    );
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    redirect(
      messageUrl(
        "/account",
        "error",
        "이미지는 삭제했지만 계정 삭제를 완료하지 못했습니다. 다시 시도해 주세요.",
      ),
    );
  }

  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/");
}
