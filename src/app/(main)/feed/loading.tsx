import { PostCardSkeleton } from "@/components/feed/post-card-skeleton";

export default function FeedLoading() {
  return (
    <div className="mx-auto max-w-7xl py-4">
      <div className="columns-2 gap-4 px-4 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <PostCardSkeleton key={i} index={i} />
        ))}
      </div>
    </div>
  );
}
