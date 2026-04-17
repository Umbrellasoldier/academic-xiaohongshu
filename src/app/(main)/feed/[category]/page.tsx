"use client";

import { useParams } from "next/navigation";
import { MasonryGrid } from "@/components/feed/masonry-grid";
import { useInfiniteFeed } from "@/lib/hooks/use-infinite-feed";
import { useSubjects, findSubjectBySlug } from "@/lib/hooks/use-subjects";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { UserCheck, Loader2 } from "lucide-react";

export default function CategoryFeedPage() {
  const params = useParams<{ category: string }>();
  const category = params.category;
  const { status } = useSession();

  // Special case: "following" feed
  if (category === "following") {
    return <FollowingFeed isAuthenticated={status === "authenticated"} />;
  }

  return <SubjectFeed category={category} />;
}

function SubjectFeed({ category }: { category: string }) {
  const { subjects, isLoading: subjectsLoading } = useSubjects();
  const { posts, isLoading, isLoadingMore, isReachingEnd, loadMore } =
    useInfiniteFeed({ category });

  // Validate category against real subjects
  const subject = subjects ? findSubjectBySlug(subjects, category) : undefined;

  // Still loading subjects — show loader
  if (subjectsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Subjects loaded but category not found
  if (subjects && !subject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          分类不存在
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl py-4">
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

function FollowingFeed({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { posts, isLoading, isLoadingMore, isReachingEnd, loadMore } =
    useInfiniteFeed({ feed: "following" });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <UserCheck className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-lg font-medium text-muted-foreground">
          登录后查看关注动态
        </p>
        <Link
          href="/login"
          className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          登录
        </Link>
      </div>
    );
  }

  if (!isLoading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <UserCheck className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-lg font-medium text-muted-foreground">
          还没有关注任何人
        </p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          关注感兴趣的学者，这里会显示他们的最新动态
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl py-4">
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
