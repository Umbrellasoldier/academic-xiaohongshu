import "@/test/mocks/prisma";
import "@/test/mocks/auth";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";
import { GET, POST, PATCH } from "@/app/api/rooms/[id]/route";
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

function patchReq(url: string, body: unknown) {
  return makeRequest(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const now = new Date();

function mockRoomFound(overrides = {}) {
  prismaMock.discussionRoom.findUnique.mockResolvedValue({
    id: "room-1",
    name: "Test Room",
    description: "desc",
    avatarUrl: null,
    isPublic: true,
    maxMembers: 100,
    createdAt: now,
    subject: null,
    _count: { members: 2 },
    members: [
      {
        user: { id: "user-1", username: "testuser", displayName: "Test User", avatar: null, image: null },
        role: "OWNER",
        joinedAt: now,
      },
      {
        user: { id: "user-2", username: "other", displayName: "Other", avatar: null, image: null },
        role: "MEMBER",
        joinedAt: now,
      },
    ],
    ...overrides,
  });
}

// ─── GET /api/rooms/[id] ────────────────────────────────────────────

describe("GET /api/rooms/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns room detail with members and online count", async () => {
    mockRoomFound();
    prismaMock.roomMember.count.mockResolvedValue(1);

    const req = makeRequest("http://localhost/api/rooms/room-1");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.room).toMatchObject({
      id: "room-1",
      name: "Test Room",
      memberCount: 2,
      onlineCount: 1,
      isMember: false,
    });
    expect(data.room.members).toHaveLength(2);
    expect(data.room.members[0]).toMatchObject({
      id: "user-1",
      role: "OWNER",
    });
  });

  it("sets isMember=true for authenticated member", async () => {
    setAuthenticatedUser({ id: "user-1" });
    mockRoomFound();
    prismaMock.roomMember.update.mockResolvedValue({});
    prismaMock.roomMember.count.mockResolvedValue(1);

    const req = makeRequest("http://localhost/api/rooms/room-1");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(data.room.isMember).toBe(true);
    // Should update lastActiveAt for the viewing member
    expect(prismaMock.roomMember.update).toHaveBeenCalled();
  });

  it("returns 404 when room does not exist", async () => {
    prismaMock.discussionRoom.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost/api/rooms/nonexistent");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("研讨室不存在");
  });

  it("returns 500 on database error", async () => {
    prismaMock.discussionRoom.findUnique.mockRejectedValue(new Error("DB down"));

    const req = makeRequest("http://localhost/api/rooms/room-1");
    const res = await GET(req, { params });

    expect(res.status).toBe(500);
  });
});

// ─── POST /api/rooms/[id] — join ────────────────────────────────────

describe("POST /api/rooms/[id] action=join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns 401 when not authenticated", async () => {
    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "join" });
    const res = await POST(req, { params });

    expect(res.status).toBe(401);
  });

  it("joins a public room successfully", async () => {
    setAuthenticatedUser();
    prismaMock.discussionRoom.findUnique.mockResolvedValue({
      id: "room-1",
      isPublic: true,
      maxMembers: 100,
      _count: { members: 5 },
    });
    prismaMock.roomMember.upsert.mockResolvedValue({});

    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "join" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isMember).toBe(true);
    expect(prismaMock.roomMember.upsert).toHaveBeenCalled();
  });

  it("returns 404 when room does not exist", async () => {
    setAuthenticatedUser();
    prismaMock.discussionRoom.findUnique.mockResolvedValue(null);

    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "join" });
    const res = await POST(req, { params });

    expect(res.status).toBe(404);
  });

  it("returns 400 when room is full", async () => {
    setAuthenticatedUser();
    prismaMock.discussionRoom.findUnique.mockResolvedValue({
      id: "room-1",
      isPublic: true,
      maxMembers: 5,
      _count: { members: 5 },
    });

    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "join" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("满员");
  });

  it("creates a join request for a private room", async () => {
    setAuthenticatedUser();
    prismaMock.discussionRoom.findUnique.mockResolvedValue({
      id: "room-1",
      isPublic: false,
      maxMembers: 100,
      _count: { members: 2 },
    });
    prismaMock.roomMember.findUnique.mockResolvedValue(null);
    prismaMock.roomJoinRequest.findUnique.mockResolvedValue(null);
    prismaMock.roomJoinRequest.upsert.mockResolvedValue({});

    const req = jsonReq("http://localhost/api/rooms/room-1", {
      action: "join",
      message: "Please let me in",
    });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.pending).toBe(true);
    expect(data.isMember).toBe(false);
    expect(prismaMock.roomJoinRequest.upsert).toHaveBeenCalled();
  });

  it("returns already-member status for private room if already joined", async () => {
    setAuthenticatedUser();
    prismaMock.discussionRoom.findUnique.mockResolvedValue({
      id: "room-1",
      isPublic: false,
      maxMembers: 100,
      _count: { members: 3 },
    });
    prismaMock.roomMember.findUnique.mockResolvedValue({ id: "existing-member" });

    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "join" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isMember).toBe(true);
    expect(data.message).toContain("已是成员");
  });

  it("blocks re-application within 24h cooldown after rejection", async () => {
    setAuthenticatedUser();
    prismaMock.discussionRoom.findUnique.mockResolvedValue({
      id: "room-1",
      isPublic: false,
      maxMembers: 100,
      _count: { members: 2 },
    });
    prismaMock.roomMember.findUnique.mockResolvedValue(null);
    prismaMock.roomJoinRequest.findUnique.mockResolvedValue({
      status: "REJECTED",
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    });

    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "join" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("拒绝");
  });

  it("allows re-application after 24h cooldown", async () => {
    setAuthenticatedUser();
    prismaMock.discussionRoom.findUnique.mockResolvedValue({
      id: "room-1",
      isPublic: false,
      maxMembers: 100,
      _count: { members: 2 },
    });
    prismaMock.roomMember.findUnique.mockResolvedValue(null);
    prismaMock.roomJoinRequest.findUnique.mockResolvedValue({
      status: "REJECTED",
      updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
    });
    prismaMock.roomJoinRequest.upsert.mockResolvedValue({});

    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "join" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.pending).toBe(true);
  });
});

// ─── POST /api/rooms/[id] — leave ───────────────────────────────────

describe("POST /api/rooms/[id] action=leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("leaves a room successfully", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "MEMBER" });
    prismaMock.roomMember.deleteMany.mockResolvedValue({ count: 1 });

    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "leave" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isMember).toBe(false);
  });

  it("prevents OWNER from leaving", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });

    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "leave" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("房主");
  });

  it("allows non-member to leave (deleteMany is no-op)", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue(null);
    prismaMock.roomMember.deleteMany.mockResolvedValue({ count: 0 });

    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "leave" });
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
  });
});

// ─── POST /api/rooms/[id] — invalid action ──────────────────────────

describe("POST /api/rooms/[id] invalid action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns 400 for unknown action", async () => {
    setAuthenticatedUser();

    const req = jsonReq("http://localhost/api/rooms/room-1", { action: "kick" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("无效操作");
  });
});

// ─── PATCH /api/rooms/[id] ──────────────────────────────────────────

describe("PATCH /api/rooms/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns 401 when not authenticated", async () => {
    const req = patchReq("http://localhost/api/rooms/room-1", { name: "New" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not OWNER", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "MEMBER" });

    const req = patchReq("http://localhost/api/rooms/room-1", { name: "New Name" });
    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("房主");
  });

  it("returns 403 when user is not a member at all", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue(null);

    const req = patchReq("http://localhost/api/rooms/room-1", { name: "New Name" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(403);
  });

  it("updates room name successfully as OWNER", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.discussionRoom.update.mockResolvedValue({
      id: "room-1",
      name: "Updated Name",
      description: "desc",
      avatarUrl: null,
    });

    const req = patchReq("http://localhost/api/rooms/room-1", { name: "Updated Name" });
    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.room.name).toBe("Updated Name");
  });

  it("updates room description", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.discussionRoom.update.mockResolvedValue({
      id: "room-1",
      name: "Room",
      description: "New description",
      avatarUrl: null,
    });

    const req = patchReq("http://localhost/api/rooms/room-1", { description: "New description" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    expect(prismaMock.discussionRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: "New description",
        }),
      })
    );
  });

  it("returns 400 when name is too short via zod validation", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });

    const req = patchReq("http://localhost/api/rooms/room-1", { name: "A" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(400);
  });

  it("returns 400 when no update fields provided", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });

    const req = patchReq("http://localhost/api/rooms/room-1", {});
    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("没有要更新的字段");
  });

  it("returns 500 on database error", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.discussionRoom.update.mockRejectedValue(new Error("DB error"));

    const req = patchReq("http://localhost/api/rooms/room-1", { name: "Valid Name" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(500);
  });
});
