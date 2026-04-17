"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Search,
  Loader2,
  FileText,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostCard } from "@/components/feed/post-card";
import { PostCardSkeleton } from "@/components/feed/post-card-skeleton";
import type { PostCardData } from "@/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SearchTab = "posts" | "users";

interface SearchUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  institution: string | null;
  postCount: number;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialTab = (searchParams.get("type") as SearchTab) || "posts";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Sync URL with search params
  useEffect(() => {
    if (debouncedQuery) {
      router.replace(`/search?q=${encodeURIComponent(debouncedQuery)}&type=${activeTab}`, {
        scroll: false,
      });
    }
  }, [debouncedQuery, activeTab, router]);

  // Post results
  const { data: postResults, isLoading: isPostsLoading } = useSWR<{
    posts: PostCardData[];
    total: number;
    query: string;
  }>(
    debouncedQuery ? `/api/search?q=${encodeURIComponent(debouncedQuery)}&type=posts` : null,
    fetcher
  );

  // User results
  const { data: userResults, isLoading: isUsersLoading } = useSWR<{
    users: SearchUser[];
    total: number;
    query: string;
  }>(
    debouncedQuery ? `/api/search?q=${encodeURIComponent(debouncedQuery)}&type=users` : null,
    fetcher
  );

  const posts = postResults?.posts ?? [];
  const users = userResults?.users ?? [];
  const isLoading = activeTab === "posts" ? isPostsLoading : isUsersLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedQuery(query);
  };

  const tabs: { key: SearchTab; label: string; icon: typeof FileText; count: number }[] = [
    {
      key: "posts",
      label: "帖子",
      icon: FileText,
      count: postResults?.total ?? 0,
    },
    {
      key: "users",
      label: "用户",
      icon: Users,
      count: userResults?.total ?? 0,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Search Header */}
      <div className="mb-6">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索论文、笔记、用户..."
            className="pl-10 h-12 text-base"
            autoFocus
          />
        </form>
      </div>

      {/* Show empty state when no query */}
      {!debouncedQuery ? (
        <EmptySearchState />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b mb-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {debouncedQuery && (
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Results */}
          {activeTab === "posts" ? (
            <PostResults posts={posts} isLoading={isLoading} query={debouncedQuery} />
          ) : (
            <UserResults users={users} isLoading={isLoading} query={debouncedQuery} />
          )}
        </>
      )}
    </div>
  );
}

function EmptySearchState() {
  const hotTopics = [
    "Transformer",
    "量子计算",
    "CRISPR",
    "大语言模型",
    "强化学习",
    "LaTeX",
  ];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
      <p className="text-muted-foreground mb-6">输入关键词开始搜索</p>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">热门搜索</p>
        <div className="flex flex-wrap justify-center gap-2">
          {hotTopics.map((topic) => (
            <Link
              key={topic}
              href={`/search?q=${encodeURIComponent(topic)}&type=posts`}
              className="rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              {topic}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function PostResults({
  posts,
  isLoading,
  query,
}: {
  posts: PostCardData[];
  isLoading: boolean;
  query: string;
}) {
  if (isLoading) {
    return (
      <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <PostCardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">
          没有找到与 &ldquo;{query}&rdquo; 相关的帖子
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          试试其他关键词？
        </p>
      </div>
    );
  }

  return (
    <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function UserResults({
  users,
  isLoading,
  query,
}: {
  users: SearchUser[];
  isLoading: boolean;
  query: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse rounded-lg border p-4">
            <div className="h-12 w-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-48 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">
          没有找到与 &ldquo;{query}&rdquo; 相关的用户
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <Link
          key={user.id}
          href={`/user/${user.username}`}
          className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar ?? undefined} />
            <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                {user.displayName}
              </span>
              <span className="text-xs text-muted-foreground">
                @{user.username}
              </span>
            </div>
            {user.bio && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {user.bio}
              </p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              {user.institution && <span>{user.institution}</span>}
              <span>{user.postCount} 篇帖子</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0">
            查看
          </Button>
        </Link>
      ))}
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
