"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Send, MessageCircle, Heart, Reply, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LatexText } from "@/components/academic/latex-renderer";
import { toast } from "sonner";
import type { CommentData } from "@/types";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface CommentSectionProps {
  postId: string;
}

export function CommentSection({ postId }: CommentSectionProps) {
  const { data: session } = useSession();
  const { data, mutate, isLoading } = useSWR<{
    comments: CommentData[];
    total: number;
  }>(`/api/posts/${postId}/comments`, fetcher);

  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const comments = data?.comments || [];

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);

    try {
      await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment.trim(),
          parentId: replyTo?.id,
        }),
      });
      setNewComment("");
      setReplyTo(null);
      mutate();
    } catch {
      toast.error("评论失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = (commentId: string, authorName: string) => {
    setReplyTo({ id: commentId, name: authorName });
    inputRef.current?.focus();
  };

  return (
    <div id="comments" className="space-y-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <MessageCircle className="h-5 w-5" />
        评论 ({data?.total || 0})
      </h3>

      {/* Comment Input */}
      <div className="space-y-2">
        {replyTo && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Reply className="h-3.5 w-3.5" />
            回复 <span className="font-medium">{replyTo.name}</span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-xs hover:underline"
            >
              取消
            </button>
          </div>
        )}
        <div className="flex gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={undefined} />
            <AvatarFallback className="text-xs">
              {session?.user?.displayName?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={
                session ? "写下你的评论..." : "请先登录后评论"
              }
              disabled={!session}
              rows={2}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Ctrl+Enter 发送
              </p>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!newComment.trim() || isSubmitting || !session}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                发送
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Comment List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          还没有评论，来说两句吧
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              onReply={handleReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  postId,
  onReply,
  isReply = false,
}: {
  comment: CommentData;
  postId: string;
  onReply: (id: string, name: string) => void;
  isReply?: boolean;
}) {
  const { data: session } = useSession();
  const [liked, setLiked] = useState(comment.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(comment.likeCount);

  const handleLike = async () => {
    if (!session) {
      toast.error("请先登录");
      return;
    }

    // Optimistic update
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);

    try {
      const res = await fetch(
        `/api/posts/${postId}/comments/${comment.id}/like`,
        { method: "POST" }
      );
      if (!res.ok) {
        throw new Error("failed");
      }
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      // Rollback
      setLiked(prevLiked);
      setLikeCount(prevCount);
      toast.error("操作失败");
    }
  };

  return (
    <div className={cn("flex gap-3", isReply && "ml-11")}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={comment.author.avatar || undefined} />
        <AvatarFallback className="text-xs">
          {comment.author.displayName.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {comment.author.displayName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimeAgo(comment.createdAt)}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed">
          <LatexText text={comment.content} />
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <button
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground",
              liked && "text-red-500"
            )}
          >
            <Heart className={cn("h-3 w-3", liked && "fill-current")} />
            {likeCount}
          </button>
          <button
            onClick={() =>
              onReply(comment.id, comment.author.displayName)
            }
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Reply className="h-3 w-3" />
            回复
          </button>
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                postId={postId}
                onReply={onReply}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(dateString).toLocaleDateString("zh-CN");
}
