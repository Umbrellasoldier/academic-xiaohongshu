import "@/test/mocks/prisma";
import "@/test/mocks/auth";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";
import { POST } from "@/app/api/users/[username]/follow/route";

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
  return new Request("http://localhost/api/users/targetuser/follow", {
    method: "POST",
  });
}

const params = Promise.resolve({ username: "targetuser" });

describe("POST /api/users/[username]/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticatedUser();
  });

  it("follows a user", async () => {
    // First call: target user lookup by username
    // Second call: actor lookup for notification
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: "target-id" })
      .mockResolvedValueOnce({
        displayName: "Test User",
        username: "testuser",
      });

    // No existing follow
    prismaMock.follow.findUnique.mockResolvedValue(null);

    // Create follow
    prismaMock.follow.create.mockResolvedValue({
      id: "follow-new",
      followerId: "user-1",
      followingId: "target-id",
    });

    // Fire-and-forget notification
    prismaMock.notification.create.mockReturnValue({
      catch: () => {},
    } as any);

    // Updated follower count
    prismaMock.follow.count.mockResolvedValue(10);

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.isFollowing).toBe(true);
    expect(body.followerCount).toBe(10);
  });

  it("unfollows a user", async () => {
    // Target user found
    prismaMock.user.findUnique.mockResolvedValue({ id: "target-id" });

    // Existing follow found
    prismaMock.follow.findUnique.mockResolvedValue({
      id: "follow-1",
      followerId: "user-1",
      followingId: "target-id",
    });

    // Delete succeeds
    prismaMock.follow.delete.mockResolvedValue({
      id: "follow-1",
      followerId: "user-1",
      followingId: "target-id",
    });

    // Updated follower count
    prismaMock.follow.count.mockResolvedValue(9);

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.isFollowing).toBe(false);
    expect(body.followerCount).toBe(9);
  });

  it("returns 401 when not authenticated", async () => {
    clearMockSession();

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 for nonexistent user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(404);
  });

  it("returns 400 when following self", async () => {
    // Target user resolves to same ID as authenticated user
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });

    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(400);
  });
});
