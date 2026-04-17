import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/notifications — List notifications for current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          isRead: true,
          link: true,
          createdAt: true,
          actor: {
            select: {
              username: true,
              displayName: true,
              avatar: true,
              image: true,
            },
          },
        },
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
        actor: n.actor
          ? {
              username: n.actor.username,
              displayName: n.actor.displayName || n.actor.username,
              avatar: n.actor.avatar || n.actor.image,
            }
          : null,
        link: n.link,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "获取通知失败" },
      { status: 500 }
    );
  }
}

// POST /api/notifications — Mark as read
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { action, notificationId } = body;

    if (action === "markAllRead") {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({
        success: true,
        message: "所有通知已标记为已读",
      });
    }

    if (action === "markRead" && notificationId) {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true },
      });
      return NextResponse.json({
        success: true,
        message: "通知已标记为已读",
      });
    }

    return NextResponse.json({ error: "无效操作" }, { status: 400 });
  } catch (error) {
    console.error("Update notification error:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
