"use client";

import { MasonryGrid } from "@/components/feed/masonry-grid";
import { AIRecommend } from "@/components/feed/ai-recommend";
import { useInfiniteFeed } from "@/lib/hooks/use-infinite-feed";

export default function FeedPage() {
  const { posts, isLoading, isLoadingMore, isReachingEnd, loadMore } =
    useInfiniteFeed();

  return (
    <div className="mx-auto max-w-7xl py-4">
      <AIRecommend />
      <MasonryGrid
        posts={posts}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        isReachingEnd={isReachingEnd}
        onLoadMore={loadMore}
      />
    </div>
  );
}
