import { AppHeader } from "@/app/app-header";
import { createClient } from "@/lib/supabase/server";

/** Keep navigation and the live, available Credit balance identical on every customer page. */
export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <AppHeader availableCredit={null} signedIn={false} />;

  const { data: credit, error } = await supabase
    .from("credit_balances")
    .select("available_balance")
    .eq("user_id", user.id)
    .maybeSingle();
  const value = error ? null : Number(credit?.available_balance ?? 0);
  const availableCredit = value !== null && Number.isFinite(value) ? value : null;

  return <AppHeader availableCredit={availableCredit} signedIn />;
}
