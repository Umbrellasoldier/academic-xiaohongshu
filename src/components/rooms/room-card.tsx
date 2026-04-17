"use client";

import Link from "next/link";
import { Users, Lock, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SubjectBadge } from "@/components/academic/subject-badge";
import type { RoomData } from "@/types";

interface RoomCardProps {
  room: RoomData;
}

export function RoomCard({ room }: RoomCardProps) {
  return (
    <Link
      href={`/rooms/${room.id}`}
      className="group block rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/30"
    >
      <div className="flex items-start gap-3">
        {/* Room Avatar */}
        {room.avatarUrl ? (
          <Avatar className="h-12 w-12 shrink-0 rounded-lg">
            <AvatarImage src={room.avatarUrl} alt={room.name} className="rounded-lg" />
            <AvatarFallback
              className="rounded-lg text-white text-lg font-bold"
              style={{ backgroundColor: room.subject?.color || "#6B7280" }}
            >
              {room.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white text-lg font-bold"
            style={{
              backgroundColor: room.subject?.color || "#6B7280",
            }}
          >
            {room.name.charAt(0)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Name + Privacy */}
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold group-hover:text-primary">
              {room.name}
            </h3>
            {!room.isPublic && (
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </div>

          {/* Description */}
          {room.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {room.description}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {room.subject && (
              <SubjectBadge subject={room.subject} size="sm" />
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {room.memberCount} 成员
            </span>
            {room.isMember && (
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                已加入
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Last message */}
      {room.lastMessage && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-2">
          <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium">
              {room.lastMessage.author}：
            </span>
            <span className="text-xs text-muted-foreground line-clamp-1">
              {room.lastMessage.content}
            </span>
          </div>
        </div>
      )}
    </Link>
  );
}

export function RoomCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
