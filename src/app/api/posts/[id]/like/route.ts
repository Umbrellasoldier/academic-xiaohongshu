import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/posts/[id]/like — Toggle like on a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "请先登录" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check if already liked
    const existing = await prisma.like.findUnique({
      where: {
        userId_postId: { userId, postId: id },
      },
    });

    if (existing) {
      // Unlike
      await prisma.like.delete({
        where: { id: existing.id },
      });
    } else {
      // Like
      await prisma.like.create({
        data: { userId, postId: id },
      });

      // Send notification to post author (not to self)
      const post = await prisma.post.findUnique({
        where: { id },
        select: { authorId: true, title: true },
      });
      if (post && post.authorId !== userId) {
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true, username: true },
        });
        const actorName = actor?.displayName || actor?.username || "有人";
        prisma.notification.create({
          data: {
            type: "LIKE",
            title: "获得点赞",
            body: `${actorName} 赞了你的帖子「${post.title}」`,
            userId: post.authorId,
            actorId: userId,
            link: `/post/${id}`,
          },
        }).catch(() => {}); // fire-and-forget
      }
    }

    // Get updated count
    const likeCount = await prisma.like.count({
      where: { postId: id },
    });

    return NextResponse.json({
      liked: !existing,
      likeCount,
      postId: id,
    });
  } catch (error) {
    console.error("Toggle like error:", error);
    return NextResponse.json(
      { error: "操作失败" },
      { status: 500 }
    );
  }
}
