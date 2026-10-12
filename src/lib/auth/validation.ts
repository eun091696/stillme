export type AuthFields = {
  displayName?: string;
  email: string;
  password: string;
};

export type ValidationResult =
  | { data: AuthFields; ok: true }
  | { errors: string[]; ok: false };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(
  value: FormDataEntryValue | null,
): { email: string } | { error: string } {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: "유효한 이메일 주소를 입력해 주세요." };
  }

  return { email };
}

export function validateNewPassword(
  passwordValue: FormDataEntryValue | null,
  confirmationValue: FormDataEntryValue | null,
): { password: string } | { error: string } {
  const password = String(passwordValue ?? "");
  const confirmation = String(confirmationValue ?? "");

  if (password.length < 8 || password.length > 72) {
    return { error: "비밀번호는 8자 이상 72자 이하여야 합니다." };
  }

  if (password !== confirmation) {
    return { error: "비밀번호 확인이 일치하지 않습니다." };
  }

  return { password };
}

export function validateAuthFields(
  formData: FormData,
  options: {
    requireDisplayName?: boolean;
    requirePasswordConfirmation?: boolean;
  } = {},
): ValidationResult {
  const emailValidation = validateEmail(formData.get("email"));
  const email = "email" in emailValidation ? emailValidation.email : "";
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const errors: string[] = [];

  if ("error" in emailValidation) {
    errors.push(emailValidation.error);
  }

  if (password.length < 8 || password.length > 72) {
    errors.push("비밀번호는 8자 이상 72자 이하여야 합니다.");
  }

  if (
    options.requirePasswordConfirmation &&
    password !== String(formData.get("confirmPassword") ?? "")
  ) {
    errors.push("비밀번호 확인이 일치하지 않습니다.");
  }

  if (
    options.requireDisplayName &&
    (displayName.length < 1 || displayName.length > 80)
  ) {
    errors.push("이름은 1자 이상 80자 이하로 입력해 주세요.");
  }

  if (errors.length > 0) {
    return { errors, ok: false };
  }

  return {
    data: {
      ...(options.requireDisplayName ? { displayName } : {}),
      email,
      password,
    },
    ok: true,
  };
}

export function validateDisplayName(
  value: FormDataEntryValue | null,
): { displayName: string } | { error: string } {
  const displayName = String(value ?? "").trim();

  if (displayName.length < 1 || displayName.length > 80) {
    return { error: "이름은 1자 이상 80자 이하로 입력해 주세요." };
  }

  return { displayName };
}
