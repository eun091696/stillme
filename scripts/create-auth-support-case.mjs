import { parseArgs } from "node:util";
import { createAuthSupportRecord } from "./lib/auth-support.mjs";

function main() {
  const { values } = parseArgs({
    allowPositionals: false,
    options: {
      "case-id": { type: "string" },
      environment: { type: "string" },
      issue: { type: "string" },
      "observed-at": { type: "string" },
      "request-id": { type: "string" },
    },
    strict: true,
  });

  const record = createAuthSupportRecord({
    caseId: values["case-id"],
    environment: values.environment,
    issue: values.issue,
    observedAt: values["observed-at"],
    requestId: values["request-id"],
  });

  console.log(JSON.stringify(record, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Auth support case creation failed.");
  process.exitCode = 1;
}
