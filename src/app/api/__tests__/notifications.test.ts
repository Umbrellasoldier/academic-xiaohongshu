import "@/test/mocks/prisma";
import "@/test/mocks/auth";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";
import { GET, POST } from "@/app/api/notifications/route";
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

const now = new Date();

// ─── GET /api/notifications ──────────────────────────────────────────

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns 401 when not authenticated", async () => {
    const req = makeRequest("http://localhost/api/notifications");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("lists notifications with unread count", async () => {
    setAuthenticatedUser();
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: "n-1",
        type: "LIKE",
        title: "Someone liked your post",
        body: "Details",
        isRead: false,
        link: "/posts/123",
        createdAt: now,
        actor: {
          username: "alice",
          displayName: "Alice",
          avatar: null,
          image: "https://img.example.com/alice.jpg",
        },
      },
      {
        id: "n-2",
        type: "COMMENT",
        title: "New comment",
        body: "A comment body",
        isRead: true,
        link: "/posts/456",
        createdAt: now,
        actor: null,
      },
    ]);
    prismaMock.notification.count.mockResolvedValue(1);

    const req = makeRequest("http://localhost/api/notifications");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notifications).toHaveLength(2);
    expect(data.unreadCount).toBe(1);

    // First notification
    expect(data.notifications[0]).toMatchObject({
      id: "n-1",
      type: "LIKE",
      isRead: false,
      actor: {
        username: "alice",
        displayName: "Alice",
        avatar: "https://img.example.com/alice.jpg",
      },
      link: "/posts/123",
    });

    // Second notification with null actor
    expect(data.notifications[1].actor).toBeNull();
  });

  it("filters unread-only notifications", async () => {
    setAuthenticatedUser();
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);

    const req = makeRequest("http://localhost/api/notifications?unread=true");
    await GET(req);

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          isRead: false,
        }),
      })
    );
  });

  it("does not filter by isRead when unread param is absent", async () => {
    setAuthenticatedUser();
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count.mockResolvedValue(0);

    const req = makeRequest("http://localhost/api/notifications");
    await GET(req);

    const callArgs = prismaMock.notification.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({ userId: "user-1" });
    expect(callArgs.where.isRead).toBeUndefined();
  });

  it("formats actor displayName with fallback to username", async () => {
    setAuthenticatedUser();
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: "n-1",
        type: "FOLLOW",
        title: "New follower",
        body: null,
        isRead: false,
        link: null,
        createdAt: now,
        actor: {
          username: "bob",
          displayName: null,
          avatar: null,
          image: null,
        },
      },
    ]);
    prismaMock.notification.count.mockResolvedValue(1);

    const req = makeRequest("http://localhost/api/notifications");
    const res = await GET(req);
    const data = await res.json();

    expect(data.notifications[0].actor.displayName).toBe("bob");
  });

  it("returns 500 on database error", async () => {
    setAuthenticatedUser();
    prismaMock.notification.findMany.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost/api/notifications");
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});

// ─── POST /api/notifications ─────────────────────────────────────────

describe("POST /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns 401 when not authenticated", async () => {
    const req = jsonReq("http://localhost/api/notifications", {
      action: "markAllRead",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("marks all notifications as read", async () => {
    setAuthenticatedUser();
    prismaMock.notification.updateMany.mockResolvedValue({ count: 5 });

    const req = jsonReq("http://localhost/api/notifications", {
      action: "markAllRead",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isRead: false },
        data: { isRead: true },
      })
    );
  });

  it("marks a single notification as read", async () => {
    setAuthenticatedUser();
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });

    const req = jsonReq("http://localhost/api/notifications", {
      action: "markRead",
      notificationId: "n-1",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "n-1", userId: "user-1" },
        data: { isRead: true },
      })
    );
  });

  it("returns 400 for invalid action", async () => {
    setAuthenticatedUser();

    const req = jsonReq("http://localhost/api/notifications", {
      action: "delete",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("无效操作");
  });

  it("returns 400 when markRead has no notificationId", async () => {
    setAuthenticatedUser();

    const req = jsonReq("http://localhost/api/notifications", {
      action: "markRead",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    setAuthenticatedUser();
    prismaMock.notification.updateMany.mockRejectedValue(new Error("DB error"));

    const req = jsonReq("http://localhost/api/notifications", {
      action: "markAllRead",
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
