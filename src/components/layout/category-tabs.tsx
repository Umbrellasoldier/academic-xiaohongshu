"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSubjects, findParentSubject } from "@/lib/hooks/use-subjects";
import { useRef, useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserCheck,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import type { SubjectData } from "@/types";

export function CategoryTabs() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const currentCategory = params.category as string | undefined;
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const { status } = useSession();
  const { subjects, isLoading } = useSubjects();

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [subjects]); // re-check when subjects load

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -200 : 200,
      behavior: "smooth",
    });
  };

  // Close panel on click outside
  useEffect(() => {
    if (!expandedSlug) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as Element)?.closest("[data-subject-tab]")
      ) {
        setExpandedSlug(null);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedSlug(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [expandedSlug]);

  // Determine which level-1 subject is "active" based on the current URL
  const activeParent = subjects && currentCategory
    ? findParentSubject(subjects, currentCategory)
    : undefined;

  const handleTabClick = useCallback(
    (subject: SubjectData) => {
      const hasChildren = subject.children && subject.children.length > 0;

      if (hasChildren) {
        // Toggle the expansion panel
        setExpandedSlug((prev) =>
          prev === subject.slug ? null : subject.slug
        );
      } else {
        // No children — navigate directly
        setExpandedSlug(null);
        router.push(`/feed/${subject.slug}`);
      }
    },
    [router]
  );

  const handleSubjectSelect = useCallback(
    (slug: string) => {
      setExpandedSlug(null);
      router.push(`/feed/${slug}`);
    },
    [router]
  );

  // Only show on feed pages
  if (!pathname.startsWith("/feed")) return null;

  const expandedSubject = subjects?.find((s) => s.slug === expandedSlug);

  return (
    <div className="sticky top-14 z-40 border-b bg-background">
      <div className="relative mx-auto max-w-7xl">
        {/* Left fade + arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 z-10 flex h-full w-10 items-center justify-center bg-gradient-to-r from-background to-transparent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Scrollable tabs */}
        <div
          ref={scrollRef}
          className="flex items-center gap-1 overflow-x-auto px-4 py-2 scrollbar-hide"
        >
          {/* "All" tab */}
          <Link
            href="/feed"
            onClick={() => setExpandedSlug(null)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              !currentCategory
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            全部
          </Link>

          {/* "Following" tab */}
          {status === "authenticated" && (
            <Link
              href="/feed/following"
              onClick={() => setExpandedSlug(null)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                currentCategory === "following"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <UserCheck className="h-3.5 w-3.5" />
              关注
            </Link>
          )}

          {/* Loading skeleton */}
          {isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-16 shrink-0 animate-pulse rounded-full bg-muted"
              />
            ))}

          {/* Subject tabs */}
          {subjects?.map((subject) => {
            const isActive = activeParent?.slug === subject.slug;
            const isExpanded = expandedSlug === subject.slug;
            const hasChildren =
              subject.children && subject.children.length > 0;

            return (
              <button
                key={subject.slug}
                data-subject-tab
                onClick={() => handleTabClick(subject)}
                className={cn(
                  "flex shrink-0 items-center gap-0.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "text-white"
                    : isExpanded
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                style={isActive ? { backgroundColor: subject.color } : undefined}
              >
                {subject.nameZh}
                {hasChildren && (
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right fade + arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 z-10 flex h-full w-10 items-center justify-center bg-gradient-to-l from-background to-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sub-discipline expansion panel */}
      {expandedSubject && expandedSubject.children && expandedSubject.children.length > 0 && (
        <div
          ref={panelRef}
          className="border-t bg-popover shadow-lg animate-in slide-in-from-top-2 duration-200"
        >
          <div className="mx-auto max-w-7xl px-4 py-3">
            {/* Panel header */}
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => handleSubjectSelect(expandedSubject.slug)}
                className="text-sm font-medium transition-colors hover:text-primary"
                style={{ color: expandedSubject.color }}
              >
                查看全部「{expandedSubject.nameZh}」
              </button>
              <button
                onClick={() => setExpandedSlug(null)}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sub-discipline grid */}
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {expandedSubject.children.map((child) => {
                const isChildActive = currentCategory === child.slug;
                return (
                  <button
                    key={child.slug}
                    onClick={() => handleSubjectSelect(child.slug)}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                      isChildActive
                        ? "text-white"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    style={
                      isChildActive
                        ? { backgroundColor: child.color }
                        : undefined
                    }
                  >
                    {child.nameZh}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
