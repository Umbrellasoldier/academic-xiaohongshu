"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Building,
  UserPlus,
  UserCheck,
  Loader2,
  MapPin,
  LinkIcon,
  Grid3X3,
  Bookmark,
  Info,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PostCard } from "@/components/feed/post-card";
import { PostCardSkeleton } from "@/components/feed/post-card-skeleton";
import type { UserProfile, PostCardData } from "@/types";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type TabType = "posts" | "bookmarks" | "about";

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  const { data: profileData, isLoading: isProfileLoading } = useSWR<{
    user: UserProfile;
  }>(`/api/users/${username}`, fetcher, {
    onSuccess: (data) => {
      setIsFollowing(data.user.isFollowing ?? false);
      setFollowerCount(data.user.followerCount);
    },
  });

  const { data: postsData, isLoading: isPostsLoading } = useSWR<{
    posts: PostCardData[];
    total: number;
  }>(`/api/users/${username}/posts?type=${activeTab === "bookmarks" ? "bookmarks" : "posts"}`, fetcher);

  const user = profileData?.user;
  const posts = postsData?.posts ?? [];
  const isOwnProfile = session?.user?.username === username;

  const handleFollow = async () => {
    if (!user) return;
    const prev = isFollowing;
    setIsFollowing(!prev);
    setFollowerCount((c) => (prev ? c - 1 : c + 1));

    try {
      await fetch(`/api/users/${username}/follow`, { method: "POST" });
    } catch {
      setIsFollowing(prev);
      setFollowerCount((c) => (prev ? c + 1 : c - 1));
    }
  };

  if (isProfileLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          用户不存在
        </p>
        <Link
          href="/feed"
          className="mt-4 inline-flex items-center text-sm text-primary hover:underline"
        >
          返回首页
        </Link>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: typeof Grid3X3 }[] = [
    { key: "posts", label: "帖子", icon: Grid3X3 },
    { key: "bookmarks", label: "收藏", icon: Bookmark },
    { key: "about", label: "关于", icon: Info },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <Avatar className="h-24 w-24 sm:h-28 sm:w-28">
          <AvatarImage src={user.avatar ?? undefined} />
          <AvatarFallback className="text-3xl">
            {user.displayName.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
            <h1 className="text-2xl font-bold">{user.displayName}</h1>
            <span className="text-sm text-muted-foreground">
              @{user.username}
            </span>
          </div>

          {user.bio && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-lg">
              {user.bio}
            </p>
          )}

          {/* Meta info */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground sm:justify-start">
            {user.institution && (
              <span className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5" />
                {user.institution}
              </span>
            )}
            {user.orcid && (
              <a
                href={`https://orcid.org/${user.orcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                ORCID
              </a>
            )}
          </div>

          {/* Stats */}
          <div className="mt-4 flex items-center justify-center gap-6 text-sm sm:justify-start">
            <span>
              <strong className="font-semibold">{user.followingCount}</strong>{" "}
              <span className="text-muted-foreground">关注</span>
            </span>
            <span>
              <strong className="font-semibold">{followerCount}</strong>{" "}
              <span className="text-muted-foreground">粉丝</span>
            </span>
            <span>
              <strong className="font-semibold">{user.postCount}</strong>{" "}
              <span className="text-muted-foreground">帖子</span>
            </span>
          </div>
        </div>

        {/* Action button */}
        <div className="shrink-0">
          {isOwnProfile ? (
            <Link href={`/user/${username}/settings`}>
              <Button variant="outline" className="gap-1.5">
                <Settings className="h-4 w-4" />
                编辑资料
              </Button>
            </Link>
          ) : (
            <Button
              onClick={handleFollow}
              variant={isFollowing ? "outline" : "default"}
              className="gap-1.5"
            >
              {isFollowing ? (
                <>
                  <UserCheck className="h-4 w-4" />
                  已关注
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  关注
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
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
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "about" ? (
          <AboutTab user={user} />
        ) : (
          <PostsGrid
            posts={posts}
            isLoading={isPostsLoading}
            emptyMessage={
              activeTab === "posts"
                ? "还没有发布内容"
                : "还没有收藏内容"
            }
          />
        )}
      </div>
    </div>
  );
}

function PostsGrid({
  posts,
  isLoading,
  emptyMessage,
}: {
  posts: PostCardData[];
  isLoading: boolean;
  emptyMessage: string;
}) {
  if (isLoading) {
    return (
      <div className="columns-2 gap-4 sm:columns-2 md:columns-3 lg:columns-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <PostCardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="columns-2 gap-4 sm:columns-2 md:columns-3 lg:columns-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function AboutTab({ user }: { user: UserProfile }) {
  return (
    <div className="max-w-lg space-y-6">
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          个人信息
        </h3>

        <div className="space-y-3">
          {user.bio ? (
            <InfoRow label="简介" value={user.bio} />
          ) : (
            <InfoRow label="简介" value="未填写" muted />
          )}

          {user.institution ? (
            <InfoRow label="机构" value={user.institution} />
          ) : (
            <InfoRow label="机构" value="未填写" muted />
          )}

          {user.orcid && (
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-muted-foreground w-16 shrink-0">
                ORCID
              </span>
              <a
                href={`https://orcid.org/${user.orcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {user.orcid}
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          统计
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{user.postCount}</p>
            <p className="text-xs text-muted-foreground">帖子</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{user.followerCount}</p>
            <p className="text-xs text-muted-foreground">粉丝</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{user.followingCount}</p>
            <p className="text-xs text-muted-foreground">关注</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm font-medium text-muted-foreground w-16 shrink-0">
        {label}
      </span>
      <span className={cn("text-sm", muted && "text-muted-foreground italic")}>
        {value}
      </span>
    </div>
  );
}
