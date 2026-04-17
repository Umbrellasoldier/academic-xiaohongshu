import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadAvatar, deleteOldAvatar } from "@/lib/supabase-storage";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const targetType = formData.get("type") as string; // "user" | "room"
    const targetId = formData.get("targetId") as string;

    if (!file || !targetType || !targetId) {
      return NextResponse.json(
        { error: "缺少文件或参数" },
        { status: 400 }
      );
    }

    // 3. Validate file
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "不支持的图片格式，仅支持 JPEG、PNG、WebP、GIF" },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "文件过大，最大支持 2MB" },
        { status: 400 }
      );
    }

    // 4. Authorization check
    if (targetType === "user") {
      if (targetId !== userId) {
        return NextResponse.json({ error: "无权操作" }, { status: 403 });
      }
    } else if (targetType === "room") {
      // Check if user is OWNER of this room
      const membership = await prisma.roomMember.findUnique({
        where: { userId_roomId: { userId, roomId: targetId } },
        select: { role: true },
      });
      if (!membership || membership.role !== "OWNER") {
        return NextResponse.json(
          { error: "仅房主可以修改研讨室头像" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "无效的 type 参数" },
        { status: 400 }
      );
    }

    // 5. Get old avatar URL for cleanup
    let oldAvatarUrl: string | null = null;
    if (targetType === "user") {
      const user = await prisma.user.findUnique({
        where: { id: targetId },
        select: { avatar: true },
      });
      oldAvatarUrl = user?.avatar ?? null;
    } else {
      const room = await prisma.discussionRoom.findUnique({
        where: { id: targetId },
        select: { avatarUrl: true },
      });
      oldAvatarUrl = room?.avatarUrl ?? null;
    }

    // 6. Upload to Supabase Storage
    const publicUrl = await uploadAvatar(
      file,
      targetType === "user"
        ? { type: "user", userId: targetId }
        : { type: "room", roomId: targetId }
    );

    // 7. Update DB
    if (targetType === "user") {
      await prisma.user.update({
        where: { id: targetId },
        data: { avatar: publicUrl, image: publicUrl }, // keep synced
      });
    } else {
      await prisma.discussionRoom.update({
        where: { id: targetId },
        data: { avatarUrl: publicUrl },
      });
    }

    // 8. Cleanup old file (best-effort, after successful DB update)
    if (oldAvatarUrl?.includes("supabase.co/storage")) {
      deleteOldAvatar(oldAvatarUrl).catch(() => {});
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "上传失败，请稍后重试" },
      { status: 500 }
    );
  }
}
