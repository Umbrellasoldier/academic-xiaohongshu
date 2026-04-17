import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod/v4";

const updateRoomSchema = z.object({
  name: z.string().min(2, "名称至少2个字符").max(50).optional(),
  description: z.string().max(500).optional(),
});

// GET /api/rooms/[id] — Room detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await auth();
    const userId = session?.user?.id;

    const dbRoom = await prisma.discussionRoom.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        avatarUrl: true,
        isPublic: true,
        maxMembers: true,
        createdAt: true,
        subject: {
          select: { id: true, name: true, nameZh: true, slug: true, color: true, icon: true },
        },
        _count: { select: { members: true } },
        members: {
          select: {
            user: {
              select: { id: true, username: true, displayName: true, avatar: true, image: true },
            },
            role: true,
            joinedAt: true,
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!dbRoom) {
      return NextResponse.json({ error: "研讨室不存在" }, { status: 404 });
    }

    const isMember = userId
      ? dbRoom.members.some((m) => m.user.id === userId)
      : false;

    // Update lastActiveAt for current user (they're viewing the room)
    if (userId && isMember) {
      await prisma.roomMember.update({
        where: { userId_roomId: { userId, roomId: id } },
        data: { lastActiveAt: new Date() },
      }).catch(() => {}); // best-effort, don't block response
    }

    // Count members active in the last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineCount = await prisma.roomMember.count({
      where: { roomId: id, lastActiveAt: { gte: fiveMinAgo } },
    });

    const room = {
      id: dbRoom.id,
      name: dbRoom.name,
      description: dbRoom.description,
      avatarUrl: dbRoom.avatarUrl,
      subject: dbRoom.subject,
      memberCount: dbRoom._count.members,
      onlineCount,
      isPublic: dbRoom.isPublic,
      maxMembers: dbRoom.maxMembers,
      isMember,
      createdAt: dbRoom.createdAt.toISOString(),
      members: dbRoom.members.map((m) => ({
        id: m.user.id,
        username: m.user.username,
        displayName: m.user.displayName || m.user.username,
        avatar: m.user.avatar || m.user.image,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };

    return NextResponse.json({ room });
  } catch (error) {
    console.error("Get room detail error:", error);
    return NextResponse.json({ error: "获取研讨室详情失败" }, { status: 500 });
  }
}

// POST /api/rooms/[id] — Join/leave room
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
    const { action } = body;
    const userId = session.user.id;

    if (action === "join") {
      // Single query: existence + room details
      const room = await prisma.discussionRoom.findUnique({
        where: { id },
        select: { id: true, isPublic: true, maxMembers: true, _count: { select: { members: true } } },
      });

      if (!room) {
        return NextResponse.json({ error: "研讨室不存在" }, { status: 404 });
      }

      // Check member limit
      if (room.maxMembers && room._count.members >= room.maxMembers) {
        return NextResponse.json(
          { error: "研讨室已满员" },
          { status: 400 }
        );
      }

      if (!room.isPublic) {
        // Private room — create a join request instead of direct join
        // Check if already a member
        const existingMember = await prisma.roomMember.findUnique({
          where: { userId_roomId: { userId, roomId: id } },
          select: { id: true },
        });

        if (existingMember) {
          return NextResponse.json({
            success: true,
            message: "你已是成员",
            isMember: true,
          });
        }

        // Rejection cooldown: block re-application for 24h after REJECTED
        const existingRequest = await prisma.roomJoinRequest.findUnique({
          where: { userId_roomId: { userId, roomId: id } },
          select: { status: true, updatedAt: true },
        });

        if (existingRequest?.status === "REJECTED") {
          const cooldownMs = 24 * 60 * 60 * 1000;
          const elapsed = Date.now() - existingRequest.updatedAt.getTime();
          if (elapsed < cooldownMs) {
            const hoursLeft = Math.ceil(
              (cooldownMs - elapsed) / (60 * 60 * 1000)
            );
            return NextResponse.json(
              {
                error: `申请已被拒绝，请等待${hoursLeft}小时后再次申请`,
              },
              { status: 400 }
            );
          }
        }

        // Upsert join request
        await prisma.roomJoinRequest.upsert({
          where: { userId_roomId: { userId, roomId: id } },
          update: { status: "PENDING", message: body.message || null },
          create: {
            userId,
            roomId: id,
            status: "PENDING",
            message: body.message || null,
          },
        });

        return NextResponse.json({
          success: true,
          message: "已提交加入申请，等待房主审批",
          pending: true,
          isMember: false,
        });
      }

      // Public room — direct join
      await prisma.roomMember.upsert({
        where: { userId_roomId: { userId, roomId: id } },
        update: {},
        create: { userId, roomId: id, role: "MEMBER" },
      });

      return NextResponse.json({
        success: true,
        message: "已加入研讨室",
        isMember: true,
      });
    }

    if (action === "leave") {
      // Don't allow OWNER to leave
      const membership = await prisma.roomMember.findUnique({
        where: { userId_roomId: { userId, roomId: id } },
        select: { role: true },
      });

      if (membership?.role === "OWNER") {
        return NextResponse.json(
          { error: "房主不能退出研讨室" },
          { status: 400 }
        );
      }

      await prisma.roomMember.deleteMany({
        where: { userId, roomId: id },
      });

      return NextResponse.json({
        success: true,
        message: "已退出研讨室",
        isMember: false,
      });
    }

    return NextResponse.json({ error: "无效操作" }, { status: 400 });
  } catch (error) {
    console.error("Room join/leave error:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}

// PATCH /api/rooms/[id] — Update room settings (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check OWNER permission via RoomMember
    const membership = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId: id } },
      select: { role: true },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "仅房主可以修改研讨室设置" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "参数无效", details: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const updateData: { name?: string; description?: string | null } = {};
    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name.trim();
    }
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 });
    }

    const updated = await prisma.discussionRoom.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, description: true, avatarUrl: true },
    });

    return NextResponse.json({ room: updated });
  } catch (error) {
    console.error("Update room error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
