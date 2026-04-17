"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, Search, PenSquare, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const profileHref = session?.user?.username
    ? `/user/${session.user.username}`
    : "/login";

  const navItems = [
    { href: "/feed", icon: Home, label: "发现" },
    { href: "/search", icon: Search, label: "搜索" },
    { href: "/post/create", icon: PenSquare, label: "发布" },
    { href: "/rooms", icon: MessageCircle, label: "研讨" },
    { href: profileHref, icon: User, label: "我的" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/feed"
              ? pathname.startsWith("/feed")
              : pathname.startsWith(item.href);
          const isCreate = item.href === "/post/create";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
                isCreate
                  ? "text-primary"
                  : isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isCreate && "h-6 w-6"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
