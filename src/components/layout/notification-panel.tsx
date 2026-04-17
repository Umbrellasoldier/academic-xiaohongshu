"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Bell,
  MessageCircle,
  Heart,
  UserPlus,
  MessageSquare,
  Info,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { NotificationData } from "@/types";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const typeIcon: Record<NotificationData["type"], typeof Bell> = {
  COMMENT: MessageCircle,
  LIKE: Heart,
  FOLLOW: UserPlus,
  ROOM_MESSAGE: MessageSquare,
  SYSTEM: Info,
};

const typeColor: Record<NotificationData["type"], string> = {
  COMMENT: "text-blue-500",
  LIKE: "text-red-500",
  FOLLOW: "text-green-500",
  ROOM_MESSAGE: "text-purple-500",
  SYSTEM: "text-amber-500",
};

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const { data, mutate } = useSWR<{
    notifications: NotificationData[];
    unreadCount: number;
  }>("/api/notifications", fetcher, {
    refreshInterval: 30000, // Poll every 30s
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleMarkAllRead = useCallback(async () => {
    setIsMarkingAll(true);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      // Optimistic update
      mutate(
        {
          notifications: notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        },
        false
      );
    } catch {
      // ignore
    } finally {
      setIsMarkingAll(false);
    }
  }, [notifications, mutate]);

  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "markRead", notificationId }),
        });
        mutate(
          {
            notifications: notifications.map((n) =>
              n.id === notificationId ? { ...n, isRead: true } : n
            ),
            unreadCount: Math.max(0, unreadCount - 1),
          },
          false
        );
      } catch {
        // ignore
      }
    },
    [notifications, unreadCount, mutate]
  );

  return (
    <div className="relative">
      {/* Bell trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-xl border bg-popover shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">通知</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={isMarkingAll}
                    className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {isMarkingAll ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    全部已读
                  </button>
                )}
              </div>
            </div>

            {/* Notification list */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="mx-auto h-8 w-8 text-muted-foreground/30" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    暂无通知
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const Icon = typeIcon[notification.type];
                  const iconColor = typeColor[notification.type];

                  const content = (
                    <div
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                        !notification.isRead && "bg-primary/5"
                      )}
                      onClick={() => {
                        if (!notification.isRead) {
                          handleMarkRead(notification.id);
                        }
                        setIsOpen(false);
                      }}
                    >
                      {/* Icon or Avatar */}
                      {notification.actor ? (
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            <AvatarImage
                              src={notification.actor.avatar || undefined}
                            />
                            <AvatarFallback className="text-xs">
                              {notification.actor.displayName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={cn(
                              "absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-background",
                              iconColor
                            )}
                          >
                            <Icon className="h-2.5 w-2.5" />
                          </div>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted",
                            iconColor
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-xs leading-relaxed line-clamp-2",
                            !notification.isRead
                              ? "text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {notification.body}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatTimeAgo(notification.createdAt)}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!notification.isRead && (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                  );

                  if (notification.link) {
                    return (
                      <Link
                        key={notification.id}
                        href={notification.link}
                        className="block"
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <div key={notification.id} className="cursor-pointer">
                      {content}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}
