import "@/test/mocks/prisma";
import "@/test/mocks/auth";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import {
  setAuthenticatedUser,
  clearMockSession,
} from "@/test/mocks/auth";
import { GET, POST } from "@/app/api/posts/route";
import { NextRequest } from "next/server";

/** Helper to build a mock post row as returned by prisma.post.findMany */
function mockPostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    title: "Test Post",
    summary: "A short summary",
    coverImage: null,
    createdAt: new Date("2025-01-15T12:00:00Z"),
    viewCount: 42,
    author: {
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
    _count: {
      comments: 3,
      likes: 7,
    },
    ...overrides,
  };
}

function jsonReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(url: string) {
  return new NextRequest(url);
}

// ─── GET /api/posts ──────────────────────────────────────────────────

describe("GET /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns posts feed", async () => {
    const posts = [
      mockPostRow({ id: "post-1" }),
      mockPostRow({ id: "post-2", title: "Second Post" }),
    ];
    prismaMock.post.findMany.mockResolvedValue(posts);

    const res = await GET(getReq("http://localhost/api/posts"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.posts).toHaveLength(2);
    expect(data.posts[0].id).toBe("post-1");
    expect(data.posts[1].id).toBe("post-2");
  });

  it("returns empty feed", async () => {
    prismaMock.post.findMany.mockResolvedValue([]);

    const res = await GET(getReq("http://localhost/api/posts"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.posts).toEqual([]);
  });

  it("supports cursor pagination", async () => {
    prismaMock.post.findMany.mockResolvedValue([]);

    await GET(getReq("http://localhost/api/posts?cursor=post-5"));

    const callArgs = prismaMock.post.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual(
      expect.objectContaining({ id: { lt: "post-5" } })
    );
  });

  it("following feed requires auth", async () => {
    clearMockSession();

    const res = await GET(
      getReq("http://localhost/api/posts?feed=following")
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("following feed returns posts", async () => {
    setAuthenticatedUser({ id: "user-1" });

    prismaMock.follow.findMany.mockResolvedValue([
      { followingId: "u2" },
    ]);
    prismaMock.post.findMany.mockResolvedValue([
      mockPostRow({ id: "post-f1" }),
    ]);

    const res = await GET(
      getReq("http://localhost/api/posts?feed=following")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].id).toBe("post-f1");
  });

  it("returns 500 on DB error", async () => {
    prismaMock.post.findMany.mockRejectedValue(new Error("DB down"));

    const res = await GET(getReq("http://localhost/api/posts"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});

// ─── POST /api/posts ─────────────────────────────────────────────────

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  const validBody = {
    title: "My New Post",
    content: "<p>Hello world</p>",
    subjectId: "cs",
    summary: "A test post",
  };

  it("creates post successfully", async () => {
    setAuthenticatedUser({ id: "user-1" });

    prismaMock.subject.findUnique.mockResolvedValue({
      id: "subject-1",
      name: "Computer Science",
      nameZh: "计算机科学",
      slug: "cs",
      color: "#3B82F6",
    });

    const createdPost = {
      id: "new-post-1",
      title: "My New Post",
      summary: "A test post",
      coverImage: null,
      createdAt: new Date("2025-02-01T10:00:00Z"),
      subject: {
        name: "Computer Science",
        nameZh: "计算机科学",
        slug: "cs",
        color: "#3B82F6",
      },
      author: {
        username: "testuser",
        displayName: "Test User",
        avatar: null,
        image: null,
      },
    };
    prismaMock.post.create.mockResolvedValue(createdPost);

    const res = await POST(
      jsonReq("http://localhost/api/posts", validBody)
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.post.id).toBe("new-post-1");
    expect(data.post.title).toBe("My New Post");

    // Verify subject was resolved by slug
    expect(prismaMock.subject.findUnique).toHaveBeenCalledWith({
      where: { slug: "cs" },
      select: {
        id: true,
        name: true,
        nameZh: true,
        slug: true,
        color: true,
      },
    });

    // Verify post.create was called with authorId
    expect(prismaMock.post.create).toHaveBeenCalledTimes(1);
    const createCall = prismaMock.post.create.mock.calls[0][0];
    expect(createCall.data.authorId).toBe("user-1");
    expect(createCall.data.title).toBe("My New Post");
    expect(createCall.data.subjectId).toBe("subject-1");
  });

  it("returns 401 when not authenticated", async () => {
    clearMockSession();

    const res = await POST(
      jsonReq("http://localhost/api/posts", validBody)
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
    expect(prismaMock.post.create).not.toHaveBeenCalled();
  });

  it("returns 400 for empty title", async () => {
    setAuthenticatedUser({ id: "user-1" });

    const res = await POST(
      jsonReq("http://localhost/api/posts", { ...validBody, title: "" })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("标题不能为空");
  });

  it("returns 400 for missing subjectId", async () => {
    setAuthenticatedUser({ id: "user-1" });

    const { subjectId, ...bodyWithoutSubject } = validBody;
    const res = await POST(
      jsonReq("http://localhost/api/posts", bodyWithoutSubject)
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("请选择学科分类");
  });

  it("returns 400 when subject not found", async () => {
    setAuthenticatedUser({ id: "user-1" });

    prismaMock.subject.findUnique.mockResolvedValue(null);

    const res = await POST(
      jsonReq("http://localhost/api/posts", {
        ...validBody,
        subjectId: "nonexistent",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("学科分类不存在");
    expect(prismaMock.post.create).not.toHaveBeenCalled();
  });
});
