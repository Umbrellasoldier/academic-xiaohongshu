import "@/test/mocks/prisma";
import "@/test/mocks/auth";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";
import { GET, POST } from "@/app/api/posts/[id]/comments/route";

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

const params = Promise.resolve({ id: "post-1" });

describe("GET /api/posts/[id]/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticatedUser();
  });

  it("returns comments", async () => {
    const now = new Date("2026-01-01T00:00:00Z");

    prismaMock.comment.findMany.mockResolvedValue([
      {
        id: "comment-1",
        content: "Great post!",
        createdAt: now,
        parentId: null,
        author: {
          username: "alice",
          displayName: "Alice",
          avatar: "https://example.com/avatar.png",
          image: null,
        },
        _count: { likes: 3 },
        likes: [{ id: "cl-1" }],
        replies: [
          {
            id: "reply-1",
            content: "Thanks!",
            createdAt: now,
            parentId: "comment-1",
            author: {
              username: "bob",
              displayName: null,
              avatar: null,
              image: "https://example.com/bob.png",
            },
            _count: { likes: 1 },
            likes: [],
          },
        ],
      },
      {
        id: "comment-2",
        content: "Nice work",
        createdAt: now,
        parentId: null,
        author: {
          username: "charlie",
          displayName: "Charlie",
          avatar: null,
          image: null,
        },
        _count: { likes: 0 },
        likes: [],
        replies: [],
      },
    ]);

    prismaMock.comment.count.mockResolvedValue(2);

    const res = await GET(getReq("http://localhost/api/posts/post-1/comments") as any, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.comments).toHaveLength(2);
    expect(body.comments[0].id).toBe("comment-1");
    expect(body.comments[0].content).toBe("Great post!");
    expect(body.comments[1].id).toBe("comment-2");
  });

  it("returns empty comments", async () => {
    prismaMock.comment.findMany.mockResolvedValue([]);

    const res = await GET(getReq("http://localhost/api/posts/post-1/comments") as any, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.comments).toEqual([]);
    expect(body.total).toBe(0);
  });
});

describe("POST /api/posts/[id]/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticatedUser();
  });

  it("creates comment", async () => {
    const now = new Date("2026-01-15T10:00:00Z");

    // Post exists
    prismaMock.post.findUnique.mockResolvedValue({
      id: "post-1",
      authorId: "other",
      title: "Test Post",
    });

    // Comment created
    prismaMock.comment.create.mockResolvedValue({
      id: "comment-new",
      content: "Nice post",
      createdAt: now,
      parentId: null,
      author: {
        username: "testuser",
        displayName: "Test User",
        avatar: null,
        image: null,
      },
    });

    // Fire-and-forget notification
    prismaMock.notification.create.mockReturnValue({
      catch: () => {},
    } as any);

    const res = await POST(
      jsonReq("http://localhost/api/posts/post-1/comments", { content: "Nice post" }) as any,
      { params }
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.comment.id).toBe("comment-new");
    expect(body.comment.content).toBe("Nice post");
  });

  it("creates reply", async () => {
    const now = new Date("2026-01-15T10:00:00Z");

    // Post exists
    prismaMock.post.findUnique.mockResolvedValue({
      id: "post-1",
      authorId: "other",
      title: "Test Post",
    });

    // Parent comment exists and belongs to this post
    prismaMock.comment.findFirst.mockResolvedValue({
      id: "comment-1",
      authorId: "commenter-3",
    });

    // Reply created
    prismaMock.comment.create.mockResolvedValue({
      id: "reply-new",
      content: "Great point!",
      createdAt: now,
      parentId: "comment-1",
      author: {
        username: "testuser",
        displayName: "Test User",
        avatar: null,
        image: null,
      },
    });

    // Fire-and-forget notifications
    prismaMock.notification.create.mockReturnValue({
      catch: () => {},
    } as any);

    const res = await POST(
      jsonReq("http://localhost/api/posts/post-1/comments", {
        content: "Great point!",
        parentId: "comment-1",
      }) as any,
      { params }
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.comment.id).toBe("reply-new");
    expect(body.comment.parentId).toBe("comment-1");
  });

  it("returns 401 when not authenticated", async () => {
    clearMockSession();

    const res = await POST(
      jsonReq("http://localhost/api/posts/post-1/comments", { content: "Hello" }) as any,
      { params }
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty content", async () => {
    const res = await POST(
      jsonReq("http://localhost/api/posts/post-1/comments", { content: "" }) as any,
      { params }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when post not found", async () => {
    prismaMock.post.findUnique.mockResolvedValue(null);

    const res = await POST(
      jsonReq("http://localhost/api/posts/post-1/comments", { content: "Hello" }) as any,
      { params }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when parent comment not found", async () => {
    // Post exists
    prismaMock.post.findUnique.mockResolvedValue({
      id: "post-1",
      authorId: "other",
      title: "Test Post",
    });

    // Parent comment NOT found
    prismaMock.comment.findFirst.mockResolvedValue(null);

    const res = await POST(
      jsonReq("http://localhost/api/posts/post-1/comments", {
        content: "Reply",
        parentId: "nonexistent",
      }) as any,
      { params }
    );
    expect(res.status).toBe(404);
  });
});
