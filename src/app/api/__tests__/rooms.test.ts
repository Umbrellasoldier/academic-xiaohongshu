import "@/test/mocks/prisma";
import "@/test/mocks/auth";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";
import { GET, POST } from "@/app/api/rooms/route";
import { NextRequest } from "next/server";

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost"), init);
}

function jsonReq(url: string, body: unknown) {
  return makeRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/rooms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns a list of rooms (no auth required)", async () => {
    const now = new Date();
    prismaMock.discussionRoom.findMany.mockResolvedValue([
      {
        id: "room-1",
        name: "Test Room",
        description: "A room",
        avatarUrl: null,
        isPublic: true,
        createdAt: now,
        subject: { id: "s1", name: "CS", nameZh: "计算机", slug: "cs", color: "#000", icon: "💻" },
        _count: { members: 3, messages: 10 },
        members: [],
        messages: [
          {
            content: "Hello",
            createdAt: now,
            author: { displayName: "Alice" },
          },
        ],
      },
    ]);

    const req = makeRequest("http://localhost/api/rooms");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rooms).toHaveLength(1);
    expect(data.rooms[0]).toMatchObject({
      id: "room-1",
      name: "Test Room",
      memberCount: 3,
      isMember: false,
      lastMessage: {
        content: "Hello",
        author: "Alice",
      },
    });
  });

  it("filters rooms by subject slug", async () => {
    prismaMock.discussionRoom.findMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost/api/rooms?subject=cs");
    await GET(req);

    expect(prismaMock.discussionRoom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subject: { slug: "cs" },
        }),
      })
    );
  });

  it("filters rooms by search query", async () => {
    prismaMock.discussionRoom.findMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost/api/rooms?q=machine");
    await GET(req);

    expect(prismaMock.discussionRoom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "machine", mode: "insensitive" } },
            { description: { contains: "machine", mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("filters joined rooms when authenticated", async () => {
    setAuthenticatedUser();
    prismaMock.discussionRoom.findMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost/api/rooms?joined=true");
    await GET(req);

    expect(prismaMock.discussionRoom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: { some: { userId: "user-1" } },
        }),
      })
    );
  });

  it("sets isMember=true when authenticated user is a member", async () => {
    setAuthenticatedUser();
    const now = new Date();
    prismaMock.discussionRoom.findMany.mockResolvedValue([
      {
        id: "room-1",
        name: "Test Room",
        description: null,
        avatarUrl: null,
        isPublic: true,
        createdAt: now,
        subject: null,
        _count: { members: 2, messages: 0 },
        members: [{ id: "member-1" }],
        messages: [],
      },
    ]);

    const req = makeRequest("http://localhost/api/rooms");
    const res = await GET(req);
    const data = await res.json();

    expect(data.rooms[0].isMember).toBe(true);
  });

  it("returns lastMessage as null when room has no messages", async () => {
    prismaMock.discussionRoom.findMany.mockResolvedValue([
      {
        id: "room-1",
        name: "Empty Room",
        description: null,
        avatarUrl: null,
        isPublic: true,
        createdAt: new Date(),
        subject: null,
        _count: { members: 1, messages: 0 },
        members: [],
        messages: [],
      },
    ]);

    const req = makeRequest("http://localhost/api/rooms");
    const res = await GET(req);
    const data = await res.json();

    expect(data.rooms[0].lastMessage).toBeNull();
  });

  it("returns 500 on database error", async () => {
    prismaMock.discussionRoom.findMany.mockRejectedValue(new Error("DB down"));

    const req = makeRequest("http://localhost/api/rooms");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取研讨室列表失败");
  });
});

describe("POST /api/rooms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns 401 when not authenticated", async () => {
    const req = jsonReq("http://localhost/api/rooms", { name: "Test" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("请先登录");
  });

  it("returns 400 when name is too short", async () => {
    setAuthenticatedUser();

    const req = jsonReq("http://localhost/api/rooms", { name: "A" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("2");
  });

  it("returns 400 when name is empty", async () => {
    setAuthenticatedUser();

    const req = jsonReq("http://localhost/api/rooms", { name: "" });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when name exceeds 50 characters", async () => {
    setAuthenticatedUser();

    const req = jsonReq("http://localhost/api/rooms", {
      name: "a".repeat(51),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("50");
  });

  it("creates a room with valid data", async () => {
    setAuthenticatedUser();
    const now = new Date();

    prismaMock.subject.findUnique.mockResolvedValue({ id: "subject-1" });
    prismaMock.discussionRoom.create.mockResolvedValue({
      id: "room-new",
      name: "My Room",
      description: "A description",
      avatarUrl: null,
      isPublic: true,
      createdAt: now,
      subject: { id: "subject-1", name: "CS", nameZh: "计算机", slug: "cs", color: "#000", icon: "💻" },
    });

    const req = jsonReq("http://localhost/api/rooms", {
      name: "My Room",
      description: "A description",
      subjectSlug: "cs",
      isPublic: true,
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.room).toMatchObject({
      id: "room-new",
      name: "My Room",
      memberCount: 1,
      isMember: true,
      lastMessage: null,
    });
  });

  it("creates a room without a subject", async () => {
    setAuthenticatedUser();
    const now = new Date();

    prismaMock.discussionRoom.create.mockResolvedValue({
      id: "room-new",
      name: "No Subject Room",
      description: null,
      avatarUrl: null,
      isPublic: true,
      createdAt: now,
      subject: null,
    });

    const req = jsonReq("http://localhost/api/rooms", {
      name: "No Subject Room",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(prismaMock.subject.findUnique).not.toHaveBeenCalled();
  });

  it("handles subject slug that does not exist", async () => {
    setAuthenticatedUser();
    const now = new Date();

    prismaMock.subject.findUnique.mockResolvedValue(null);
    prismaMock.discussionRoom.create.mockResolvedValue({
      id: "room-new",
      name: "Room",
      description: null,
      avatarUrl: null,
      isPublic: true,
      createdAt: now,
      subject: null,
    });

    const req = jsonReq("http://localhost/api/rooms", {
      name: "Room",
      subjectSlug: "nonexistent",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    // subjectId should be null
    expect(prismaMock.discussionRoom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subjectId: null,
        }),
      })
    );
  });

  it("trims whitespace from name", async () => {
    setAuthenticatedUser();
    const now = new Date();

    prismaMock.discussionRoom.create.mockResolvedValue({
      id: "room-new",
      name: "Trimmed",
      description: null,
      avatarUrl: null,
      isPublic: true,
      createdAt: now,
      subject: null,
    });

    const req = jsonReq("http://localhost/api/rooms", {
      name: "  Trimmed  ",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(prismaMock.discussionRoom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Trimmed",
        }),
      })
    );
  });

  it("returns 500 on database error", async () => {
    setAuthenticatedUser();
    prismaMock.discussionRoom.create.mockRejectedValue(new Error("DB error"));

    const req = jsonReq("http://localhost/api/rooms", { name: "Failing Room" });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
