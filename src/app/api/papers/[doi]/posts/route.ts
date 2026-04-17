import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/papers/[doi]/posts — Get posts that cite this paper
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ doi: string }> }
) {
  const { doi: rawDoi } = await params;
  const doi = decodeURIComponent(rawDoi);

  try {
    // Find the paper by DOI
    const paper = await prisma.paper.findUnique({
      where: { doi },
      select: { id: true },
    });

    if (!paper) {
      return NextResponse.json({ posts: [] });
    }

    // Find posts that cite this paper (only published)
    const citations = await prisma.postCitation.findMany({
      where: { paperId: paper.id, post: { status: "PUBLISHED" } },
      select: {
        post: {
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
        },
      },
      orderBy: { post: { createdAt: "desc" } },
    });

    // Map to clean DTOs
    const posts = citations.map((c) => ({
        id: c.post.id,
        title: c.post.title,
        summary: c.post.summary,
        coverImage: c.post.coverImage,
        createdAt: c.post.createdAt.toISOString(),
        subject: c.post.subject,
        author: {
          username: c.post.author.username,
          displayName: c.post.author.displayName || c.post.author.username,
          avatar: c.post.author.avatar || c.post.author.image,
        },
        likeCount: c.post._count.likes,
        commentCount: c.post._count.comments,
      }));

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Get paper posts error:", error);
    return NextResponse.json(
      { error: "获取相关笔记失败" },
      { status: 500 }
    );
  }
}
