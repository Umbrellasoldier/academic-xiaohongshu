"use client";

import { useState } from "react";
import { Heart, Bookmark, Share2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PostActionsProps {
  postId: string;
  initialLikeCount: number;
  initialBookmarkCount: number;
  commentCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  onCommentClick?: () => void;
}

export function PostActions({
  postId,
  initialLikeCount,
  initialBookmarkCount,
  commentCount,
  isLiked: initialIsLiked = false,
  isBookmarked: initialIsBookmarked = false,
  onCommentClick,
}: PostActionsProps) {
  const [liked, setLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [bookmarked, setBookmarked] = useState(initialIsBookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarkCount);

  const handleLike = async () => {
    // Optimistic update
    setLiked(!liked);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));

    try {
      await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    } catch {
      // Revert on error
      setLiked(liked);
      setLikeCount(initialLikeCount);
      toast.error("点赞失败，请稍后重试");
    }
  };

  const handleBookmark = async () => {
    // Optimistic update
    setBookmarked(!bookmarked);
    setBookmarkCount((prev) => (bookmarked ? prev - 1 : prev + 1));

    try {
      await fetch(`/api/posts/${postId}/bookmark`, { method: "POST" });
    } catch {
      // Revert on error
      setBookmarked(bookmarked);
      setBookmarkCount(initialBookmarkCount);
      toast.error("收藏失败，请稍后重试");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      navigator.share({
        title: document.title,
        url: window.location.href,
      }).catch(() => {});
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("链接已复制到剪贴板");
      } catch {
        toast.error("复制失败");
      }
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Like */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLike}
        className={cn(
          "gap-1.5",
          liked && "text-red-500 hover:text-red-600"
        )}
      >
        <Heart
          className={cn("h-4 w-4", liked && "fill-current")}
        />
        <span className="text-xs">{likeCount > 0 ? likeCount : ""}</span>
      </Button>

      {/* Comment */}
      <Button variant="ghost" size="sm" onClick={onCommentClick} className="gap-1.5">
        <MessageCircle className="h-4 w-4" />
        <span className="text-xs">{commentCount > 0 ? commentCount : ""}</span>
      </Button>

      {/* Bookmark */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBookmark}
        className={cn(
          "gap-1.5",
          bookmarked && "text-yellow-500 hover:text-yellow-600"
        )}
      >
        <Bookmark
          className={cn("h-4 w-4", bookmarked && "fill-current")}
        />
        <span className="text-xs">{bookmarkCount > 0 ? bookmarkCount : ""}</span>
      </Button>

      {/* Share */}
      <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5">
        <Share2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
