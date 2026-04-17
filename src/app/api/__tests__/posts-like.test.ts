import "@/test/mocks/prisma";
import "@/test/mocks/auth";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";
import { POST } from "@/app/api/posts/[id]/like/route";

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
  return new Request("http://localhost/api/posts/post-1/like", {
    method: "POST",
  });
}

const params = Promise.resolve({ id: "post-1" });

describe("POST /api/posts/[id]/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticatedUser();
  });

  it("likes a post (new like)", async () => {
    // No existing like
    prismaMock.like.findUnique.mockResolvedValue(null);

    // Create succeeds
    prismaMock.like.create.mockResolvedValue({
      id: "like-new",
      userId: "user-1",
      postId: "post-1",
    });

    // Post for notification
    prismaMock.post.findUnique.mockResolvedValue({
      authorId: "other-user",
      title: "Test Post",
    });

    // Actor for notification
    prismaMock.user.findUnique.mockResolvedValue({
      displayName: "Test User",
      username: "testuser",
    });

    // Fire-and-forget notification
    prismaMock.notification.create.mockReturnValue({
      catch: () => {},
    } as any);

    // Updated like count
    prismaMock.like.count.mockResolvedValue(5);

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.liked).toBe(true);
    expect(body.likeCount).toBe(5);
  });

  it("unlikes a post (existing like)", async () => {
    // Existing like found
    prismaMock.like.findUnique.mockResolvedValue({ id: "like-1" });

    // Delete succeeds
    prismaMock.like.delete.mockResolvedValue({ id: "like-1" });

    // Updated like count
    prismaMock.like.count.mockResolvedValue(4);

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.liked).toBe(false);
    expect(body.likeCount).toBe(4);
  });

  it("returns 401 when not authenticated", async () => {
    clearMockSession();

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(401);
  });

  it("returns 500 on DB error", async () => {
    prismaMock.like.findUnique.mockRejectedValue(new Error("DB connection failed"));

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(500);
  });
});
