import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Vercel serverless max duration (seconds)
export const maxDuration = 60;

// Stream configuration
const MAX_LIFETIME_MS = 30 * 60 * 1000; // 30 min max connection
const ACTIVE_POLL_MS = 3000; // 3s when active
const IDLE_POLL_MS = 5000; // 5s when idle
const IDLE_THRESHOLD_MS = 30 * 1000; // 30s no messages → idle
const LAST_ACTIVE_THROTTLE_MS = 30 * 1000; // write lastActiveAt every 30s max

// GET /api/rooms/[id]/stream — SSE stream for real-time messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Verify membership
  const membership = await prisma.roomMember.findUnique({
    where: { userId_roomId: { userId, roomId: id } },
    select: { id: true },
  });

  if (!membership) {
    return new Response("Forbidden", { status: 403 });
  }

  // Update lastActiveAt for online presence
  await prisma.roomMember.update({
    where: { userId_roomId: { userId, roomId: id } },
    data: { lastActiveAt: new Date() },
  }).catch(() => {});

  let lastTimestamp = new Date();
  let closed = false;
  const startTime = Date.now();
  let lastActivityTime = Date.now();
  let lastActiveAtWriteTime = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      const poll = async () => {
        if (closed) return;

        // Force reconnect after max lifetime
        if (Date.now() - startTime >= MAX_LIFETIME_MS) {
          controller.enqueue(
            encoder.encode(`event: reconnect\ndata: {}\n\n`)
          );
          controller.close();
          closed = true;
          return;
        }

        try {
          // Query new messages since last check
          const newMessages = await prisma.roomMessage.findMany({
            where: {
              roomId: id,
              createdAt: { gt: lastTimestamp },
            },
            orderBy: { createdAt: "asc" },
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

          if (newMessages.length > 0) {
            lastTimestamp = newMessages[newMessages.length - 1].createdAt;
            lastActivityTime = Date.now();

            for (const m of newMessages) {
              const data = JSON.stringify({
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
                      author: {
                        displayName:
                          m.replyTo.author.displayName || "用户",
                      },
                    }
                  : null,
              });

              controller.enqueue(
                encoder.encode(`event: message\ndata: ${data}\n\n`)
              );
            }
          }

          // Throttled lastActiveAt update (every 30s, not every 3s)
          const now = Date.now();
          if (now - lastActiveAtWriteTime >= LAST_ACTIVE_THROTTLE_MS) {
            lastActiveAtWriteTime = now;
            await prisma.roomMember.update({
              where: { userId_roomId: { userId, roomId: id } },
              data: { lastActiveAt: new Date() },
            }).catch(() => {});
          }

          // Send keepalive comment to prevent timeout
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // If there's an error, we'll try again next poll
        }

        if (!closed) {
          const isIdle = Date.now() - lastActivityTime >= IDLE_THRESHOLD_MS;
          setTimeout(poll, isIdle ? IDLE_POLL_MS : ACTIVE_POLL_MS);
        }
      };

      // Start polling
      poll();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
