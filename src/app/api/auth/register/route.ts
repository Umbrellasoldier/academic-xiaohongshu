import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  email: z.email("请输入有效的邮箱地址"),
  username: z
    .string()
    .min(3, "用户名至少3个字符")
    .max(30, "用户名最多30个字符")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "用户名只能包含字母、数字、下划线和连字符"
    ),
  password: z.string().min(8, "密码至少8个字符"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      const errors = z.prettifyError(result.error);
      return NextResponse.json(
        { error: "验证失败", details: errors },
        { status: 400 }
      );
    }

    const { email, username, password } = result.data;

    // Check if email or username already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json(
          { error: "该邮箱已注册" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "该用户名已被占用" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user — use username as displayName
    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName: username,
        name: username,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
      },
    });

    return NextResponse.json(
      { message: "注册成功", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}
