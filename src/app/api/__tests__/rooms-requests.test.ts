import "@/test/mocks/prisma";
import "@/test/mocks/auth";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";
import { GET, POST } from "@/app/api/rooms/[id]/requests/route";
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

// ─── GET /api/rooms/[id]/requests ────────────────────────────────────

describe("GET /api/rooms/[id]/requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns 401 when not authenticated", async () => {
    const req = makeRequest("http://localhost/api/rooms/room-1/requests");
    const res = await GET(req, { params });

    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not OWNER", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "MEMBER" });

    const req = makeRequest("http://localhost/api/rooms/room-1/requests");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("房主");
  });

  it("returns 403 when user is not a member at all", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost/api/rooms/room-1/requests");
    const res = await GET(req, { params });

    expect(res.status).toBe(403);
  });

  it("lists pending join requests for OWNER", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.roomJoinRequest.findMany.mockResolvedValue([
      {
        id: "req-1",
        message: "Please let me in",
        createdAt: now,
        user: {
          id: "user-2",
          username: "applicant",
          displayName: "Applicant",
          avatar: null,
          image: "https://img.example.com/pic.jpg",
        },
      },
      {
        id: "req-2",
        message: null,
        createdAt: now,
        user: {
          id: "user-3",
          username: "applicant2",
          displayName: null,
          avatar: null,
          image: null,
        },
      },
    ]);

    const req = makeRequest("http://localhost/api/rooms/room-1/requests");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.requests).toHaveLength(2);
    expect(data.requests[0]).toMatchObject({
      id: "req-1",
      message: "Please let me in",
      user: {
        id: "user-2",
        username: "applicant",
        displayName: "Applicant",
        avatar: "https://img.example.com/pic.jpg",
      },
    });
    // displayName falls back to username
    expect(data.requests[1].user.displayName).toBe("applicant2");
  });

  it("returns empty list when no pending requests", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.roomJoinRequest.findMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost/api/rooms/room-1/requests");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.requests).toHaveLength(0);
  });

  it("only fetches PENDING requests", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.roomJoinRequest.findMany.mockResolvedValue([]);

    const req = makeRequest("http://localhost/api/rooms/room-1/requests");
    await GET(req, { params });

    expect(prismaMock.roomJoinRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roomId: "room-1",
          status: "PENDING",
        }),
      })
    );
  });

  it("returns 500 on database error", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.roomJoinRequest.findMany.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost/api/rooms/room-1/requests");
    const res = await GET(req, { params });

    expect(res.status).toBe(500);
  });
});

// ─── POST /api/rooms/[id]/requests ───────────────────────────────────

describe("POST /api/rooms/[id]/requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockSession();
  });

  it("returns 401 when not authenticated", async () => {
    const req = jsonReq("http://localhost/api/rooms/room-1/requests", {
      requestId: "req-1",
      action: "approve",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not OWNER", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "MEMBER" });

    const req = jsonReq("http://localhost/api/rooms/room-1/requests", {
      requestId: "req-1",
      action: "approve",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(403);
  });

  it("returns 400 when requestId is missing", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });

    const req = jsonReq("http://localhost/api/rooms/room-1/requests", {
      action: "approve",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(400);
  });

  it("returns 400 when action is invalid", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });

    const req = jsonReq("http://localhost/api/rooms/room-1/requests", {
      requestId: "req-1",
      action: "ban",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(400);
  });

  it("returns 404 when join request does not exist", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.roomJoinRequest.findFirst.mockResolvedValue(null);

    const req = jsonReq("http://localhost/api/rooms/room-1/requests", {
      requestId: "nonexistent",
      action: "approve",
    });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("不存在");
  });

  it("approves a join request successfully", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.roomJoinRequest.findFirst.mockResolvedValue({
      id: "req-1",
      userId: "user-2",
    });
    // $transaction mock passes the array through
    prismaMock.$transaction.mockResolvedValue([{}, {}]);

    const req = jsonReq("http://localhost/api/rooms/room-1/requests", {
      requestId: "req-1",
      action: "approve",
    });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe("approve");
    expect(data.message).toContain("通过");
  });

  it("rejects a join request successfully", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.roomJoinRequest.findFirst.mockResolvedValue({
      id: "req-1",
      userId: "user-2",
    });
    prismaMock.roomJoinRequest.update.mockResolvedValue({});

    const req = jsonReq("http://localhost/api/rooms/room-1/requests", {
      requestId: "req-1",
      action: "reject",
    });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe("reject");
    expect(data.message).toContain("拒绝");
    expect(prismaMock.roomJoinRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1" },
        data: { status: "REJECTED" },
      })
    );
  });

  it("returns 500 on database error during approve", async () => {
    setAuthenticatedUser();
    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.roomJoinRequest.findFirst.mockResolvedValue({
      id: "req-1",
      userId: "user-2",
    });
    prismaMock.$transaction.mockRejectedValue(new Error("DB error"));

    const req = jsonReq("http://localhost/api/rooms/room-1/requests", {
      requestId: "req-1",
      action: "approve",
    });
    const res = await POST(req, { params });

    expect(res.status).toBe(500);
  });
});
