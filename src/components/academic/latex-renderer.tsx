"use client";

import { useRef, useEffect } from "react";
import katex from "katex";

interface LatexRendererProps {
  /** Raw LaTeX string */
  latex: string;
  /** Display mode (block) vs inline */
  displayMode?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Renders a single LaTeX expression using KaTeX.
 */
export function LatexRenderer({
  latex,
  displayMode = false,
  className,
}: LatexRendererProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, {
          throwOnError: false,
          displayMode,
        });
      } catch {
        ref.current.textContent = latex;
      }
    }
  }, [latex, displayMode]);

  return <span ref={ref} className={className} />;
}

/**
 * Parses text containing inline $...$ and block $$...$$ LaTeX,
 * returning React elements with rendered math.
 */
export function LatexText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = parseLatex(text);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return <span key={i}>{part.content}</span>;
        }
        return (
          <LatexRenderer
            key={i}
            latex={part.content}
            displayMode={part.type === "block"}
          />
        );
      })}
    </span>
  );
}

interface ParsedPart {
  type: "text" | "inline" | "block";
  content: string;
}

function parseLatex(text: string): ParsedPart[] {
  const parts: ParsedPart[] = [];
  // Match $$...$$ (block) and $...$ (inline) — block first to avoid greedy conflicts
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      // Block math $$...$$
      parts.push({ type: "block", content: match[1] });
    } else if (match[2] !== undefined) {
      // Inline math $...$
      parts.push({ type: "inline", content: match[2] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts;
}
