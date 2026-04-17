"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Users,
  Lock,
  LogIn,
  LogOut,
  ChevronRight,
  PanelRightOpen,
  PanelRightClose,
  Settings,
  Check,
  X,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SubjectBadge } from "@/components/academic/subject-badge";
import { ChatMessages, ChatInput } from "@/components/rooms/chat-messages";
import { MemberList } from "@/components/rooms/member-list";
import { AvatarUpload } from "@/components/avatar-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { RoomDetail, RoomMessageData } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RoomDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [replyTo, setReplyTo] = useState<RoomMessageData | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [localMessages, setLocalMessages] = useState<RoomMessageData[]>([]);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editError, setEditError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"settings" | "requests">("settings");

  // Fetch room detail
  const {
    data: roomData,
    error: roomError,
    isLoading: roomLoading,
    mutate: mutateRoom,
  } = useSWR<{ room: RoomDetail }>(`/api/rooms/${params.id}`, fetcher);

  // Fetch messages — initial load only
  const [messages, setMessages] = useState<RoomMessageData[]>([]);
  const [msgLoading, setMsgLoading] = useState(true);
  const [msgError, setMsgError] = useState(false);

  // Initial fetch of messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/rooms/${params.id}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        } else {
          setMsgError(true);
        }
      } catch {
        setMsgError(true);
      } finally {
        setMsgLoading(false);
      }
    };
    fetchMessages();
  }, [params.id]);

  // SSE real-time connection (only if member)
  useEffect(() => {
    if (!isMember || isMember === null) return;

    const eventSource = new EventSource(`/api/rooms/${params.id}/stream`);

    eventSource.addEventListener("message", (event) => {
      try {
        const newMsg: RoomMessageData = JSON.parse(event.data);
        setMessages((prev) => {
          // Deduplicate — don't add if already present
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          // Also remove matching local optimistic messages
          const filtered = prev.filter(
            (m) => !m.id.startsWith("local-")
          );
          return [...filtered, newMsg];
        });
      } catch {
        // ignore malformed events
      }
    });

    eventSource.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [params.id, isMember]);

  const room = roomData?.room;

  // Check if current user is OWNER
  const currentUserId = session?.user?.id;
  const isOwner =
    currentUserId && room
      ? room.members.some(
          (m) => m.id === currentUserId && m.role === "OWNER"
        )
      : false;

  // Sync isMember from room data on first load
  useEffect(() => {
    if (room && isMember === null) {
      setIsMember(room.isMember ?? false);
    }
  }, [room, isMember]);

  // Sync settings form when dialog opens
  useEffect(() => {
    if (settingsOpen && room) {
      setEditName(room.name);
      setEditDesc(room.description || "");
      setEditError("");
    }
  }, [settingsOpen, room]);

  // Save room settings
  const handleSaveSettings = useCallback(async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      setEditError("名称至少需要2个字符");
      return;
    }
    setIsSavingSettings(true);
    setEditError("");
    try {
      const res = await fetch(`/api/rooms/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "更新失败");
      }
      setSettingsOpen(false);
      mutateRoom(); // refresh room data
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "更新失败，请稍后重试"
      );
    } finally {
      setIsSavingSettings(false);
    }
  }, [params.id, editName, editDesc, mutateRoom]);

  // Combine server messages with local optimistic messages
  const allMessages = [
    ...messages,
    ...localMessages,
  ];

  // Send message
  const handleSend = useCallback(
    async (content: string, type: string = "TEXT") => {
      // Optimistic add
      const optimisticMsg: RoomMessageData = {
        id: `local-${Date.now()}`,
        content,
        type: type as RoomMessageData["type"],
        createdAt: new Date().toISOString(),
        author: {
          id: "current-user",
          username: "current-user",
          displayName: "当前用户",
          avatar: null,
        },
        replyTo: replyTo
          ? {
              id: replyTo.id,
              content:
                replyTo.content.length > 50
                  ? replyTo.content.slice(0, 50) + "..."
                  : replyTo.content,
              author: { displayName: replyTo.author.displayName },
            }
          : null,
      };

      setLocalMessages((prev) => [...prev, optimisticMsg]);
      setReplyTo(null);

      try {
        await fetch(`/api/rooms/${params.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            type,
            replyToId: replyTo?.id || null,
          }),
        });
        // SSE will deliver the server-confirmed message, which will
        // replace the local optimistic message via deduplication logic
      } catch {
        // Keep optimistic message on failure
      }
    },
    [params.id, replyTo]
  );

  // Join / Leave room
  const handleJoinLeave = useCallback(async () => {
    setIsJoining(true);
    try {
      const action = isMember ? "leave" : "join";
      const res = await fetch(`/api/rooms/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.pending) {
          // Private room — join request submitted
          setJoinPending(true);
          toast.success("已提交加入申请，等待房主审批");
        } else {
          setIsMember(data.isMember);
          if (data.isMember) {
            mutateRoom();
          }
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "操作失败");
      }
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setIsJoining(false);
    }
  }, [params.id, isMember, mutateRoom]);

  // Loading state
  if (roomLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error / not found
  if (roomError || !room) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          研讨室不存在或已被关闭
        </p>
        <Link
          href="/rooms"
          className="mt-4 inline-flex items-center text-sm text-primary hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回研讨室列表
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Room Header */}
      <div className="flex items-center gap-3 border-b px-4 py-2.5">
        <Link
          href="/rooms"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {room.avatarUrl ? (
          <Avatar className="h-9 w-9 shrink-0 rounded-lg">
            <AvatarImage src={room.avatarUrl} alt={room.name} className="rounded-lg" />
            <AvatarFallback
              className="rounded-lg text-white text-sm font-bold"
              style={{ backgroundColor: room.subject?.color || "#6B7280" }}
            >
              {room.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
            style={{ backgroundColor: room.subject?.color || "#6B7280" }}
          >
            {room.name.charAt(0)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{room.name}</h2>
            {!room.isPublic && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {room.subject && <SubjectBadge subject={room.subject} size="sm" />}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {room.memberCount} 成员
            </span>
            <span className="text-green-600 dark:text-green-400">
              {room.onlineCount} 在线
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isMember !== null && (
            joinPending ? (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="gap-1 text-xs"
              >
                <Clock className="h-3.5 w-3.5" />
                审批中
              </Button>
            ) : (
              <Button
                variant={isMember ? "outline" : "default"}
                size="sm"
                onClick={handleJoinLeave}
                disabled={isJoining}
                className="gap-1 text-xs"
              >
                {isJoining ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isMember ? (
                  <LogOut className="h-3.5 w-3.5" />
                ) : (
                  <LogIn className="h-3.5 w-3.5" />
                )}
                {isMember ? "退出" : !room.isPublic ? "申请加入" : "加入"}
              </Button>
            )
          )}

          {/* Room Settings (owner only) */}
          {isOwner && (
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>研讨室设置</DialogTitle>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex gap-1 border-b">
                  <button
                    onClick={() => setSettingsTab("settings")}
                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      settingsTab === "settings"
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    基本设置
                  </button>
                  {!room.isPublic && (
                    <button
                      onClick={() => setSettingsTab("requests")}
                      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        settingsTab === "requests"
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      加入申请
                    </button>
                  )}
                </div>

                {settingsTab === "settings" ? (
                <div className="space-y-5 py-4">
                  {/* Room Avatar Upload */}
                  <AvatarUpload
                    currentUrl={room.avatarUrl}
                    fallback={room.name.charAt(0).toUpperCase()}
                    fallbackClassName="text-white font-bold"
                    targetType="room"
                    targetId={room.id}
                    onUploadComplete={() => {
                      mutateRoom(); // refresh room data to show new avatar
                    }}
                    onError={(msg) => setEditError(msg)}
                    size="lg"
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">名称</label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={50}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">简介</label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                      maxLength={500}
                      className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="描述一下这个研讨室..."
                    />
                  </div>

                  {editError && (
                    <p className="text-sm text-destructive">{editError}</p>
                  )}

                  <Button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="w-full"
                  >
                    {isSavingSettings ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : null}
                    保存设置
                  </Button>
                </div>
                ) : (
                  <JoinRequestsPanel roomId={room.id} />
                )}
              </DialogContent>
            </Dialog>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Chat Area + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {msgLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : msgError ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              消息加载失败
            </div>
          ) : (
            <ChatMessages
              messages={allMessages}
              onReply={(msg) => setReplyTo(msg)}
            />
          )}

          {/* Chat Input — only if member */}
          {isMember ? (
            <ChatInput
              onSend={handleSend}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          ) : joinPending ? (
            <div className="border-t bg-muted/30 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                加入申请审批中，请耐心等待
              </div>
            </div>
          ) : (
            <div className="border-t bg-muted/30 px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">
                {!room.isPublic ? "这是私密研讨室，需要房主审批后才能加入" : "加入研讨室后即可发送消息"}
              </p>
              <Button
                size="sm"
                className="mt-2 gap-1"
                onClick={handleJoinLeave}
                disabled={isJoining}
              >
                {isJoining ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogIn className="h-3.5 w-3.5" />
                )}
                {!room.isPublic ? "申请加入" : "加入研讨室"}
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div className="w-60 shrink-0 overflow-y-auto border-l bg-card/50 p-3">
            {/* Room Info */}
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                研讨室信息
              </h3>
              {room.description && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {room.description}
                </p>
              )}
            </div>

            {/* Members */}
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                成员列表
              </h3>
              <MemberList
                members={room.members}
                onlineCount={room.onlineCount}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Join Requests panel for OWNER in settings dialog
interface JoinRequestItem {
  id: string;
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
  };
}

function JoinRequestsPanel({ roomId }: { roomId: string }) {
  const { data, isLoading, mutate } = useSWR<{ requests: JoinRequestItem[] }>(
    `/api/rooms/${roomId}/requests`,
    (url: string) => fetch(url).then((r) => r.json())
  );
  const [processing, setProcessing] = useState<string | null>(null);

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    setProcessing(requestId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) {
        toast.success(action === "approve" ? "已通过申请" : "已拒绝申请");
        mutate();
      } else {
        const err = await res.json();
        toast.error(err.error || "操作失败");
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setProcessing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const requests = data?.requests || [];

  if (requests.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        暂无待处理的加入申请
      </div>
    );
  }

  return (
    <div className="space-y-3 py-4">
      {requests.map((req) => (
        <div
          key={req.id}
          className="flex items-center gap-3 rounded-lg border p-3"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={req.user.avatar || undefined} />
            <AvatarFallback className="text-xs">
              {req.user.displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {req.user.displayName}
            </p>
            {req.message && (
              <p className="text-xs text-muted-foreground truncate">
                {req.message}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleAction(req.id, "reject")}
              disabled={processing === req.id}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              className="h-7 w-7"
              onClick={() => handleAction(req.id, "approve")}
              disabled={processing === req.id}
            >
              {processing === req.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
