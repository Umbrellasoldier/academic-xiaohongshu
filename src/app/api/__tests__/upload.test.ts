import { describe, it, expect, beforeEach, vi } from "vitest";
import "@/test/mocks/prisma";
import "@/test/mocks/auth";
import { prismaMock } from "@/test/mocks/prisma";
import { setAuthenticatedUser, clearMockSession } from "@/test/mocks/auth";

// Mock supabase-storage
vi.mock("@/lib/supabase-storage", () => ({
  uploadAvatar: vi.fn().mockResolvedValue("https://supabase.co/storage/avatar.png"),
  deleteOldAvatar: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/upload/route";

function mockFile(name: string, type: string, size: number) {
  return { name, type, size } as unknown as File;
}

function uploadReq(fields: { file?: File | null; type?: string; targetId?: string }) {
  const formData = new Map<string, unknown>();
  if (fields.file) formData.set("file", fields.file);
  if (fields.type) formData.set("type", fields.type);
  if (fields.targetId) formData.set("targetId", fields.targetId);

  return {
    formData: vi.fn().mockResolvedValue({
      get: (key: string) => formData.get(key) ?? null,
    }),
  } as any;
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticatedUser();
  });

  it("uploads user avatar successfully", async () => {
    const file = mockFile("avatar.png", "image/png", 1024);

    prismaMock.user.findUnique.mockResolvedValue({ avatar: null });
    prismaMock.user.update.mockResolvedValue({});

    const res = await POST(uploadReq({ file, type: "user", targetId: "user-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    clearMockSession();
    const file = mockFile("avatar.png", "image/png", 1024);

    const res = await POST(uploadReq({ file, type: "user", targetId: "user-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when file is missing", async () => {
    const res = await POST(uploadReq({ type: "user", targetId: "user-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported file type", async () => {
    const file = mockFile("doc.pdf", "application/pdf", 1024);

    const res = await POST(uploadReq({ file, type: "user", targetId: "user-1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("不支持");
  });

  it("returns 400 for file exceeding 2MB", async () => {
    const file = mockFile("big.png", "image/png", 3 * 1024 * 1024);

    const res = await POST(uploadReq({ file, type: "user", targetId: "user-1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("2MB");
  });

  it("returns 403 when uploading for another user", async () => {
    const file = mockFile("avatar.png", "image/png", 1024);

    const res = await POST(uploadReq({ file, type: "user", targetId: "other-user" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when non-owner uploads room avatar", async () => {
    const file = mockFile("avatar.png", "image/png", 1024);

    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "MEMBER" });

    const res = await POST(uploadReq({ file, type: "room", targetId: "room-1" }));
    expect(res.status).toBe(403);
  });

  it("uploads room avatar when owner", async () => {
    const file = mockFile("room.png", "image/png", 1024);

    prismaMock.roomMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.discussionRoom.findUnique.mockResolvedValue({ avatarUrl: null });
    prismaMock.discussionRoom.update.mockResolvedValue({});

    const res = await POST(uploadReq({ file, type: "room", targetId: "room-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBeDefined();
  });

  it("returns 400 for invalid type parameter", async () => {
    const file = mockFile("avatar.png", "image/png", 1024);

    const res = await POST(uploadReq({ file, type: "invalid", targetId: "user-1" }));
    expect(res.status).toBe(400);
  });
});
