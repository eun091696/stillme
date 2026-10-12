"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deleteStoredAsset } from "@/lib/storage/asset-deletion";
import { createClient } from "@/lib/supabase/server";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export async function deleteGeneratedAsset(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  if (!UUID_V4_PATTERN.test(assetId)) {
    redirect("/generations?error=asset_delete_failed");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/generations");

  let result: Awaited<ReturnType<typeof deleteStoredAsset>>;
  try {
    result = await deleteStoredAsset(assetId, user.id);
  } catch {
    redirect("/generations?error=asset_delete_failed");
  }
  if (result === "not_found") {
    redirect("/generations?error=asset_not_found");
  }

  revalidatePath("/account");
  revalidatePath("/generations");
  redirect("/generations?message=asset_deleted");
}
