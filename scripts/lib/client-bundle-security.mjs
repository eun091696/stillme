export const CLIENT_BUNDLE_FORBIDDEN_MARKERS = Object.freeze([
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOSS_SECRET_KEY",
  "GOOGLE_AI_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "APS_CLIENT_BUNDLE_CANARY_",
]);

export function findClientBundleViolations(files) {
  const violations = [];

  for (const { content, file } of files) {
    for (const marker of CLIENT_BUNDLE_FORBIDDEN_MARKERS) {
      if (content.includes(marker)) {
        violations.push({ file, marker });
      }
    }
  }

  return violations;
}

export function assertClientBundleSafe(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("No client bundle files were provided");
  }

  const violations = findClientBundleViolations(files);
  if (violations.length > 0) {
    throw new Error(
      `Restricted server marker found in client bundle:\n${violations
        .map(({ file, marker }) => `${file}: ${marker}`)
        .join("\n")}`,
    );
  }
}
