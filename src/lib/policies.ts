export const REQUIRED_POLICY_VERSION = "2026-08-25";
export const REQUIRED_POLICY_TYPES = ["terms", "privacy"] as const;

export function acceptedRequiredPolicies(formData: FormData) {
  return (
    formData.get("termsAccepted") === "on" &&
    formData.get("privacyAccepted") === "on"
  );
}
