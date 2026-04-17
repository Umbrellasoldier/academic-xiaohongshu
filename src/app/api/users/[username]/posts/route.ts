import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/users/[username]/posts — Get user's posts or bookmarks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
  const type = searchParams.get("type") || "posts"; // posts | bookmarks

  try {
    // Resolve user id from username
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
    }

    const postSelect = {
      id: true,
      title: true,
      summary: true,
      coverImage: true,
      createdAt: true,
      author: {
        select: {
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
      _count: {
        select: {
          comments: true,
          likes: true,
        },
      },
    } as const;

    if (type === "bookmarks") {
      // Get bookmarked posts
      const where: Record<string, unknown> = {
        userId: user.id,
      };
      if (cursor) {
        where.id = { lt: cursor };
      }

      const bookmarks = await prisma.bookmark.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          post: { select: postSelect },
        },
      });

      const posts = bookmarks.map((b) => ({
        id: b.post.id,
        title: b.post.title,
        summary: b.post.summary,
        coverImage: b.post.coverImage,
        createdAt: b.post.createdAt.toISOString(),
        subject: b.post.subject,
        author: {
          username: b.post.author.username,
          displayName: b.post.author.displayName || b.post.author.username,
          avatar: b.post.author.avatar || b.post.author.image,
        },
        likeCount: b.post._count.likes,
        commentCount: b.post._count.comments,
      }));

      const nextCursor =
        bookmarks.length === limit
          ? bookmarks[bookmarks.length - 1]?.id
          : null;

      return NextResponse.json({
        posts,
        nextCursor,
        total: posts.length,
      });
    }

    // Default: user's own posts
    const where: Record<string, unknown> = {
      authorId: user.id,
      status: "PUBLISHED",
    };
    if (cursor) {
      where.id = { lt: cursor };
    }

    const dbPosts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: postSelect,
    });

    const posts = dbPosts.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      coverImage: p.coverImage,
      createdAt: p.createdAt.toISOString(),
      subject: p.subject,
      author: {
        username: p.author.username,
        displayName: p.author.displayName || p.author.username,
        avatar: p.author.avatar || p.author.image,
      },
      likeCount: p._count.likes,
      commentCount: p._count.comments,
    }));

    const nextCursor =
      posts.length === limit ? posts[posts.length - 1]?.id : null;

    return NextResponse.json({
      posts,
      nextCursor,
      total: posts.length,
    });
  } catch (error) {
    console.error("Get user posts error:", error);
    return NextResponse.json(
      { error: "获取用户帖子失败" },
      { status: 500 }
    );
  }
}
