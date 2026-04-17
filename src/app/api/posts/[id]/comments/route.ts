import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/posts/[id]/comments — Get comments for a post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await auth();
    const userId = session?.user?.id;

    // Fetch top-level comments with one level of replies
    const comments = await prisma.comment.findMany({
      where: {
        postId: id,
        parentId: null,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        parentId: true,
        author: {
          select: {
            username: true,
            displayName: true,
            avatar: true,
            image: true,
          },
        },
        _count: { select: { likes: true } },
        ...(userId
          ? {
              likes: {
                where: { userId },
                select: { id: true },
                take: 1,
              },
            }
          : {}),
        replies: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
            parentId: true,
            author: {
              select: {
                username: true,
                displayName: true,
                avatar: true,
                image: true,
              },
            },
            _count: { select: { likes: true } },
            ...(userId
              ? {
                  likes: {
                    where: { userId },
                    select: { id: true },
                    take: 1,
                  },
                }
              : {}),
          },
        },
      },
    });

    const formatted = comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      parentId: c.parentId,
      author: {
        username: c.author.username,
        displayName: c.author.displayName || c.author.username,
        avatar: c.author.avatar || c.author.image,
      },
      likeCount: c._count.likes,
      isLiked: userId
        ? ((c as Record<string, unknown>).likes as unknown[] | undefined)
            ?.length
          ? true
          : false
        : undefined,
      replies: c.replies.map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        parentId: r.parentId,
        author: {
          username: r.author.username,
          displayName: r.author.displayName || r.author.username,
          avatar: r.author.avatar || r.author.image,
        },
        likeCount: r._count.likes,
        isLiked: userId
          ? ((r as Record<string, unknown>).likes as unknown[] | undefined)
              ?.length
            ? true
            : false
          : undefined,
      })),
    }));

    return NextResponse.json({
      comments: formatted,
      total: formatted.length,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { error: "获取评论失败" },
      { status: 500 }
    );
  }
}

// POST /api/posts/[id]/comments — Create a comment
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

    const body = await request.json();
    const { content, parentId } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "评论内容不能为空" },
        { status: 400 }
      );
    }

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true },
    });

    if (!post) {
      return NextResponse.json(
        { error: "帖子不存在" },
        { status: 404 }
      );
    }

    // If replying, verify parent comment exists and belongs to this post
    let parentAuthorId: string | null = null;
    if (parentId) {
      const parentComment = await prisma.comment.findFirst({
        where: { id: parentId, postId: id },
        select: { id: true, authorId: true },
      });
      if (!parentComment) {
        return NextResponse.json(
          { error: "回复的评论不存在" },
          { status: 404 }
        );
      }
      parentAuthorId = parentComment.authorId;
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId: id,
        authorId: session.user.id,
        parentId: parentId || null,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        parentId: true,
        author: {
          select: {
            username: true,
            displayName: true,
            avatar: true,
            image: true,
          },
        },
      },
    });

    // Send notifications (fire-and-forget)
    const actorName = comment.author.displayName || comment.author.username;
    const snippet = comment.content.length > 30
      ? comment.content.slice(0, 30) + "..."
      : comment.content;

    // Notify post author about new comment (not self)
    if (post!.authorId !== session.user.id) {
      prisma.notification.create({
        data: {
          type: "COMMENT",
          title: "新评论",
          body: `${actorName} 评论了你的帖子「${post!.title}」：${snippet}`,
          userId: post!.authorId,
          actorId: session.user.id,
          link: `/post/${id}`,
        },
      }).catch(() => {});
    }

    // If replying, also notify parent comment author (not self, not already notified as post author)
    if (parentAuthorId && parentAuthorId !== session.user.id && parentAuthorId !== post!.authorId) {
      prisma.notification.create({
        data: {
          type: "COMMENT",
          title: "回复了你的评论",
          body: `${actorName} 回复了你在「${post!.title}」中的评论：${snippet}`,
          userId: parentAuthorId,
          actorId: session.user.id,
          link: `/post/${id}`,
        },
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        comment: {
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          parentId: comment.parentId,
          author: {
            username: comment.author.username,
            displayName:
              comment.author.displayName || comment.author.username,
            avatar: comment.author.avatar || comment.author.image,
          },
          likeCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "评论失败" },
      { status: 500 }
    );
  }
}
