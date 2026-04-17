import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// DELETE /api/posts/[id] — Delete a post (author only)
export async function DELETE(
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

    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: "帖子不存在" },
        { status: 404 }
      );
    }

    if (post.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "无权删除他人的帖子" },
        { status: 403 }
      );
    }

    await prisma.post.delete({
      where: { id },
    });

    return NextResponse.json({ message: "帖子已删除" });
  } catch (error) {
    console.error("Delete post error:", error);
    return NextResponse.json(
      { error: "删除帖子失败" },
      { status: 500 }
    );
  }
}

// GET /api/posts/[id] — Get post detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await auth();
    const userId = session?.user?.id;

    const dbPost = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        summary: true,
        coverImage: true,
        images: true,
        viewCount: true,
        createdAt: true,
        aiSummary: true,
        aiTranslation: true,
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            image: true,
          },
        },
        subject: {
          select: {
            name: true,
            nameZh: true,
            slug: true,
            color: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: { id: true, name: true },
            },
          },
        },
        citations: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            context: true,
            order: true,
            paper: {
              select: {
                id: true,
                doi: true,
                arxivId: true,
                title: true,
                authors: true,
                abstract: true,
                journal: true,
                year: true,
                url: true,
                citationCount: true,
              },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
            bookmarks: true,
          },
        },
        // Check current user's like/bookmark status
        ...(userId
          ? {
              likes: {
                where: { userId },
                select: { id: true },
                take: 1,
              },
              bookmarks: {
                where: { userId },
                select: { id: true },
                take: 1,
              },
            }
          : {}),
      },
    });

    if (!dbPost) {
      return NextResponse.json(
        { error: "帖子不存在" },
        { status: 404 }
      );
    }

    // Increment view count (fire-and-forget)
    prisma.post
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    // Check if current user follows the post author
    let isFollowingAuthor: boolean | undefined = undefined;
    if (userId && userId !== dbPost.author.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: dbPost.author.id,
          },
        },
        select: { id: true },
      });
      isFollowingAuthor = !!follow;
    }

    const post = {
      id: dbPost.id,
      title: dbPost.title,
      content: dbPost.content,
      summary: dbPost.summary,
      coverImage: dbPost.coverImage,
      images: dbPost.images,
      viewCount: dbPost.viewCount,
      createdAt: dbPost.createdAt.toISOString(),
      subject: dbPost.subject,
      author: {
        id: dbPost.author.id,
        username: dbPost.author.username,
        displayName: dbPost.author.displayName || dbPost.author.username,
        avatar: dbPost.author.avatar || dbPost.author.image,
        isFollowing: isFollowingAuthor,
      },
      tags: dbPost.tags.map((t) => t.tag),
      likeCount: dbPost._count.likes,
      commentCount: dbPost._count.comments,
      bookmarkCount: dbPost._count.bookmarks,
      isLiked: userId
        ? ((dbPost as Record<string, unknown>).likes as unknown[] | undefined)
            ?.length
          ? true
          : false
        : undefined,
      isBookmarked: userId
        ? (
            (dbPost as Record<string, unknown>)
              .bookmarks as unknown[] | undefined
          )?.length
          ? true
          : false
        : undefined,
      citations: dbPost.citations.map((c) => ({
        id: c.id,
        context: c.context,
        order: c.order,
        paper: {
          ...c.paper,
          authors: c.paper.authors as { name: string; affiliation?: string; orcid?: string }[],
        },
      })),
      aiSummary: dbPost.aiSummary,
      aiTranslation: dbPost.aiTranslation as Record<string, unknown> | null,
    };

    return NextResponse.json({ post });
  } catch (error) {
    console.error("Get post detail error:", error);
    return NextResponse.json(
      { error: "获取帖子详情失败" },
      { status: 500 }
    );
  }
}
