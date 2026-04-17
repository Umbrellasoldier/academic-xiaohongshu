import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/rooms/[id]/requests — List pending join requests (OWNER only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check OWNER permission
    const membership = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId: id } },
      select: { role: true },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "仅房主可查看加入申请" },
        { status: 403 }
      );
    }

    const requests = await prisma.roomJoinRequest.findMany({
      where: { roomId: id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        message: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        user: {
          id: r.user.id,
          username: r.user.username,
          displayName: r.user.displayName || r.user.username,
          avatar: r.user.avatar || r.user.image,
        },
      })),
    });
  } catch (error) {
    console.error("Get join requests error:", error);
    return NextResponse.json(
      { error: "获取申请列表失败" },
      { status: 500 }
    );
  }
}

// POST /api/rooms/[id]/requests — Approve or reject a join request (OWNER only)
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

    const userId = session.user.id;

    // Check OWNER permission
    const membership = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId: id } },
      select: { role: true },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json(
        { error: "仅房主可审批加入申请" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { requestId, action } = body;

    if (!requestId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    // Find the request
    const joinRequest = await prisma.roomJoinRequest.findFirst({
      where: { id: requestId, roomId: id, status: "PENDING" },
      select: { id: true, userId: true },
    });

    if (!joinRequest) {
      return NextResponse.json(
        { error: "申请不存在或已处理" },
        { status: 404 }
      );
    }

    if (action === "approve") {
      // Add user as member + update request status
      await prisma.$transaction([
        prisma.roomMember.upsert({
          where: {
            userId_roomId: {
              userId: joinRequest.userId,
              roomId: id,
            },
          },
          update: {},
          create: {
            userId: joinRequest.userId,
            roomId: id,
            role: "MEMBER",
          },
        }),
        prisma.roomJoinRequest.update({
          where: { id: requestId },
          data: { status: "APPROVED" },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: "已通过申请",
        action: "approve",
      });
    } else {
      // Reject
      await prisma.roomJoinRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" },
      });

      return NextResponse.json({
        success: true,
        message: "已拒绝申请",
        action: "reject",
      });
    }
  } catch (error) {
    console.error("Handle join request error:", error);
    return NextResponse.json(
      { error: "操作失败" },
      { status: 500 }
    );
  }
}
