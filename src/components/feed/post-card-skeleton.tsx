import { Skeleton } from "@/components/ui/skeleton";

const heights = [200, 260, 180, 300, 220, 240];

export function PostCardSkeleton({ index = 0 }: { index?: number }) {
  // Deterministic height based on index to avoid hydration mismatch
  const height = heights[index % heights.length];

  return (
    <div
      className="mb-4 overflow-hidden rounded-xl border border-border bg-card"
      style={{ breakInside: "avoid" }}
    >
      <Skeleton className="w-full" style={{ height }} />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
    </div>
  );
}
