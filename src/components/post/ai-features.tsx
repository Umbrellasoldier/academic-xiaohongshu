"use client";

import { useState, useCallback } from "react";
import { Sparkles, Languages, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LatexText } from "@/components/academic/latex-renderer";

interface AIFeaturesProps {
  postId: string;
  title: string;
  content: unknown; // TipTap JSON
}

export function AIFeatures({ postId, title, content }: AIFeaturesProps) {
  const [summaryText, setSummaryText] = useState("");
  const [translationText, setTranslationText] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const handleSummarize = useCallback(async () => {
    if (summaryText) {
      setShowSummary(!showSummary);
      return;
    }

    setIsSummarizing(true);
    setShowSummary(true);
    setSummaryText("");

    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) {
        setSummaryText("AI 摘要服务暂时不可用");
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setSummaryText("无法读取响应流");
        return;
      }

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setSummaryText(accumulated);
      }
    } catch {
      setSummaryText("AI 摘要生成失败，请稍后重试");
    } finally {
      setIsSummarizing(false);
    }
  }, [title, content, summaryText, showSummary]);

  const handleTranslate = useCallback(async () => {
    if (translationText) {
      setShowTranslation(!showTranslation);
      return;
    }

    setIsTranslating(true);
    setShowTranslation(true);
    setTranslationText("");

    // Extract plain text from content
    const plainText =
      typeof content === "string"
        ? content
        : extractText(content as Record<string, unknown>);

    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${title}\n\n${plainText}`,
          sourceLang: "中文",
          targetLang: "英文",
        }),
      });

      if (!res.ok) {
        setTranslationText("翻译服务暂时不可用");
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setTranslationText("无法读取响应流");
        return;
      }

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setTranslationText(accumulated);
      }
    } catch {
      setTranslationText("翻译失败，请稍后重试");
    } finally {
      setIsTranslating(false);
    }
  }, [title, content, translationText, showTranslation]);

  return (
    <div className="space-y-3">
      {/* Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSummarize}
          disabled={isSummarizing}
          className="gap-1.5"
        >
          {isSummarizing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          AI 摘要
          {summaryText &&
            (showSummary ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            ))}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleTranslate}
          disabled={isTranslating}
          className="gap-1.5"
        >
          {isTranslating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Languages className="h-3.5 w-3.5" />
          )}
          AI 翻译
          {translationText &&
            (showTranslation ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            ))}
        </Button>
      </div>

      {/* Summary Panel */}
      {showSummary && (
        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900 dark:bg-purple-950/30">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-purple-700 dark:text-purple-300">
              <Sparkles className="h-4 w-4" />
              AI 智能摘要
            </div>
            <button
              onClick={() => setShowSummary(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {summaryText ? (
              <LatexText text={summaryText} />
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在生成摘要...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Translation Panel */}
      {showTranslation && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-blue-300">
              <Languages className="h-4 w-4" />
              AI 学术翻译（中→英）
            </div>
            <button
              onClick={() => setShowTranslation(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {translationText ? (
              <LatexText text={translationText} />
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在翻译...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Extract plain text from TipTap JSON
 */
function extractText(node: Record<string, unknown>): string {
  if (!node) return "";
  if (node.type === "text") return (node.text as string) || "";

  const content = node.content as Record<string, unknown>[] | undefined;
  if (Array.isArray(content)) {
    return content.map(extractText).join("\n");
  }
  return "";
}
