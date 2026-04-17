import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/rooms — List rooms with optional filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject");
  const joined = searchParams.get("joined");
  const q = searchParams.get("q");

  try {
    const session = await auth();
    const userId = session?.user?.id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (subject) {
      where.subject = { slug: subject };
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    if (joined === "true" && userId) {
      where.members = { some: { userId } };
    }

    const dbRooms = await prisma.discussionRoom.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        avatarUrl: true,
        isPublic: true,
        createdAt: true,
        subject: {
          select: { id: true, name: true, nameZh: true, slug: true, color: true, icon: true },
        },
        _count: { select: { members: true, messages: true } },
        members: userId
          ? { where: { userId }, select: { id: true } }
          : false,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            content: true,
            createdAt: true,
            author: { select: { displayName: true } },
          },
        },
      },
    });

    const rooms = dbRooms.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      avatarUrl: r.avatarUrl,
      subject: r.subject,
      memberCount: r._count.members,
      isPublic: r.isPublic,
      isMember: userId ? (r.members as { id: string }[]).length > 0 : false,
      lastMessage: r.messages[0]
        ? {
            content: r.messages[0].content,
            createdAt: r.messages[0].createdAt.toISOString(),
            author: r.messages[0].author.displayName || "用户",
          }
        : null,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("List rooms error:", error);
    return NextResponse.json(
      { error: "获取研讨室列表失败" },
      { status: 500 }
    );
  }
}

// POST /api/rooms — Create a new room
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, subjectSlug, isPublic = true } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: "研讨室名称至少需要2个字符" },
        { status: 400 }
      );
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { error: "研讨室名称不能超过50个字符" },
        { status: 400 }
      );
    }

    // Resolve subject
    let subjectId: string | null = null;
    if (subjectSlug) {
      const subject = await prisma.subject.findUnique({
        where: { slug: subjectSlug },
        select: { id: true },
      });
      subjectId = subject?.id || null;
    }

    // Create room + add creator as OWNER
    const room = await prisma.discussionRoom.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        subjectId,
        isPublic,
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        avatarUrl: true,
        isPublic: true,
        createdAt: true,
        subject: {
          select: { id: true, name: true, nameZh: true, slug: true, color: true, icon: true },
        },
      },
    });

    return NextResponse.json({
      room: {
        ...room,
        memberCount: 1,
        isMember: true,
        lastMessage: null,
        createdAt: room.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Create room error:", error);
    return NextResponse.json({ error: "创建研讨室失败" }, { status: 500 });
  }
}
