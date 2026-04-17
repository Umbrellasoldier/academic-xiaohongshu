"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { ArrowLeft, Eye, Calendar, Loader2, ImageOff, UserCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SubjectBadge } from "@/components/academic/subject-badge";
import { LatexText } from "@/components/academic/latex-renderer";
import { ContentRenderer } from "@/components/post/content-renderer";
import { PostActions } from "@/components/post/post-actions";
import { PostOwnerMenu } from "@/components/post/post-owner-menu";
import { CommentSection } from "@/components/post/comment-section";
import { AIFeatures } from "@/components/post/ai-features";
import type { PostDetail } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [coverError, setCoverError] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null); // null = use API value
  const [followLoading, setFollowLoading] = useState(false);
  const { data, error, isLoading } = useSWR<{ post: PostDetail & { author: { id?: string; isFollowing?: boolean } } }>(
    `/api/posts/${params.id}`,
    fetcher
  );

  const handleToggleFollow = useCallback(async () => {
    if (!data?.post?.author?.username || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/users/${data.post.author.username}/follow`, {
        method: "POST",
      });
      const result = await res.json();
      if (res.ok) {
        setFollowing(result.isFollowing);
      }
    } catch {
      // ignore
    } finally {
      setFollowLoading(false);
    }
  }, [data?.post?.author?.username, followLoading]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data?.post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          帖子不存在或已被删除
        </p>
        <Link
          href="/feed"
          className="mt-4 inline-flex items-center text-sm text-primary hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回首页
        </Link>
      </div>
    );
  }

  const post = data.post;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Back button */}
      <Link
        href="/feed"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回
      </Link>

      {/* Post Header */}
      <article className="space-y-6">
        {/* Cover Image */}
        {post.coverImage && !coverError && (
          <div className="overflow-hidden rounded-xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full max-h-[400px] object-cover"
              onError={() => setCoverError(true)}
            />
          </div>
        )}
        {post.coverImage && coverError && (
          <div className="flex h-48 items-center justify-center rounded-xl bg-muted">
            <ImageOff className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Title */}
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            <LatexText text={post.title} />
          </h1>
          {session?.user?.id === (post.author as unknown as { id?: string }).id && (
            <PostOwnerMenu postId={post.id} />
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <SubjectBadge subject={post.subject} />
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {post.viewCount} 阅读
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(post.createdAt).toLocaleDateString("zh-CN")}
          </span>
        </div>

        {/* Author Info */}
        <div className="flex items-center gap-3 rounded-lg border bg-card/50 p-3">
          <Link href={`/user/${post.author.username}`}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.author.avatar || undefined} />
              <AvatarFallback>
                {post.author.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              href={`/user/${post.author.username}`}
              className="text-sm font-semibold hover:underline"
            >
              {post.author.displayName}
            </Link>
            <p className="text-xs text-muted-foreground">
              @{post.author.username}
            </p>
          </div>
          {(() => {
            const isFollowed = following ?? (post.author as unknown as { isFollowing?: boolean }).isFollowing;
            const isSelf = session?.user?.id === (post.author as unknown as { id?: string }).id;
            if (isSelf) return null;
            return (
              <Button
                variant={isFollowed ? "secondary" : "outline"}
                size="sm"
                onClick={handleToggleFollow}
                disabled={followLoading || !session}
              >
                {followLoading ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : isFollowed ? (
                  <UserCheck className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <UserPlus className="mr-1 h-3.5 w-3.5" />
                )}
                {isFollowed ? "已关注" : "关注"}
              </Button>
            );
          })()}
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="border-t pt-6">
          <ContentRenderer content={post.content} />
        </div>

        {/* AI Features */}
        <div className="border-t pt-4">
          <AIFeatures
            postId={post.id}
            title={post.title}
            content={post.content}
          />
        </div>

        {/* Actions */}
        <div className="border-t pt-4">
          <PostActions
            postId={post.id}
            initialLikeCount={post.likeCount}
            initialBookmarkCount={post.bookmarkCount}
            commentCount={post.commentCount}
            isLiked={post.isLiked}
            isBookmarked={post.isBookmarked}
            onCommentClick={() => {
              document
                .getElementById("comments")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>

        {/* Comments */}
        <div className="border-t pt-6">
          <CommentSection postId={post.id} />
        </div>
      </article>
    </div>
  );
}
