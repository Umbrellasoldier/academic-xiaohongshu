"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PenSquare, Send, Save, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichEditor } from "@/components/editor/rich-editor";
import { TagInput } from "@/components/editor/tag-input";
import { SubjectPicker } from "@/components/editor/subject-picker";
import { CoverImagePicker } from "@/components/editor/cover-image-picker";
import { CitationPicker } from "@/components/editor/citation-picker";
import { CitationCard } from "@/components/academic/citation-card";
import type { PaperMetadata } from "@/types";

export default function CreatePostPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [summary, setSummary] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [citations, setCitations] = useState<PaperMetadata[]>([]);
  const [showCitationPicker, setShowCitationPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    setError(null);

    // Client-side validation
    if (!title.trim()) {
      setError("请输入标题");
      return;
    }
    if (!subject) {
      setError("请选择学科分类");
      return;
    }
    if (!content) {
      setError("请输入内容");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          summary: summary.trim() || undefined,
          coverImage: coverImage || undefined,
          subjectId: subject, // Will be resolved to actual ID on server
          tagIds: tags,
          citations: citations.map((p, i) => ({
            id: p.id,
            title: p.title,
            authors: p.authors,
            doi: p.doi || null,
            arxivId: p.arxivId || null,
            abstract: p.abstract || null,
            journal: p.journal || null,
            year: p.year || null,
            url: p.url || null,
            citationCount: p.citationCount || null,
            order: i + 1,
          })),
          status: "PUBLISHED",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "发布失败");
        return;
      }

      const data = await res.json();
      router.push(`/post/${data.post?.id || "preview"}`);
    } catch {
      setError("发布失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      setError("请至少输入标题");
      return;
    }
    if (!subject) {
      setError("请选择学科分类后再保存草稿");
      return;
    }
    setError(null);
    setIsDraftSaving(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content || { type: "doc", content: [] },
          summary: summary.trim() || undefined,
          coverImage: coverImage || undefined,
          subjectId: subject || undefined,
          tagIds: tags,
          citations: citations.map((p, i) => ({
            id: p.id,
            title: p.title,
            authors: p.authors,
            doi: p.doi || null,
            arxivId: p.arxivId || null,
            abstract: p.abstract || null,
            journal: p.journal || null,
            year: p.year || null,
            url: p.url || null,
            citationCount: p.citationCount || null,
            order: i + 1,
          })),
          status: "DRAFT",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "保存草稿失败");
        return;
      }

      toast.success("草稿已保存");
    } catch {
      setError("保存草稿失败，请稍后重试");
    } finally {
      setIsDraftSaving(false);
    }
  };

  // Redirect to login if not authenticated
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <PenSquare className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-bold">请先登录</h2>
        <p className="mt-2 text-muted-foreground">
          登录后即可发布学术笔记
        </p>
        <Link
          href="/login?callbackUrl=/post/create"
          className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          去登录
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <PenSquare className="h-5 w-5" />
            <h1 className="text-xl font-bold">发布学术笔记</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isSubmitting || isDraftSaving}
            onClick={handleSaveDraft}
            type="button"
          >
            {isDraftSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            存草稿
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isSubmitting || !title.trim() || !subject}
            type="button"
          >
            {isSubmitting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            发布
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="space-y-6">
        {/* Cover Image */}
        <CoverImagePicker value={coverImage} onChange={setCoverImage} />

        {/* Title */}
        <Input
          type="text"
          placeholder="输入标题..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="text-xl font-bold border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
        />

        {/* Subject Picker */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            选择学科分类 <span className="text-destructive">*</span>
          </label>
          <SubjectPicker value={subject} onChange={setSubject} />
        </div>

        {/* Rich Text Editor */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            内容
          </label>
          <div className="relative">
            <RichEditor
              onChange={setContent}
              onCitationClick={() => setShowCitationPicker(!showCitationPicker)}
            />
            {showCitationPicker && (
              <div className="absolute right-0 top-12 z-50">
                <CitationPicker
                  onInsert={(paper) => {
                    if (!citations.find((c) => c.id === paper.id)) {
                      setCitations((prev) => [...prev, paper]);
                    }
                    setShowCitationPicker(false);
                  }}
                  onClose={() => setShowCitationPicker(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Citations */}
        {citations.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              引用论文 ({citations.length})
            </label>
            <div className="space-y-2">
              {citations.map((paper, i) => (
                <div key={paper.id} className="relative">
                  <CitationCard paper={paper} order={i + 1} />
                  <button
                    onClick={() =>
                      setCitations((prev) =>
                        prev.filter((c) => c.id !== paper.id)
                      )
                    }
                    className="absolute right-2 top-2 rounded p-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    type="button"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            摘要（可选 — 显示在卡片上的简短描述）
          </label>
          <textarea
            placeholder="用一两句话概括你的内容..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground text-right">
            {summary.length}/500
          </p>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            标签（最多5个）
          </label>
          <TagInput tags={tags} onChange={setTags} maxTags={5} />
        </div>
      </div>
    </div>
  );
}
