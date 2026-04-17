import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/test/mocks/prisma";
import "@/test/mocks/auth";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";

import { POST } from "@/app/api/posts/[id]/comments/[commentId]/like/route";

function jsonReq(url: string) {
  return new Request(url, { method: "POST" });
}

describe("POST /api/posts/[id]/comments/[commentId]/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticatedUser();
  });

  it("likes a comment", async () => {
    prismaMock.comment.findFirst.mockResolvedValue({
      id: "comment-1",
      authorId: "other-user",
    });
    prismaMock.commentLike.findUnique.mockResolvedValue(null);
    prismaMock.commentLike.create.mockResolvedValue({});
    prismaMock.commentLike.count.mockResolvedValue(3);

    const req = jsonReq("http://localhost/api/posts/post-1/comments/comment-1/like");
    const res = await POST(req as any, {
      params: Promise.resolve({ id: "post-1", commentId: "comment-1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.liked).toBe(true);
    expect(data.likeCount).toBe(3);
    expect(data.commentId).toBe("comment-1");
  });

  it("unlikes a comment", async () => {
    prismaMock.comment.findFirst.mockResolvedValue({
      id: "comment-1",
      authorId: "other-user",
    });
    prismaMock.commentLike.findUnique.mockResolvedValue({ id: "cl-1" });
    prismaMock.commentLike.delete.mockResolvedValue({});
    prismaMock.commentLike.count.mockResolvedValue(2);

    const req = jsonReq("http://localhost/api/posts/post-1/comments/comment-1/like");
    const res = await POST(req as any, {
      params: Promise.resolve({ id: "post-1", commentId: "comment-1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.liked).toBe(false);
    expect(data.likeCount).toBe(2);
  });

  it("returns 401 when not authenticated", async () => {
    clearMockSession();

    const req = jsonReq("http://localhost/api/posts/post-1/comments/comment-1/like");
    const res = await POST(req as any, {
      params: Promise.resolve({ id: "post-1", commentId: "comment-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when comment not found", async () => {
    prismaMock.comment.findFirst.mockResolvedValue(null);

    const req = jsonReq("http://localhost/api/posts/post-1/comments/comment-1/like");
    const res = await POST(req as any, {
      params: Promise.resolve({ id: "post-1", commentId: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    prismaMock.comment.findFirst.mockRejectedValue(new Error("DB error"));

    const req = jsonReq("http://localhost/api/posts/post-1/comments/comment-1/like");
    const res = await POST(req as any, {
      params: Promise.resolve({ id: "post-1", commentId: "comment-1" }),
    });
    expect(res.status).toBe(500);
  });
});
