"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, ImageOff, BookOpen } from "lucide-react";
import { SubjectBadge } from "@/components/academic/subject-badge";
import { LatexText } from "@/components/academic/latex-renderer";
import type { PostCardData } from "@/types";
import { useState } from "react";

interface PostCardProps {
  post: PostCardData;
}

export function PostCard({ post }: PostCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link href={`/post/${post.id}`} className="group">
      <article
        className="mb-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm
                    transition-all duration-200 hover:shadow-md"
        style={{ breakInside: "avoid" }}
      >
        {/* Cover Image */}
        {post.coverImage && !imgError && (
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImage}
              alt={post.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        {/* Image error fallback */}
        {post.coverImage && imgError && (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted">
            <ImageOff className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}

        {/* 无封面图 — 学科色占位 */}
        {!post.coverImage && (
          <div
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 p-4"
            style={{
              background: `linear-gradient(135deg, ${post.subject.color}20, ${post.subject.color}40)`,
            }}
          >
            <BookOpen className="h-8 w-8" style={{ color: post.subject.color }} />
            <span className="text-xs font-medium" style={{ color: post.subject.color }}>
              {post.subject.nameZh}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="space-y-2 p-3">
          {/* Title */}
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 transition-colors group-hover:text-primary">
            <LatexText text={post.title} />
          </h3>

          {/* Summary */}
          {post.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {post.summary}
            </p>
          )}

          {/* Subject Badge */}
          <SubjectBadge subject={post.subject} size="sm" />

          {/* Author + Stats */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={post.author.avatar ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {post.author.displayName[0]}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-xs text-muted-foreground max-w-[80px]">
                {post.author.displayName}
              </span>
            </div>

            <div className="flex items-center gap-0.5 text-muted-foreground">
              <Heart className="h-3.5 w-3.5" />
              <span className="text-xs">{post.likeCount}</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
