import "@/test/mocks/prisma";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

// Must mock bcryptjs before importing the route
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-pw"),
    compare: vi.fn(),
  },
}));

import { POST } from "@/app/api/auth/register/route";

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: "newuser@example.com",
  username: "newuser",
  password: "securepassword123",
};

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers user successfully", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "user-new",
      email: validBody.email,
      username: validBody.username,
      displayName: validBody.username,
    });

    const res = await POST(
      jsonReq("http://localhost/api/auth/register", validBody)
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.message).toBe("注册成功");
    expect(data.user).toEqual({
      id: "user-new",
      email: validBody.email,
      username: validBody.username,
      displayName: validBody.username,
    });

    // Verify bcrypt was called with password and salt rounds
    const bcrypt = (await import("bcryptjs")).default;
    expect(bcrypt.hash).toHaveBeenCalledWith(validBody.password, 12);

    // Verify prisma calls
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: validBody.email }, { username: validBody.username }],
      },
    });
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        email: validBody.email,
        username: validBody.username,
        displayName: validBody.username,
        name: validBody.username,
        passwordHash: "hashed-pw",
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
      },
    });
  });

  it("returns 409 for duplicate email", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "existing-user",
      email: validBody.email,
      username: "someone_else",
    });

    const res = await POST(
      jsonReq("http://localhost/api/auth/register", validBody)
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("邮箱");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("returns 409 for duplicate username", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "existing-user",
      email: "other@example.com",
      username: validBody.username,
    });

    const res = await POST(
      jsonReq("http://localhost/api/auth/register", validBody)
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("用户名");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      jsonReq("http://localhost/api/auth/register", {
        ...validBody,
        email: "not-email",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("验证失败");
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns 400 for short password", async () => {
    const res = await POST(
      jsonReq("http://localhost/api/auth/register", {
        ...validBody,
        password: "1234567",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("验证失败");
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns 400 for short username", async () => {
    const res = await POST(
      jsonReq("http://localhost/api/auth/register", {
        ...validBody,
        username: "ab",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("验证失败");
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns 400 for username with special chars", async () => {
    const res = await POST(
      jsonReq("http://localhost/api/auth/register", {
        ...validBody,
        username: "user name!",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("验证失败");
  });

  it("returns 500 on DB error", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("DB down"));

    const res = await POST(
      jsonReq("http://localhost/api/auth/register", validBody)
    );
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("注册失败，请稍后重试");
  });
});
