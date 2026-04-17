import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/posts/[id]/bookmark — Toggle bookmark on a post
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

    // Check if already bookmarked
    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_postId: { userId, postId: id },
      },
    });

    if (existing) {
      // Remove bookmark
      await prisma.bookmark.delete({
        where: { id: existing.id },
      });
    } else {
      // Add bookmark
      await prisma.bookmark.create({
        data: { userId, postId: id },
      });
    }

    // Get updated count
    const bookmarkCount = await prisma.bookmark.count({
      where: { postId: id },
    });

    return NextResponse.json({
      bookmarked: !existing,
      bookmarkCount,
      postId: id,
    });
  } catch (error) {
    console.error("Toggle bookmark error:", error);
    return NextResponse.json(
      { error: "操作失败" },
      { status: 500 }
    );
  }
}
