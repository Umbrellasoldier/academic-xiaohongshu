import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validators";
import type { UserProfile } from "@/types";

// GET /api/users/[username] — Get user profile
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        image: true,
        bio: true,
        institution: true,
        orcid: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
    }

    // Check if current user is following this user
    let isFollowing: boolean | undefined = undefined;
    const session = await auth();
    if (session?.user?.id && session.user.id !== dbUser.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: dbUser.id,
          },
        },
      });
      isFollowing = !!follow;
    }

    const user: UserProfile = {
      id: dbUser.id,
      username: dbUser.username!,
      displayName: dbUser.displayName || dbUser.username || "用户",
      avatar: dbUser.avatar || dbUser.image || null,
      bio: dbUser.bio || null,
      institution: dbUser.institution || null,
      orcid: dbUser.orcid || null,
      postCount: dbUser._count.posts,
      followerCount: dbUser._count.followers,
      followingCount: dbUser._count.following,
      isFollowing,
    };

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get user profile error:", error);
    return NextResponse.json(
      { error: "获取用户信息失败" },
      { status: 500 }
    );
  }
}

// PATCH /api/users/[username] — Update user profile
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // Verify the user is editing their own profile
    const targetUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (targetUser.id !== session.user.id) {
      return NextResponse.json({ error: "无权修改他人资料" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "数据格式不正确", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { displayName, bio, institution, orcid, avatar } = parsed.data;

    // Build update object — only include provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio || null;
    if (institution !== undefined) updateData.institution = institution || null;
    if (orcid !== undefined) updateData.orcid = orcid || null;
    if (avatar !== undefined) {
      updateData.avatar = avatar || null;
      updateData.image = avatar || null; // sync NextAuth image field
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        image: true,
        bio: true,
        institution: true,
        orcid: true,
      },
    });

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.displayName || updatedUser.username,
        avatar: updatedUser.avatar || updatedUser.image,
        bio: updatedUser.bio,
        institution: updatedUser.institution,
        orcid: updatedUser.orcid,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "更新资料失败" },
      { status: 500 }
    );
  }
}
