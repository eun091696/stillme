import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { updateSession } from "@/lib/supabase/middleware";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error(
    "Start local Supabase and configure .env.local before integration tests.",
  );
}

describe("AUTH-001 and AUTH-002 local integration", () => {
  it("signs up, creates and updates a profile, logs out, and logs in", async () => {
    const supabase = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false },
    });
    const nonce = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const email = `codex-${nonce}@gmail.com`;
    const password = `Test-${crypto.randomUUID()}-9a`;

    const { data: signupData, error: signupError } =
      await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: "Integration User" } },
      });

    expect(signupError).toBeNull();
    expect(signupData.user?.email).toBe(email);
    expect(signupData.session).not.toBeNull();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .single();

    expect(profileError).toBeNull();
    expect(profile).toMatchObject({
      display_name: "Integration User",
      id: signupData.user?.id,
    });

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: "Updated Integration User" })
      .eq("id", signupData.user?.id);

    expect(updateError).toBeNull();

    const { error: logoutError } = await supabase.auth.signOut();
    expect(logoutError).toBeNull();
    expect((await supabase.auth.getSession()).data.session).toBeNull();

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({ email, password });

    expect(loginError).toBeNull();
    expect(loginData.user?.email).toBe(email);

    const nextPassword = `Next-${crypto.randomUUID()}-9a`;
    const { error: updatePasswordError } = await supabase.auth.updateUser({
      password: nextPassword,
    });
    expect(updatePasswordError).toBeNull();
    expect((await supabase.auth.signOut({ scope: "global" })).error).toBeNull();

    const { error: oldPasswordError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    expect(oldPasswordError).not.toBeNull();

    const { data: recoveredLogin, error: recoveredLoginError } =
      await supabase.auth.signInWithPassword({
        email,
        password: nextPassword,
      });
    expect(recoveredLoginError).toBeNull();
    expect(recoveredLogin.user?.email).toBe(email);
  });

  it("redirects an anonymous account request to login", async () => {
    const request = new NextRequest("http://localhost:3000/account");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Faccount",
    );
  });

  it("explains an expired Supabase session without exposing protected data", async () => {
    const request = new NextRequest("http://localhost:3000/account", {
      headers: { cookie: "sb-local-auth-token=expired" },
    });
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Faccount&reason=session_expired",
    );
  });
});
