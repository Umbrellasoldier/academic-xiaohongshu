import "@/test/mocks/prisma";
import "@/test/mocks/auth";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";
import { GET, POST } from "@/app/api/rooms/[id]/messages/route";
import { NextRequest } from "next/server";

const params = Promise.resolve({ id: "room-1" });

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

const now = new Date();

function makeFakeMessage(id: string, content: string) {
  return {
    id,
    content,
    type: "TEXT",
    createdAt: now,
    author: {
      id: "user-1",
      username: "testuser",
      displayName: "Test User",
      avatar: null,
      image: null,
    },
    replyTo: null,
  };
}

// ─── GET /api/rooms/[id]/messages ────────────────────────────────────

describe("GET /api/rooms/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns paginated messages (oldest first in response)", async () => {
    const messages = [
      makeFakeMessage("msg-3", "Third"),
      makeFakeMessage("msg-2", "Second"),
      makeFakeMessage("msg-1", "First"),
    ];
    prismaMock.roomMessage.findMany.mockResolvedValue(messages);

    const req = makeRequest("http://localhost/api/rooms/room-1/messages?limit=50");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.messages).toHaveLength(3);
    // Messages should be reversed (oldest first)
    expect(data.messages[0].id).toBe("msg-1");
    expect(data.messages[2].id).toBe("msg-3");
    expect(data.nextCursor).toBeNull();
  });

  it("returns nextCursor when there are more messages", async () => {
    // Return limit+1 messages to indicate hasMore
    const messages = Array.from({ length: 3 }, (_, i) =>
      makeFakeMessage(`msg-${i}`, `Message ${i}`)
    );
    prismaMock.roomMessage.findMany.mockResolvedValue(messages);

    const req = makeRequest("http://localhost/api/rooms/room-1/messages?limit=2");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(data.messages).toHaveLength(2);
    expect(data.nextCursor).toBe("msg-2"); // Last element of the full (limit+1) array
  });

  it("uses cursor for pagination", async () => {
    const cursorDate = new Date("2024-01-01");
    prismaMock.roomMessage.findUnique.mockResolvedValue({ createdAt: cursorDate });
    prismaMock.roomMessage.findMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost/api/rooms/room-1/messages?cursor=msg-5");
    const res = await GET(req, { params });

    expect(res.status).toBe(200);
    expect(prismaMock.roomMessage.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-5" },
      })
    );
    expect(prismaMock.roomMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roomId: "room-1",
          createdAt: { lt: cursorDate },
        }),
      })
    );
  });

  it("ignores invalid cursor gracefully", async () => {
    prismaMock.roomMessage.findUnique.mockResolvedValue(null);
    prismaMock.roomMessage.findMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost/api/rooms/room-1/messages?cursor=invalid");
    const res = await GET(req, { params });

    expect(res.status).toBe(200);
  });

  it("formats message author correctly (fallback displayName)", async () => {
    prismaMock.roomMessage.findMany.mockResolvedValue([
      {
        id: "msg-1",
        content: "Hello",
        type: "TEXT",
        createdAt: now,
        author: {
          id: "user-2",
          username: "noname",
          displayName: null,
          avatar: null,
          image: "https://img.example.com/pic.jpg",
        },
        replyTo: null,
      },
    ]);

    const req = makeRequest("http://localhost/api/rooms/room-1/messages");
    const res = await GET(req, { params });
    const data = await res.json();

    // displayName falls back to username
    expect(data.messages[0].author.displayName).toBe("noname");
    // avatar falls back to image
    expect(data.messages[0].author.avatar).toBe("https://img.example.com/pic.jpg");
  });

  it("includes replyTo data when present", async () => {
    prismaMock.roomMessage.findMany.mockResolvedValue([
      {
        id: "msg-2",
        content: "Reply",
        type: "TEXT",
        createdAt: now,
        author: {
          id: "user-1",
          username: "testuser",
          displayName: "Test",
          avatar: null,
          image: null,
        },
        replyTo: {
          id: "msg-1",
          content: "Original",
          author: { displayName: "Alice" },
        },
      },
    ]);

    const req = makeRequest("http://localhost/api/rooms/room-1/messages");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(data.messages[0].replyTo).toMatchObject({
      id: "msg-1",
      content: "Original",
      author: { displayName: "Alice" },
    });
  });

  it("returns 500 on database error", async () => {
    prismaMock.roomMessage.findMany.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost/api/rooms/room-1/messages");
    const res = await GET(req, { params });

    expect(res.status).toBe(500);
  });
});

// ─── POST /api/rooms/[id]/messages ───────────────────────────────────

describe("POST /api/rooms/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns 401 when not authenticated", async () => {
    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "Hello",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(401);
  });

  it("returns 400 when content is empty", async () => {
    setAuthenticatedUser();

    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "",
    });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("不能为空");
  });

  it("returns 400 when content is only whitespace", async () => {
    setAuthenticatedUser();

    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "   ",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(400);
  });

  it("returns 400 when content exceeds 5000 characters", async () => {
    setAuthenticatedUser();

    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "a".repeat(5001),
    });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("5000");
  });

  it("returns 403 when user is not a room member", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue(null);

    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "Hello",
    });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("加入");
  });

  it("sends a message successfully", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ id: "member-1" });
    prismaMock.roomMessage.create.mockResolvedValue({
      id: "msg-new",
      content: "Hello world",
      type: "TEXT",
      createdAt: now,
      author: {
        id: "user-1",
        username: "testuser",
        displayName: "Test User",
        avatar: null,
        image: null,
      },
      replyTo: null,
    });
    prismaMock.roomMember.update.mockResolvedValue({});

    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "Hello world",
    });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.message).toMatchObject({
      id: "msg-new",
      content: "Hello world",
      type: "TEXT",
    });
  });

  it("trims content whitespace", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ id: "member-1" });
    prismaMock.roomMessage.create.mockResolvedValue({
      id: "msg-new",
      content: "trimmed",
      type: "TEXT",
      createdAt: now,
      author: {
        id: "user-1",
        username: "testuser",
        displayName: "Test",
        avatar: null,
        image: null,
      },
      replyTo: null,
    });
    prismaMock.roomMember.update.mockResolvedValue({});

    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "  trimmed  ",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(201);
    expect(prismaMock.roomMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "trimmed",
        }),
      })
    );
  });

  it("handles replyToId when replying to another message", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ id: "member-1" });
    prismaMock.roomMessage.findUnique.mockResolvedValue({ id: "msg-original" });
    prismaMock.roomMessage.create.mockResolvedValue({
      id: "msg-reply",
      content: "Reply here",
      type: "TEXT",
      createdAt: now,
      author: {
        id: "user-1",
        username: "testuser",
        displayName: "Test",
        avatar: null,
        image: null,
      },
      replyTo: {
        id: "msg-original",
        content: "Original",
        author: { displayName: "Alice" },
      },
    });
    prismaMock.roomMember.update.mockResolvedValue({});

    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "Reply here",
      replyToId: "msg-original",
    });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.message.replyTo).toMatchObject({
      id: "msg-original",
    });
    expect(prismaMock.roomMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          replyToId: "msg-original",
        }),
      })
    );
  });

  it("ignores invalid replyToId gracefully", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ id: "member-1" });
    // replyToId lookup returns null
    prismaMock.roomMessage.findUnique.mockResolvedValue(null);
    prismaMock.roomMessage.create.mockResolvedValue({
      id: "msg-new",
      content: "Hello",
      type: "TEXT",
      createdAt: now,
      author: {
        id: "user-1",
        username: "testuser",
        displayName: "Test",
        avatar: null,
        image: null,
      },
      replyTo: null,
    });
    prismaMock.roomMember.update.mockResolvedValue({});

    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "Hello",
      replyToId: "nonexistent",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(201);
    expect(prismaMock.roomMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          replyToId: null,
        }),
      })
    );
  });

  it("sends with custom message type", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ id: "member-1" });
    prismaMock.roomMessage.create.mockResolvedValue({
      id: "msg-new",
      content: "https://example.com",
      type: "LINK",
      createdAt: now,
      author: {
        id: "user-1",
        username: "testuser",
        displayName: "Test",
        avatar: null,
        image: null,
      },
      replyTo: null,
    });
    prismaMock.roomMember.update.mockResolvedValue({});

    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "https://example.com",
      type: "LINK",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(201);
    expect(prismaMock.roomMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "LINK",
        }),
      })
    );
  });

  it("returns 500 on database error", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ id: "member-1" });
    prismaMock.roomMessage.create.mockRejectedValue(new Error("DB error"));

    const req = jsonReq("http://localhost/api/rooms/room-1/messages", {
      content: "Hello",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(500);
  });
});
