"use client";

import { cn } from "@/lib/utils";
import { useSubjects, findSubjectBySlug, findParentSubject } from "@/lib/hooks/use-subjects";
import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { SubjectData } from "@/types";

interface SubjectPickerProps {
  value: string | null;
  onChange: (slug: string) => void;
}

export function SubjectPicker({ value, onChange }: SubjectPickerProps) {
  const { subjects, isLoading } = useSubjects();
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  // Auto-expand the parent of the currently selected value
  const selectedSubject = subjects && value
    ? findSubjectBySlug(subjects, value)
    : undefined;
  const selectedParent = subjects && value
    ? findParentSubject(subjects, value)
    : undefined;

  // Determine which parent is expanded (explicit or inferred from selection)
  const activeExpanded = expandedParent
    ?? (selectedParent?.children?.some((c) => c.slug === value)
      ? selectedParent?.slug
      : null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载学科分类...
      </div>
    );
  }

  if (!subjects) return null;

  const handleParentClick = (subject: SubjectData) => {
    const hasChildren = subject.children && subject.children.length > 0;

    if (hasChildren) {
      // Toggle expansion
      setExpandedParent((prev) =>
        prev === subject.slug ? null : subject.slug
      );
    } else {
      // No children — select directly
      onChange(subject.slug);
    }
  };

  return (
    <div className="space-y-1">
      {/* Selected indicator */}
      {selectedSubject && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">已选：</span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: selectedSubject.color }}
          >
            {selectedParent && selectedParent.slug !== value
              ? `${selectedParent.nameZh} / ${selectedSubject.nameZh}`
              : selectedSubject.nameZh}
          </span>
        </div>
      )}

      {/* Level-1 subjects */}
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((subject) => {
          const isSelected = value === subject.slug;
          const isExpanded = activeExpanded === subject.slug;
          const isParentOfSelected = selectedParent?.slug === subject.slug && value !== subject.slug;
          const hasChildren = subject.children && subject.children.length > 0;

          return (
            <div key={subject.slug} className="contents">
              <button
                type="button"
                onClick={() => handleParentClick(subject)}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                  isSelected
                    ? "text-white shadow-sm scale-105"
                    : isParentOfSelected
                      ? "text-white/90 shadow-sm"
                      : isExpanded
                        ? "bg-muted text-foreground border-foreground/20"
                        : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
                )}
                style={
                  isSelected || isParentOfSelected
                    ? { backgroundColor: subject.color, borderColor: subject.color }
                    : undefined
                }
              >
                {subject.nameZh}
                {hasChildren && (
                  isExpanded
                    ? <ChevronDown className="h-3 w-3" />
                    : <ChevronRight className="h-3 w-3" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Level-2 sub-disciplines (expanded) */}
      {activeExpanded && (() => {
        const parent = subjects.find((s) => s.slug === activeExpanded);
        if (!parent?.children?.length) return null;

        return (
          <div className="mt-2 rounded-lg border bg-muted/30 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {parent.nameZh} — 二级学科
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange(parent.slug);
                  setExpandedParent(null);
                }}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                选择「{parent.nameZh}」整体
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {parent.children.map((child) => {
                const isChildSelected = value === child.slug;
                return (
                  <button
                    key={child.slug}
                    type="button"
                    onClick={() => {
                      onChange(child.slug);
                      setExpandedParent(null);
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                      isChildSelected
                        ? "text-white shadow-sm scale-105"
                        : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
                    )}
                    style={
                      isChildSelected
                        ? { backgroundColor: child.color, borderColor: child.color }
                        : undefined
                    }
                  >
                    {child.nameZh}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
