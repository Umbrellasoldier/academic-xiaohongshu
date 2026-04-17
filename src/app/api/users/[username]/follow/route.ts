import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/users/[username]/follow — Toggle follow
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "请先登录" },
        { status: 401 }
      );
    }

    const currentUserId = session.user.id;

    // Find the target user
    const targetUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
    }

    // Cannot follow yourself
    if (targetUser.id === currentUserId) {
      return NextResponse.json(
        { error: "不能关注自己" },
        { status: 400 }
      );
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUser.id,
        },
      },
    });

    let isFollowing: boolean;

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: { id: existingFollow.id },
      });
      isFollowing = false;
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          followerId: currentUserId,
          followingId: targetUser.id,
        },
      });
      isFollowing = true;

      // Send notification to target user
      const actor = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { displayName: true, username: true },
      });
      const actorName = actor?.displayName || actor?.username || "有人";
      prisma.notification.create({
        data: {
          type: "FOLLOW",
          title: "新关注者",
          body: `${actorName} 关注了你`,
          userId: targetUser.id,
          actorId: currentUserId,
          link: `/user/${actor?.username || currentUserId}`,
        },
      }).catch(() => {}); // fire-and-forget
    }

    // Get updated follower count
    const followerCount = await prisma.follow.count({
      where: { followingId: targetUser.id },
    });

    return NextResponse.json({
      username,
      isFollowing,
      followerCount,
    });
  } catch (error) {
    console.error("Follow toggle error:", error);
    return NextResponse.json(
      { error: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
