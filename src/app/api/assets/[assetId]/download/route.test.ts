import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  readImage: vi.fn(),
  createDownloadUrl: vi.fn(),
  fetch: vi.fn(),
  gt: vi.fn(),
  usesLocalStorage: vi.fn(() => true),
}));

vi.mock("@/lib/generation/config", () => ({
  usesLocalGenerationStorage: mocks.usesLocalStorage,
}));

vi.mock("@/lib/storage/local", () => ({
  createLocalImageStorageFromEnvironment: () => ({
    readImage: mocks.readImage,
  }),
}));

vi.mock("@/lib/storage/r2", () => ({
  createR2StorageFromEnvironment: () => ({
    createDownloadUrl: mocks.createDownloadUrl,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      gt: mocks.gt,
      maybeSingle: mocks.maybeSingle,
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    mocks.gt.mockReturnValue(query);
    return {
      auth: { getUser: mocks.getUser },
      from: () => query,
    };
  },
}));

import { GET } from "./route";

const assetId = "33333333-3333-4333-8333-333333333333";
const key = [
  "users/11111111-1111-4111-8111-111111111111",
  "generation-jobs/22222222-2222-4222-8222-222222222222",
  `assets/${assetId}/original.png`,
].join("/");
const jpegKey = key.replace(/original\.png$/u, "original.jpg");

function request(preview = false) {
  return GET(new Request(
    `http://localhost/api/assets/${assetId}/download?service=id-photo&candidate=2${preview ? "&preview=1" : ""}`,
  ), {
    params: Promise.resolve({ assetId }),
  });
}

describe("local asset download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usesLocalStorage.mockReturnValue(true);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: assetId,
        mime_type: "image/png",
        status: "available",
        storage_key: key,
        byte_size: Buffer.byteLength("synthetic-image"),
        created_at: "2026-08-31T03:06:04.000Z",
      },
      error: null,
    });
    mocks.readImage.mockResolvedValue({
      body: Buffer.from("synthetic-image"),
      mimeType: "image/png",
    });
    mocks.createDownloadUrl.mockResolvedValue(
      "https://download.example.test/image",
    );
    mocks.fetch.mockResolvedValue(
      new Response(Buffer.from("synthetic-image"), {
        headers: { "Content-Type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("returns an authenticated owner asset without public caching", async () => {
    const response = await request();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="stillme-id-photo-20260831-120604-02.png"',
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      "synthetic-image",
    );
  });

  it("downloads a local JPEG with matching MIME and .jpg filename", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        id: assetId,
        mime_type: "image/jpeg",
        status: "available",
        storage_key: jpegKey,
        byte_size: Buffer.byteLength("synthetic-jpeg"),
        created_at: "2026-08-31T03:06:04.000Z",
      },
      error: null,
    });
    mocks.readImage.mockResolvedValueOnce({
      body: Buffer.from("synthetic-jpeg"),
      mimeType: "image/jpeg",
    });

    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="stillme-id-photo-20260831-120604-02.jpg"',
    );
  });

  it("serves an authenticated owner preview inline without public caching", async () => {
    const response = await request(true);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="stillme-id-photo-20260831-120604-02.png"`,
    );
  });

  it("denies anonymous and unavailable requests", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    await expect(request()).resolves.toMatchObject({ status: 401 });

    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(request()).resolves.toMatchObject({ status: 404 });

  });

  it("requires the asset expiry to be in the future", async () => {
    await request();

    expect(mocks.gt).toHaveBeenCalledWith(
      "expires_at",
      expect.any(String),
    );
  });

  it("redirects an R2-backed owner asset to a bounded signed URL", async () => {
    mocks.usesLocalStorage.mockReturnValueOnce(false);

    const response = await request();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://download.example.test/image",
    );
    expect(mocks.createDownloadUrl).toHaveBeenCalledWith({
      key,
      downloadName: "stillme-id-photo-20260831-120604-02.png",
      expiresIn: 600,
    });
  });

  it("uses the JPEG object key and filename for an R2 signed download", async () => {
    mocks.usesLocalStorage.mockReturnValueOnce(false);
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        id: assetId,
        mime_type: "image/jpeg",
        status: "available",
        storage_key: jpegKey,
        byte_size: Buffer.byteLength("synthetic-jpeg"),
        created_at: "2026-08-31T03:06:04.000Z",
      },
      error: null,
    });

    await request();
    expect(mocks.createDownloadUrl).toHaveBeenCalledWith({
      key: jpegKey,
      downloadName: "stillme-id-photo-20260831-120604-02.jpg",
      expiresIn: 600,
    });
  });

  it("uses an inline bounded signed URL for an R2 preview", async () => {
    mocks.usesLocalStorage.mockReturnValueOnce(false);

    const response = await request(true);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(mocks.createDownloadUrl).toHaveBeenCalledWith({
      key,
      downloadName: "stillme-id-photo-20260831-120604-02.png",
      expiresIn: 600,
      disposition: "inline",
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://download.example.test/image",
      {
        cache: "no-store",
        headers: { Accept: "image/png" },
      },
    );
  });

  it("returns to history with a bounded error when the local file is gone", async () => {
    mocks.readImage.mockRejectedValueOnce(new Error("missing"));

    const response = await request();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/generations?error=download_unavailable",
    );
  });
});
