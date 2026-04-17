import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/rooms/[id]/messages — Get room messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { roomId: id };

    if (cursor) {
      const cursorMsg = await prisma.roomMessage.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      if (cursorMsg) {
        where.createdAt = { lt: cursorMsg.createdAt };
      }
    }

    const dbMessages = await prisma.roomMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: {
        id: true,
        content: true,
        type: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            image: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            author: {
              select: { displayName: true },
            },
          },
        },
      },
    });

    const hasMore = dbMessages.length > limit;
    const messages = dbMessages.slice(0, limit).reverse(); // oldest first

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        type: m.type,
        createdAt: m.createdAt.toISOString(),
        author: {
          id: m.author.id,
          username: m.author.username,
          displayName: m.author.displayName || m.author.username,
          avatar: m.author.avatar || m.author.image,
        },
        replyTo: m.replyTo
          ? {
              id: m.replyTo.id,
              content: m.replyTo.content,
              author: { displayName: m.replyTo.author.displayName || "用户" },
            }
          : null,
      })),
      nextCursor: hasMore ? dbMessages[dbMessages.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("Get room messages error:", error);
    return NextResponse.json(
      { error: "获取消息失败" },
      { status: 500 }
    );
  }
}

// POST /api/rooms/[id]/messages — Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { content, type = "TEXT", replyToId } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "消息内容不能为空" },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: "消息长度不能超过5000字符" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Check membership
    const membership = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId: id } },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "请先加入研讨室" },
        { status: 403 }
      );
    }

    // Validate replyToId if provided
    let replyToIdValue: string | null = null;
    if (replyToId) {
      const replyMsg = await prisma.roomMessage.findUnique({
        where: { id: replyToId },
        select: { id: true },
      });
      if (replyMsg) {
        replyToIdValue = replyMsg.id;
      }
    }

    // Create message in database
    const message = await prisma.roomMessage.create({
      data: {
        content: content.trim(),
        type,
        authorId: userId,
        roomId: id,
        replyToId: replyToIdValue,
      },
      select: {
        id: true,
        content: true,
        type: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            image: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            author: { select: { displayName: true } },
          },
        },
      },
    });

    // Update lastActiveAt for the sender (best-effort)
    await prisma.roomMember.update({
      where: { userId_roomId: { userId, roomId: id } },
      data: { lastActiveAt: new Date() },
    }).catch(() => {});

    return NextResponse.json({
      message: {
        id: message.id,
        content: message.content,
        type: message.type,
        createdAt: message.createdAt.toISOString(),
        author: {
          id: message.author.id,
          username: message.author.username,
          displayName: message.author.displayName || message.author.username,
          avatar: message.author.avatar || message.author.image,
        },
        replyTo: message.replyTo
          ? {
              id: message.replyTo.id,
              content: message.replyTo.content,
              author: { displayName: message.replyTo.author.displayName || "用户" },
            }
          : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "发送消息失败" },
      { status: 500 }
    );
  }
}
