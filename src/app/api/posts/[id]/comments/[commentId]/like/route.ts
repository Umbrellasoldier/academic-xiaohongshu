import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/posts/[id]/comments/[commentId]/like — Toggle like on a comment
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "请先登录" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Verify comment exists and belongs to this post
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, postId: id },
      select: { id: true, authorId: true },
    });

    if (!comment) {
      return NextResponse.json(
        { error: "评论不存在" },
        { status: 404 }
      );
    }

    // Check if already liked
    const existing = await prisma.commentLike.findUnique({
      where: {
        userId_commentId: { userId, commentId },
      },
    });

    if (existing) {
      // Unlike
      await prisma.commentLike.delete({
        where: { id: existing.id },
      });
    } else {
      // Like
      await prisma.commentLike.create({
        data: { userId, commentId },
      });
    }

    // Get updated count
    const likeCount = await prisma.commentLike.count({
      where: { commentId },
    });

    return NextResponse.json({
      liked: !existing,
      likeCount,
      commentId,
    });
  } catch (error) {
    console.error("Toggle comment like error:", error);
    return NextResponse.json(
      { error: "操作失败" },
      { status: 500 }
    );
  }
}
