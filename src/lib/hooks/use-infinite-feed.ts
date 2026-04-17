"use client";

import useSWRInfinite from "swr/infinite";
import type { PostCardData } from "@/types";

interface PostsResponse {
  posts: PostCardData[];
  nextCursor: string | null;
  total: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UseInfiniteFeedOptions {
  category?: string;
  feed?: "following";
  sort?: string;
  limit?: number;
}

export function useInfiniteFeed({
  category,
  feed,
  sort = "recent",
  limit = 20,
}: UseInfiniteFeedOptions = {}) {
  const getKey = (pageIndex: number, previousPageData: PostsResponse | null) => {
    // Reached the end
    if (previousPageData && !previousPageData.nextCursor) return null;

    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (feed) params.set("feed", feed);
    params.set("sort", sort);
    params.set("limit", String(limit));

    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }

    return `/api/posts?${params.toString()}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PostsResponse>(getKey, fetcher, {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
    });

  const posts = data ? data.flatMap((page) => page.posts) : [];
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.posts.length === 0;
  const isReachingEnd =
    isEmpty || (data && data[data.length - 1]?.nextCursor === null);

  return {
    posts,
    error,
    isLoading,
    isLoadingMore: isLoadingMore ?? false,
    isReachingEnd: isReachingEnd ?? false,
    isValidating,
    size,
    setSize,
    mutate,
    loadMore: () => setSize(size + 1),
  };
}
