"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ExternalLink,
  Users,
  BookOpen,
  Hash,
  Calendar,
  Loader2,
  Copy,
  Check,
  Heart,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { PaperMetadata, PostCardData } from "@/types";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PaperDetailPage() {
  const params = useParams<{ doi: string }>();
  // DOI can contain slashes, so we decode the path segments
  const doi = decodeURIComponent(params.doi);

  const { data, error, isLoading } = useSWR<{ paper: PaperMetadata }>(
    `/api/papers?doi=${encodeURIComponent(doi)}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data?.paper) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          论文未找到
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          DOI: {doi}
        </p>
        <Link
          href="/feed"
          className="mt-4 inline-flex items-center text-sm text-primary hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回首页
        </Link>
      </div>
    );
  }

  const paper = data.paper;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/feed"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回
      </Link>

      <article className="space-y-6">
        {/* Title */}
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          {paper.title}
        </h1>

        {/* Authors */}
        <div className="flex items-start gap-2 text-sm">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-wrap gap-1">
            {paper.authors.map((author, i) => (
              <span key={i}>
                <span className="font-medium">{author.name}</span>
                {author.affiliation && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({author.affiliation})
                  </span>
                )}
                {i < paper.authors.length - 1 && (
                  <span className="text-muted-foreground">, </span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {paper.journal && (
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {paper.journal}
            </span>
          )}
          {paper.year && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {paper.year}
            </span>
          )}
          {paper.citationCount != null && (
            <span className="flex items-center gap-1.5">
              <Hash className="h-4 w-4" />
              被引用 {paper.citationCount} 次
            </span>
          )}
        </div>

        {/* Identifiers */}
        <div className="flex flex-wrap items-center gap-3">
          {paper.doi && <DOIBadge doi={paper.doi} />}
          {paper.arxivId && (
            <a
              href={`https://arxiv.org/abs/${paper.arxivId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"
            >
              arXiv:{paper.arxivId}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {paper.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              查看原文
            </a>
          )}
        </div>

        <Separator />

        {/* Abstract */}
        {paper.abstract && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">摘要</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {paper.abstract}
            </p>
          </div>
        )}

        <Separator />

        {/* Related Posts */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">相关笔记</h2>
          {paper.doi ? (
            <RelatedPosts doi={paper.doi} />
          ) : (
            <p className="text-sm text-muted-foreground">
              暂无引用此论文的笔记
            </p>
          )}
        </div>
      </article>
    </div>
  );
}

function RelatedPosts({ doi }: { doi: string }) {
  const { data, isLoading } = useSWR<{ posts: PostCardData[] }>(
    `/api/papers/${encodeURIComponent(doi)}/posts`,
    (url: string) => fetch(url).then((r) => r.json())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const posts = data?.posts || [];

  if (posts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        暂无引用此论文的笔记
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/post/${post.id}`}
          className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
        >
          <h3 className="text-sm font-medium line-clamp-2">{post.title}</h3>
          {post.summary && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {post.summary}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{post.author.displayName}</span>
            {post.subject && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: post.subject.color + "20",
                  color: post.subject.color,
                }}
              >
                {post.subject.nameZh}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Heart className="h-3 w-3" /> {post.likeCount}
            </span>
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" /> {post.commentCount}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function DOIBadge({ doi }: { doi: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(doi);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
    >
      DOI: {doi}
      {copied ? (
        <Check className="h-3 w-3" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}
