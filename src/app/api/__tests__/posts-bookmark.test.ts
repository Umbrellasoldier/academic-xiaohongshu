import "@/test/mocks/prisma";
import "@/test/mocks/auth";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";
import { POST } from "@/app/api/posts/[id]/bookmark/route";

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(url: string) {
  return new Request(url);
}

function makeRequest() {
  return new Request("http://localhost/api/posts/post-1/bookmark", {
    method: "POST",
  });
}

const params = Promise.resolve({ id: "post-1" });

describe("POST /api/posts/[id]/bookmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticatedUser();
  });

  it("bookmarks a post", async () => {
    // No existing bookmark
    prismaMock.bookmark.findUnique.mockResolvedValue(null);

    // Create succeeds
    prismaMock.bookmark.create.mockResolvedValue({
      id: "bm-new",
      userId: "user-1",
      postId: "post-1",
    });

    // Updated bookmark count
    prismaMock.bookmark.count.mockResolvedValue(3);

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.bookmarked).toBe(true);
    expect(body.bookmarkCount).toBe(3);
  });

  it("removes bookmark", async () => {
    // Existing bookmark found
    prismaMock.bookmark.findUnique.mockResolvedValue({ id: "bm-1" });

    // Delete succeeds
    prismaMock.bookmark.delete.mockResolvedValue({ id: "bm-1" });

    // Updated bookmark count
    prismaMock.bookmark.count.mockResolvedValue(2);

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.bookmarked).toBe(false);
    expect(body.bookmarkCount).toBe(2);
  });

  it("returns 401 when not authenticated", async () => {
    clearMockSession();

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(401);
  });

  it("returns 500 on error", async () => {
    prismaMock.bookmark.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(500);
  });
});
