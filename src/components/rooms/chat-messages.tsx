"use client";

import { useRef, useEffect, useState } from "react";
import { CornerDownLeft, Reply, X, FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LatexText } from "@/components/academic/latex-renderer";
import type { RoomMessageData } from "@/types";
import { cn } from "@/lib/utils";

interface ChatMessagesProps {
  messages: RoomMessageData[];
  onReply?: (message: RoomMessageData) => void;
}

export function ChatMessages({ messages, onReply }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onReply={onReply} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({
  message,
  onReply,
}: {
  message: RoomMessageData;
  onReply?: (message: RoomMessageData) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  // System messages
  if (message.type === "SYSTEM") {
    return (
      <div className="flex justify-center py-2">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  // Paper share messages
  if (message.type === "PAPER_SHARE") {
    return (
      <div
        className="group flex items-start gap-2 py-1.5"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={message.author.avatar || undefined} />
          <AvatarFallback className="text-xs">
            {message.author.displayName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold">
              {message.author.displayName}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatTime(message.createdAt)}
            </span>
          </div>
          <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {message.paperData?.title || message.content}
                </p>
                {message.paperData && (
                  <p className="mt-0.5 text-xs text-blue-600/70 dark:text-blue-400/70">
                    {message.paperData.authors}
                    {message.paperData.year && ` (${message.paperData.year})`}
                    {message.paperData.doi && ` · DOI: ${message.paperData.doi}`}
                  </p>
                )}
              </div>
            </div>
          </div>
          {showActions && (
            <MessageActions message={message} onReply={onReply} />
          )}
        </div>
      </div>
    );
  }

  // Regular text message
  return (
    <div
      className="group flex items-start gap-2 py-1.5"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={message.author.avatar || undefined} />
        <AvatarFallback className="text-xs">
          {message.author.displayName.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold">
            {message.author.displayName}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        </div>

        {/* Reply quote */}
        {message.replyTo && (
          <div className="mt-1 flex items-start gap-1.5 rounded border-l-2 border-primary/40 bg-muted/50 px-2 py-1">
            <Reply className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <span className="text-[10px] font-medium">
                {message.replyTo.author.displayName}
              </span>
              <p className="text-[10px] text-muted-foreground line-clamp-1">
                {message.replyTo.content}
              </p>
            </div>
          </div>
        )}

        {/* Message content with LaTeX support */}
        <div className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
          <LatexText text={message.content} />
        </div>

        {showActions && (
          <MessageActions message={message} onReply={onReply} />
        )}
      </div>
    </div>
  );
}

function MessageActions({
  message,
  onReply,
}: {
  message: RoomMessageData;
  onReply?: (message: RoomMessageData) => void;
}) {
  return (
    <div className="mt-1 flex items-center gap-1">
      {onReply && (
        <button
          onClick={() => onReply(message)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Reply className="h-3 w-3" />
          回复
        </button>
      )}
    </div>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;

  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Chat Input
interface ChatInputProps {
  onSend: (content: string, type?: string) => void;
  replyTo?: RoomMessageData | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  replyTo,
  onCancelReply,
  disabled,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, [text]);

  return (
    <div className="border-t bg-background px-4 py-3">
      {/* Reply preview */}
      {replyTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-muted-foreground">
              回复 {replyTo.author.displayName}
            </span>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.content}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="发送消息...  支持 $行内公式$ 或 $$块级公式$$，Shift+Enter 换行"
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-lg border bg-muted/50 px-3 py-2 text-sm",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          )}
          disabled={disabled}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="gap-1 shrink-0"
        >
          <CornerDownLeft className="h-3.5 w-3.5" />
          发送
        </Button>
      </div>

    </div>
  );
}
