"use client";

import Link from "next/link";
import { Search, PenSquare, User, BookOpen, LogOut, MessageSquare, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { SITE_NAME } from "@/lib/constants";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/feed" });
  };

  const isAuthenticated = status === "authenticated";
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4">
        {/* Logo — 左对齐 */}
        <div className="flex items-center">
          <Link href="/feed" className="flex shrink-0 items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="hidden text-lg font-bold sm:inline-block">
              {SITE_NAME}
            </span>
          </Link>
        </div>

        {/* Search Bar — 居中 */}
        <form onSubmit={handleSearch} className="w-full max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="搜索论文、笔记、用户..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
        </form>

        {/* Actions — 右对齐 */}
        <div className="flex items-center justify-end gap-2">
          {/* 学术研讨室 */}
          <Link
            href="/rooms"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <MessageSquare className="h-4 w-4" />
            研讨室
          </Link>

          {/* Create Post */}
          {isAuthenticated && (
            <Link
              href="/post/create"
              className="hidden items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 sm:flex"
            >
              <PenSquare className="h-4 w-4" />
              发布
            </Link>
          )}

          {/* Notifications - only for logged in users */}
          {isAuthenticated && <NotificationPanel />}

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatar || user?.image || undefined} />
                <AvatarFallback className="text-xs">
                  {isAuthenticated ? (
                    (user?.displayName || user?.name || "U")
                      .charAt(0)
                      .toUpperCase()
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isAuthenticated ? (
                <>
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">
                      {user?.displayName || user?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{user?.username || user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link
                      href={`/user/${user?.username || ""}`}
                      className="flex w-full"
                    >
                      个人主页
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <ThemeSwitcher />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href="/help" className="flex w-full items-center">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      帮助与客服
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem>
                    <Link href="/login" className="flex w-full">
                      登录
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/register" className="flex w-full">
                      注册
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <ThemeSwitcher />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href="/help" className="flex w-full items-center">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      帮助与客服
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
