import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SubjectBadgeProps {
  subject: {
    name: string;
    nameZh: string;
    slug: string;
    color: string;
  };
  size?: "sm" | "md";
  className?: string;
}

export function SubjectBadge({
  subject,
  size = "sm",
  className,
}: SubjectBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-0 font-medium",
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        className
      )}
      style={{
        backgroundColor: `${subject.color}15`,
        color: subject.color,
      }}
    >
      {subject.nameZh}
    </Badge>
  );
}
