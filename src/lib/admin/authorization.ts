export const OPERATOR_CONSOLE_PERMISSION = "operator.read" as const;

type VerifiedUser = {
  id: string;
};

type OperatorAuthorizationGateway = {
  getVerifiedUser(): Promise<VerifiedUser | null>;
  hasPermission(permission: typeof OPERATOR_CONSOLE_PERMISSION): Promise<boolean>;
};

export type OperatorAuthorization =
  | { status: "authorized"; userId: string }
  | { status: "forbidden" }
  | { status: "unauthenticated" };

export async function authorizeOperator(
  gateway: OperatorAuthorizationGateway,
): Promise<OperatorAuthorization> {
  let user: VerifiedUser | null;
  try {
    user = await gateway.getVerifiedUser();
  } catch {
    return { status: "unauthenticated" };
  }

  if (!user) {
    return { status: "unauthenticated" };
  }

  try {
    if (!(await gateway.hasPermission(OPERATOR_CONSOLE_PERMISSION))) {
      return { status: "forbidden" };
    }
  } catch {
    return { status: "forbidden" };
  }

  return { status: "authorized", userId: user.id };
}
