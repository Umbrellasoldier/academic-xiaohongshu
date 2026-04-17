import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** Resolve a category slug to a subject filter, including children for level-1 subjects */
async function resolveSubjectFilter(
  category: string
): Promise<Record<string, unknown>> {
  const subject = await prisma.subject.findUnique({
    where: { slug: category },
    select: { id: true, children: { select: { slug: true } } },
  });

  if (subject && subject.children.length > 0) {
    // Level-1 subject — include itself + all children
    const slugs = [category, ...subject.children.map((c) => c.slug)];
    return { slug: { in: slugs } };
  }

  // Level-2 or no children — exact match
  return { slug: category };
}

// GET /api/posts — Get post list with pagination and filtering
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const feed = searchParams.get("feed");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
  const sort = searchParams.get("sort") || "recent";

  // Following feed — query real database
  if (feed === "following") {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "请先登录" },
          { status: 401 }
        );
      }

      const userId = session.user.id;

      // Get IDs of users the current user is following
      const follows = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });

      const followingIds = follows.map((f) => f.followingId);

      if (followingIds.length === 0) {
        return NextResponse.json({
          posts: [],
          nextCursor: null,
          total: 0,
        });
      }

      // Build query conditions
      const where: Record<string, unknown> = {
        authorId: { in: followingIds },
        status: "PUBLISHED",
      };

      if (category) {
        where.subject = await resolveSubjectFilter(category);
      }

      if (cursor) {
        where.id = { lt: cursor };
      }

      const orderBy =
        sort === "popular"
          ? { viewCount: "desc" as const }
          : { createdAt: "desc" as const };

      const dbPosts = await prisma.post.findMany({
        where,
        orderBy,
        take: limit,
        select: {
          id: true,
          title: true,
          summary: true,
          coverImage: true,
          createdAt: true,
          viewCount: true,
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

      const nextCursor =
        posts.length === limit ? posts[posts.length - 1]?.id : null;

      return NextResponse.json({
        posts,
        nextCursor,
        total: posts.length,
      });
    } catch (error) {
      console.error("Following feed error:", error);
      return NextResponse.json(
        { error: "获取关注动态失败" },
        { status: 500 }
      );
    }
  }

  // Default feed — real database query
  try {
    const session = await auth();
    const userId = session?.user?.id;

    // Build where clause
    const where: Record<string, unknown> = {
      status: "PUBLISHED",
    };

    if (category) {
      where.subject = await resolveSubjectFilter(category);
    }

    if (cursor) {
      where.id = { lt: cursor };
    }

    const orderBy =
      sort === "popular"
        ? { viewCount: "desc" as const }
        : { createdAt: "desc" as const };

    const dbPosts = await prisma.post.findMany({
      where,
      orderBy,
      take: limit,
      select: {
        id: true,
        title: true,
        summary: true,
        coverImage: true,
        createdAt: true,
        viewCount: true,
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
        // Conditionally check current user's like/bookmark status
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
      isLiked: userId
        ? ((p as Record<string, unknown>).likes as unknown[] | undefined)
            ?.length
          ? true
          : false
        : undefined,
      isBookmarked: userId
        ? ((p as Record<string, unknown>).bookmarks as unknown[] | undefined)
            ?.length
          ? true
          : false
        : undefined,
    }));

    const nextCursor =
      posts.length === limit ? posts[posts.length - 1]?.id : null;

    return NextResponse.json({
      posts,
      nextCursor,
      total: posts.length,
    });
  } catch (error) {
    console.error("Default feed error:", error);
    return NextResponse.json(
      { error: "获取帖子列表失败" },
      { status: 500 }
    );
  }
}

// POST /api/posts — Create a new post
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "请先登录" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, summary, coverImage, subjectId, status: postStatus, tagIds, citations } = body;

    // Basic validation
    if (!title?.trim()) {
      return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    }

    const isDraft = postStatus === "DRAFT";

    if (!subjectId) {
      return NextResponse.json({ error: "请选择学科分类" }, { status: 400 });
    }
    if (!isDraft && !content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    // Resolve subject by slug
    const subject = await prisma.subject.findUnique({
      where: { slug: subjectId },
      select: { id: true, name: true, nameZh: true, slug: true, color: true },
    });

    if (!subject) {
      return NextResponse.json({ error: "学科分类不存在" }, { status: 400 });
    }

    // Create post in database
    const post = await prisma.post.create({
      data: {
        title: title.trim(),
        content,
        summary: summary?.trim() || null,
        coverImage: coverImage || null,
        status: postStatus === "DRAFT" ? "DRAFT" : "PUBLISHED",
        authorId: session.user.id,
        subjectId: subject.id,
        // Save tags via connectOrCreate
        ...(Array.isArray(tagIds) && tagIds.length > 0
          ? {
              tags: {
                create: tagIds.slice(0, 5).map((name: string) => ({
                  tag: {
                    connectOrCreate: {
                      where: { name: name.trim() },
                      create: { name: name.trim() },
                    },
                  },
                })),
              },
            }
          : {}),
        // Save citations via connectOrCreate on Paper
        ...(Array.isArray(citations) && citations.length > 0
          ? {
              citations: {
                create: citations.map(
                  (c: Record<string, unknown>, i: number) => {
                    const hasDoi =
                      typeof c.doi === "string" && c.doi.trim() !== "";
                    const hasArxivId =
                      typeof c.arxivId === "string" &&
                      c.arxivId.trim() !== "";

                    const paperData = {
                      title: (c.title as string) || "Untitled",
                      authors: (c.authors as string[]) || [],
                      doi: hasDoi ? (c.doi as string) : null,
                      arxivId: hasArxivId ? (c.arxivId as string) : null,
                      abstract: (c.abstract as string) || null,
                      journal: (c.journal as string) || null,
                      year: (c.year as number) || null,
                      url: (c.url as string) || null,
                      citationCount: (c.citationCount as number) || null,
                    };

                    return {
                      order: (c.order as number) || i + 1,
                      context: (c.context as string) || null,
                      paper: hasDoi
                        ? {
                            connectOrCreate: {
                              where: { doi: c.doi as string },
                              create: paperData,
                            },
                          }
                        : hasArxivId
                          ? {
                              connectOrCreate: {
                                where: { arxivId: c.arxivId as string },
                                create: paperData,
                              },
                            }
                          : {
                              // No reliable dedup key → always create new paper
                              create: paperData,
                            },
                    };
                  }
                ),
              },
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        summary: true,
        coverImage: true,
        createdAt: true,
        subject: {
          select: { name: true, nameZh: true, slug: true, color: true },
        },
        author: {
          select: { username: true, displayName: true, avatar: true, image: true },
        },
      },
    });

    return NextResponse.json({
      post: {
        id: post.id,
        title: post.title,
        summary: post.summary,
        coverImage: post.coverImage,
        createdAt: post.createdAt.toISOString(),
        subject: post.subject,
        author: {
          username: post.author.username,
          displayName: post.author.displayName || post.author.username,
          avatar: post.author.avatar || post.author.image,
        },
        likeCount: 0,
        commentCount: 0,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json(
      { error: "创建帖子失败" },
      { status: 500 }
    );
  }
}
