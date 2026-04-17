import "@/test/mocks/prisma";
import "@/test/mocks/auth";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import {
  setAuthenticatedUser,
  clearMockSession,
} from "@/test/mocks/auth";
import { GET, DELETE } from "@/app/api/posts/[id]/route";

/** Helper to build a full mock post object returned by findUnique in GET */
function mockPostDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    title: "Test Post",
    content: "Test content body",
    summary: "A summary",
    coverImage: null,
    images: [],
    viewCount: 10,
    createdAt: new Date("2025-01-15T12:00:00Z"),
    aiSummary: null,
    aiTranslation: null,
    author: {
      id: "author-1",
      username: "author",
      displayName: "Author Name",
      avatar: null,
      image: "https://example.com/avatar.jpg",
    },
    subject: {
      name: "Computer Science",
      nameZh: "计算机科学",
      slug: "cs",
      color: "#3B82F6",
    },
    tags: [{ tag: { id: "tag-1", name: "AI" } }],
    citations: [],
    _count: {
      comments: 5,
      likes: 12,
      bookmarks: 3,
    },
    ...overrides,
  };
}

// ─── GET /api/posts/[id] ─────────────────────────────────────────────

describe("GET /api/posts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns post detail", async () => {
    const dbPost = mockPostDetail();
    prismaMock.post.findUnique.mockResolvedValue(dbPost);
    prismaMock.post.update.mockResolvedValue({});

    const req = new Request("http://localhost/api/posts/post-1");
    const res = await GET(req as any, {
      params: Promise.resolve({ id: "post-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.post.id).toBe("post-1");
    expect(data.post.title).toBe("Test Post");
    expect(data.post.author.username).toBe("author");
    expect(data.post.likeCount).toBe(12);
    expect(data.post.commentCount).toBe(5);
    expect(data.post.bookmarkCount).toBe(3);
  });

  it("returns 404 for nonexistent post", async () => {
    prismaMock.post.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/posts/nonexistent");
    const res = await GET(req as any, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("帖子不存在");
  });

  it("increments view count", async () => {
    const dbPost = mockPostDetail();
    prismaMock.post.findUnique.mockResolvedValue(dbPost);
    prismaMock.post.update.mockResolvedValue({});

    const req = new Request("http://localhost/api/posts/post-1");
    await GET(req as any, {
      params: Promise.resolve({ id: "post-1" }),
    });

    // viewCount increment was fired (fire-and-forget)
    expect(prismaMock.post.update).toHaveBeenCalledWith({
      where: { id: "post-1" },
      data: { viewCount: { increment: 1 } },
    });
  });

  it("returns 500 on DB error", async () => {
    prismaMock.post.findUnique.mockRejectedValue(new Error("DB down"));

    const req = new Request("http://localhost/api/posts/post-1");
    const res = await GET(req as any, {
      params: Promise.resolve({ id: "post-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取帖子详情失败");
  });
});

// ─── DELETE /api/posts/[id] ──────────────────────────────────────────

describe("DELETE /api/posts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("deletes post by author", async () => {
    setAuthenticatedUser({ id: "user-1" });

    prismaMock.post.findUnique.mockResolvedValue({
      authorId: "user-1",
    });
    prismaMock.post.delete.mockResolvedValue({});

    const req = new Request("http://localhost/api/posts/post-1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, {
      params: Promise.resolve({ id: "post-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe("帖子已删除");
    expect(prismaMock.post.delete).toHaveBeenCalledWith({
      where: { id: "post-1" },
    });
  });

  it("returns 401 when not authenticated", async () => {
    clearMockSession();

    const req = new Request("http://localhost/api/posts/post-1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, {
      params: Promise.resolve({ id: "post-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
    expect(prismaMock.post.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for nonexistent post", async () => {
    setAuthenticatedUser({ id: "user-1" });

    prismaMock.post.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/posts/nonexistent", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("帖子不存在");
    expect(prismaMock.post.delete).not.toHaveBeenCalled();
  });

  it("returns 403 when not the author", async () => {
    setAuthenticatedUser({ id: "user-1" });

    prismaMock.post.findUnique.mockResolvedValue({
      authorId: "other-user",
    });

    const req = new Request("http://localhost/api/posts/post-1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, {
      params: Promise.resolve({ id: "post-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("无权删除他人的帖子");
    expect(prismaMock.post.delete).not.toHaveBeenCalled();
  });

  it("returns 500 on DB error", async () => {
    setAuthenticatedUser({ id: "user-1" });

    prismaMock.post.findUnique.mockResolvedValue({
      authorId: "user-1",
    });
    prismaMock.post.delete.mockRejectedValue(new Error("DB down"));

    const req = new Request("http://localhost/api/posts/post-1", {
      method: "DELETE",
    });
    const res = await DELETE(req as any, {
      params: Promise.resolve({ id: "post-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("删除帖子失败");
  });
});
