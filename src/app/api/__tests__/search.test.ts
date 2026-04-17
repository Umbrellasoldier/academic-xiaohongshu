import "@/test/mocks/prisma";
import "@/test/mocks/auth";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "@/test/mocks/prisma";
import { clearMockSession } from "@/test/mocks/auth";
import { GET } from "@/app/api/search/route";

function makeSearchRequest(queryParams: string) {
  return new NextRequest(`http://localhost/api/search?${queryParams}`);
}

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("should return 400 when query is missing", async () => {
    const res = await GET(makeSearchRequest("type=posts"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("should return 400 when query is empty", async () => {
    const res = await GET(makeSearchRequest("q=&type=posts"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("should return 400 for unsupported search type", async () => {
    const res = await GET(
      makeSearchRequest("q=test&type=invalid")
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("should search posts and return results", async () => {
    const now = new Date("2026-03-01T12:00:00Z");

    prismaMock.post.findMany.mockResolvedValue([
      {
        id: "post-1",
        title: "Machine Learning 101",
        summary: "An intro to ML",
        coverImage: "https://example.com/cover.jpg",
        createdAt: now,
        author: {
          username: "alice",
          displayName: "Alice",
          avatar: null,
          image: "https://example.com/alice.png",
        },
        subject: {
          name: "Computer Science",
          nameZh: "计算机科学",
          slug: "cs",
          color: "#3498db",
        },
        _count: {
          comments: 2,
          likes: 5,
        },
      },
    ]);

    const res = await GET(
      makeSearchRequest("q=machine+learning&type=posts")
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.posts).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.query).toBe("machine learning");

    const post = body.posts[0];
    expect(post.id).toBe("post-1");
    expect(post.title).toBe("Machine Learning 101");
    expect(post.createdAt).toBe("2026-03-01T12:00:00.000Z");
    expect(post.author.username).toBe("alice");
    expect(post.author.avatar).toBe("https://example.com/alice.png");
    expect(post.subject.slug).toBe("cs");
    expect(post.likeCount).toBe(5);
    expect(post.commentCount).toBe(2);

    expect(prismaMock.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PUBLISHED",
          OR: expect.any(Array),
        }),
      })
    );
  });

  it("should search users and return results", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        username: "alice",
        displayName: "Alice Researcher",
        avatar: "https://example.com/alice.png",
        image: null,
        bio: "AI researcher",
        institution: "MIT",
        _count: { posts: 12 },
      },
    ]);

    const res = await GET(
      makeSearchRequest("q=alice&type=users")
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.query).toBe("alice");

    const user = body.users[0];
    expect(user.id).toBe("user-1");
    expect(user.username).toBe("alice");
    expect(user.displayName).toBe("Alice Researcher");
    expect(user.avatar).toBe("https://example.com/alice.png");
    expect(user.bio).toBe("AI researcher");
    expect(user.institution).toBe("MIT");
    expect(user.postCount).toBe(12);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      })
    );
  });

  it("should default to posts search when type is not specified", async () => {
    prismaMock.post.findMany.mockResolvedValue([]);

    const res = await GET(makeSearchRequest("q=quantum"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.posts).toBeDefined();
    expect(body.posts).toHaveLength(0);
    expect(prismaMock.post.findMany).toHaveBeenCalled();
  });

  it("should return 500 on database error", async () => {
    prismaMock.post.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(makeSearchRequest("q=test"));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
