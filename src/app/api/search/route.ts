import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/search — Search posts and users
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type") || "posts";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

  if (!q) {
    return NextResponse.json(
      { error: "搜索关键词不能为空" },
      { status: 400 }
    );
  }

  if (type === "posts") {
    try {
      const dbPosts = await prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { subject: { nameZh: { contains: q, mode: "insensitive" } } },
            { subject: { name: { contains: q, mode: "insensitive" } } },
            { author: { displayName: { contains: q, mode: "insensitive" } } },
            { author: { username: { contains: q, mode: "insensitive" } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
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
        },
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

      return NextResponse.json({
        posts,
        total: posts.length,
        query: q,
      });
    } catch (error) {
      console.error("Search posts error:", error);
      return NextResponse.json(
        { error: "搜索失败" },
        { status: 500 }
      );
    }
  }

  if (type === "users") {
    try {
      const dbUsers = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          image: true,
          bio: true,
          institution: true,
          _count: { select: { posts: true } },
        },
        take: limit,
      });

      const results = dbUsers.map((u) => ({
        id: u.id,
        username: u.username || u.id,
        displayName: u.displayName || u.username || "用户",
        avatar: u.avatar || u.image || null,
        bio: u.bio || null,
        institution: u.institution || null,
        postCount: u._count.posts,
      }));

      return NextResponse.json({
        users: results,
        total: results.length,
        query: q,
      });
    } catch (error) {
      console.error("Search users error:", error);
      return NextResponse.json(
        { error: "搜索失败" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "不支持的搜索类型" }, { status: 400 });
}
