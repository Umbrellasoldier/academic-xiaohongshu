"use client";

import { useEffect, useRef, useCallback } from "react";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import type { PostCardData } from "@/types";
import { Loader2 } from "lucide-react";

interface MasonryGridProps {
  posts: PostCardData[];
  isLoading?: boolean;
  isLoadingMore?: boolean;
  isReachingEnd?: boolean;
  onLoadMore?: () => void;
}

export function MasonryGrid({
  posts,
  isLoading,
  isLoadingMore,
  isReachingEnd,
  onLoadMore,
}: MasonryGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scroll with IntersectionObserver
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && !isLoadingMore && !isReachingEnd && onLoadMore) {
        onLoadMore();
      }
    },
    [isLoadingMore, isReachingEnd, onLoadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: "200px",
    });
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [handleObserver]);

  if (!isLoading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          还没有内容
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          成为第一个分享学术见解的人吧
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="columns-2 gap-4 px-4 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {isLoading &&
          Array.from({ length: 8 }).map((_, i) => (
            <PostCardSkeleton key={`skeleton-${i}`} index={i} />
          ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="py-8 flex justify-center">
        {isLoadingMore && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">加载更多...</span>
          </div>
        )}
        {isReachingEnd && posts.length > 0 && (
          <p className="text-sm text-muted-foreground">已经到底了</p>
        )}
      </div>
    </div>
  );
}
