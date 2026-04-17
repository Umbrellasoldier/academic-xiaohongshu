import "@/test/mocks/prisma";
import "@/test/mocks/auth";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";
import { GET, PATCH } from "@/app/api/users/[username]/route";

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

function makePatchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/users/testuser", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ username: "testuser" });

describe("GET /api/users/[username]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticatedUser();
  });

  it("returns user profile", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "testuser",
      displayName: "Test User",
      avatar: "https://example.com/avatar.png",
      image: null,
      bio: "Researcher",
      institution: "MIT",
      orcid: "0000-0001-2345-6789",
      _count: {
        posts: 5,
        followers: 10,
        following: 3,
      },
    });

    const res = await GET(getReq("http://localhost/api/users/testuser") as any, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.displayName).toBe("Test User");
    expect(body.user.postCount).toBe(5);
    expect(body.user.followerCount).toBe(10);
    expect(body.user.followingCount).toBe(3);
  });

  it("returns 404 for nonexistent user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await GET(getReq("http://localhost/api/users/testuser") as any, { params });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/users/[username]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticatedUser();
  });

  it("updates profile", async () => {
    // Target user is self
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });

    // Update returns the updated user
    prismaMock.user.update.mockResolvedValue({
      id: "user-1",
      username: "testuser",
      displayName: "Updated Name",
      avatar: null,
      image: null,
      bio: "New bio",
      institution: "Stanford",
      orcid: null,
    });

    const res = await PATCH(
      makePatchRequest({
        displayName: "Updated Name",
        bio: "New bio",
        institution: "Stanford",
      }) as any,
      { params }
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.displayName).toBe("Updated Name");
    expect(body.user.bio).toBe("New bio");
    expect(body.user.institution).toBe("Stanford");
  });

  it("returns 401 when not authenticated", async () => {
    clearMockSession();

    const res = await PATCH(
      makePatchRequest({ displayName: "New Name" }) as any,
      { params }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when not profile owner", async () => {
    // Target user is someone else
    prismaMock.user.findUnique.mockResolvedValue({ id: "other-user" });

    const res = await PATCH(
      makePatchRequest({ displayName: "Hacked" }) as any,
      { params }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await PATCH(
      makePatchRequest({ displayName: "New Name" }) as any,
      { params }
    );
    expect(res.status).toBe(404);
  });
});
