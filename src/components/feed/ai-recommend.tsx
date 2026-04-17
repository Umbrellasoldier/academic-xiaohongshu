"use client";

import useSWR from "swr";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";

const recommendFetcher = async (url: string) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interests: [], recentPosts: [] }),
  });
  if (!res.ok) throw new Error("Failed to fetch recommendations");
  return res.json();
};

export function AIRecommend() {
  const { status } = useSession();

  const { data, error, isLoading } = useSWR(
    status === "authenticated" ? "/api/ai/recommend" : null,
    recommendFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 5 * 60 * 1000, // 5 min cache
      errorRetryCount: 1,
    }
  );

  const keywords: string[] = data?.keywords?.slice(0, 8) ?? [];

  // Don't render anything if not authenticated, errored, or no keywords
  if (status !== "authenticated" || error) return null;
  if (!isLoading && keywords.length === 0) return null;

  return (
    <div className="mb-4 px-2">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-medium text-muted-foreground">
          AI 推荐探索
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          正在生成推荐...
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-hide">
          {keywords.map((keyword) => (
            <Link
              key={keyword}
              href={`/search?q=${encodeURIComponent(keyword)}`}
              className="inline-flex shrink-0 items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
            >
              {keyword}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
