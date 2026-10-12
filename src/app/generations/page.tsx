import Link from "next/link";
import { redirect } from "next/navigation";

import {
  generationFailureMessage,
  generationRetryPath,
  generationServiceName,
  generationStatusLabel,
  historyErrorMessage,
} from "@/lib/generation/history";
import type { GenerationJobStatus } from "@/lib/generation/job-state";
import { createClient } from "@/lib/supabase/server";

import { SiteHeader } from "../site-header";
import { deleteGeneratedAsset } from "./actions";

export const metadata = {
  title: "STILLME | 사진 보관함",
};

export const dynamic = "force-dynamic";

type GenerationsPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

type AssetRow = {
  id: string;
  status: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  expires_at: string;
};

type GenerationRow = {
  id: string;
  prompt: string;
  style: string;
  aspect_ratio: string;
  status: GenerationJobStatus;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
  assets: AssetRow[] | null;
};

export default async function GenerationsPage({
  searchParams,
}: GenerationsPageProps) {
  const { error, message } = await searchParams;
  const errorMessage = historyErrorMessage(error);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/generations");
  }

  const { data, error: queryError } = await supabase
    .from("generation_jobs")
    .select(
      "id, prompt, style, aspect_ratio, status, last_error_code, created_at, updated_at, assets(id, status, mime_type, width, height, created_at, expires_at)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const generations = (data ?? []) as GenerationRow[];

  return (
    <>
      <SiteHeader />
      <main
        className="page-shell history-shell"
        id="main-content"
        tabIndex={-1}
      >
      <section className="history-card" aria-labelledby="history-title">
        <header className="history-heading">
          <div>
            <p className="eyebrow">MY ARCHIVE</p>
            <h1 id="history-title">사진 보관함</h1>
            <p className="muted">
              완성한 사진을 한곳에서 확인하고 내려받을 수 있어요.
            </p>
            <p className="muted">
              생성 이미지는 7일간 보관되며 이후 자동 삭제됩니다.
            </p>
          </div>
          <div className="history-actions">
            <Link className="primary-link" href="/generate">
              새 이미지 만들기
            </Link>
          </div>
        </header>

        {message === "generation_succeeded" ? (
          <p className="notice success" role="status">
            이미지 생성이 완료되었습니다.
          </p>
        ) : message === "asset_deleted" ? (
          <p className="notice success" role="status">
            이미지를 삭제했습니다.
          </p>
        ) : null}
        {errorMessage ? (
          <p className="notice error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {queryError ? (
          <p className="notice error" role="alert">
            생성 이력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : null}

        {!queryError && generations.length === 0 ? (
          <div className="history-empty">
            <h2>아직 생성한 이미지가 없습니다.</h2>
            <p className="muted">
              첫 이미지를 생성하면 결과를 여기에서 확인할 수 있습니다.
            </p>
            <Link className="primary-link" href="/generate">
              이미지 생성하기
            </Link>
          </div>
        ) : null}

        {generations.length > 0 ? (
          <ol className="generation-list" aria-label="최근 생성 이력">
            {generations.map((generation) => {
              const downloadService = generation.prompt.startsWith("id-photo")
                ? "id-photo"
                : generation.prompt.startsWith("business-profile")
                  ? "business-profile"
                  : "profile-photo";
              const assets = generation.assets?.filter(
                (candidate) =>
                  candidate.status === "available" &&
                  new Date(candidate.expires_at) > new Date(),
              ).sort((left, right) =>
                left.created_at.localeCompare(right.created_at),
              ).slice(0, 5) ?? [];
              const firstAsset = assets[0];
              const isCompactRecord =
                generation.status === "succeeded" && assets.length === 0;

              return (
                <li
                  className={`generation-item${isCompactRecord ? " generation-item-compact" : ""}`}
                  key={generation.id}
                >
                  <div className="generation-summary">
                    <span
                      className={`status-badge status-${generation.status}`}
                    >
                      {generationStatusLabel(generation.status)}
                    </span>
                    <time dateTime={generation.created_at}>
                      {new Intl.DateTimeFormat("ko-KR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(generation.created_at))}
                    </time>
                  </div>
                  <h2>{generationServiceName(generation.prompt)}</h2>
                  <p className="generation-meta">
                    {firstAsset?.width && firstAsset.height
                      ? `${firstAsset.width}×${firstAsset.height}`
                      : ""}
                    {assets.length > 0
                      ? `${firstAsset?.width && firstAsset.height ? " · " : ""}후보 ${assets.length}장`
                      : ""}
                  </p>

                  {generation.status === "failed" ? (
                    <div className="generation-failure" role="status">
                      <strong>생성 실패</strong>
                      <p>{generationFailureMessage(generation.last_error_code)}</p>
                      <Link className="secondary-link" href={generationRetryPath(generation.prompt)}>
                        다시 만들기
                      </Link>
                    </div>
                  ) : assets.length > 0 ? (
                    <div className="generation-gallery" aria-label="생성된 후보 이미지">
                      {assets.map((asset, index) => (
                        <figure key={asset.id}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={`${generationServiceName(generation.prompt)} 후보 ${index + 1}`}
                            decoding="async"
                            loading="lazy"
                            src={`/api/assets/${asset.id}/download?preview=1`}
                          />
                          <figcaption>완성 사진 {index + 1}</figcaption>
                          <a
                            className="secondary-link"
                            href={`/api/assets/${asset.id}/download?service=${downloadService}&candidate=${index + 1}`}
                          >
                            <span>사진 {index + 1} 다운로드</span>
                            <span aria-hidden="true">↧</span>
                          </a>
                          <form action={deleteGeneratedAsset}>
                            <input name="assetId" type="hidden" value={asset.id} />
                            <button className="secondary-link" type="submit">
                              이미지 삭제
                            </button>
                          </form>
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <p className="muted generation-state" role="status">
                      {generation.status === "queued" ||
                      generation.status === "processing"
                        ? "생성이 완료되면 다운로드할 수 있습니다."
                        : generation.status === "cancelled"
                          ? "취소된 생성 요청입니다."
                          : "사용 가능한 이미지가 없습니다."}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>
      </main>
    </>
  );
}
