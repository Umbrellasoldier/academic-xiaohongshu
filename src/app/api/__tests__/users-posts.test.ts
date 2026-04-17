import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import "@/test/mocks/prisma";
import { prismaMock } from "@/test/mocks/prisma";

import { GET } from "@/app/api/users/[username]/posts/route";

function getReq(url: string) {
  return new NextRequest(url);
}

const mockPost = {
  id: "post-1",
  title: "Test Post",
  summary: "Summary",
  coverImage: null,
  createdAt: new Date("2024-01-01"),
  author: {
    username: "testuser",
    displayName: "Test User",
    avatar: null,
    image: null,
  },
  subject: { name: "CS", nameZh: "计算机", slug: "cs", color: "#000" },
  _count: { comments: 2, likes: 5 },
};

describe("GET /api/users/[username]/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user posts", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    prismaMock.post.findMany.mockResolvedValue([mockPost]);

    const req = getReq("http://localhost/api/users/testuser/posts");
    const res = await GET(req as any, {
      params: Promise.resolve({ username: "testuser" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].title).toBe("Test Post");
  });

  it("returns 404 for nonexistent user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const req = getReq("http://localhost/api/users/nobody/posts");
    const res = await GET(req as any, {
      params: Promise.resolve({ username: "nobody" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns bookmarked posts when type=bookmarks", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    prismaMock.bookmark.findMany.mockResolvedValue([
      { id: "bm-1", post: mockPost },
    ]);

    const req = getReq(
      "http://localhost/api/users/testuser/posts?type=bookmarks"
    );
    const res = await GET(req as any, {
      params: Promise.resolve({ username: "testuser" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.posts).toHaveLength(1);
  });

  it("returns empty posts list", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
    prismaMock.post.findMany.mockResolvedValue([]);

    const req = getReq("http://localhost/api/users/testuser/posts");
    const res = await GET(req as any, {
      params: Promise.resolve({ username: "testuser" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.posts).toHaveLength(0);
    expect(data.nextCursor).toBeNull();
  });

  it("returns 500 on DB error", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("DB down"));

    const req = getReq("http://localhost/api/users/testuser/posts");
    const res = await GET(req as any, {
      params: Promise.resolve({ username: "testuser" }),
    });
    expect(res.status).toBe(500);
  });
});
