import { usesLocalGenerationStorage } from "@/lib/generation/config";
import { isGeneratedImageMimeType } from "@/lib/generation/model";
import { createLocalImageStorageFromEnvironment } from "@/lib/storage/local";
import {
  downloadNameForAsset,
  mimeTypeForOriginalObjectKey,
} from "@/lib/storage/object-key";
import { createR2StorageFromEnvironment } from "@/lib/storage/r2";
import { createClient } from "@/lib/supabase/server";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;

type DownloadRouteContext = {
  params: Promise<{ assetId: string }>;
};

export async function GET(request: Request, context: DownloadRouteContext) {
  const { assetId } = await context.params;
  const searchParams = new URL(request.url).searchParams;
  const preview = searchParams.get("preview") === "1";
  const service = searchParams.get("service") ?? undefined;
  const candidateNumber = Number(searchParams.get("candidate"));
  if (!UUID_V4_PATTERN.test(assetId)) {
    return Response.json({ code: "ASSET_INVALID" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { data: asset, error } = await supabase
    .from("assets")
    .select("id, storage_key, mime_type, status, byte_size, created_at")
    .eq("id", assetId)
    .eq("user_id", user.id)
    .eq("status", "available")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (
    error ||
    !asset ||
    asset.status !== "available" ||
    !isGeneratedImageMimeType(asset.mime_type) ||
    typeof asset.byte_size !== "number" ||
    asset.byte_size < 1 ||
    asset.byte_size > MAX_PREVIEW_BYTES ||
    typeof asset.storage_key !== "string" ||
    mimeTypeForOriginalObjectKey(asset.storage_key) !== asset.mime_type
  ) {
    return Response.json({ code: "ASSET_NOT_FOUND" }, { status: 404 });
  }

  try {
    const downloadName = downloadNameForAsset(asset.id, asset.mime_type, {
      service,
      createdAt: asset.created_at,
      candidateNumber,
    });
    if (usesLocalGenerationStorage()) {
      const storage = createLocalImageStorageFromEnvironment();
      const image = await storage.readImage({ key: asset.storage_key });
      if (
        image.mimeType !== asset.mime_type ||
        image.body.length !== asset.byte_size
      ) {
        throw new Error("Asset MIME mismatch");
      }
      return new Response(new Uint8Array(image.body), {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition":
            `${preview ? "inline" : "attachment"}; filename="${downloadName}"`,
          "Content-Length": String(image.body.length),
          "Content-Type": image.mimeType,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const storage = createR2StorageFromEnvironment();
    const downloadUrl = await storage.createDownloadUrl({
      key: asset.storage_key,
      downloadName,
      expiresIn: 10 * 60,
      ...(preview ? { disposition: "inline" as const } : {}),
    });
    if (preview) {
      const previewResponse = await fetch(downloadUrl, {
        cache: "no-store",
        headers: { Accept: asset.mime_type },
      });
      const body = await previewResponse.arrayBuffer();
      if (
        !previewResponse.ok ||
        previewResponse.headers.get("content-type") !== asset.mime_type ||
        body.byteLength !== asset.byte_size
      ) {
        throw new Error("Asset preview mismatch");
      }
      return new Response(body, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": `inline; filename="${downloadName}"`,
          "Content-Length": String(body.byteLength),
          "Content-Type": asset.mime_type,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return Response.redirect(downloadUrl, 303);
  } catch {
    if (preview) {
      return Response.json({ code: "PREVIEW_UNAVAILABLE" }, { status: 503 });
    }
    return Response.redirect(
      new URL("/generations?error=download_unavailable", request.url),
      303,
    );
  }
}
