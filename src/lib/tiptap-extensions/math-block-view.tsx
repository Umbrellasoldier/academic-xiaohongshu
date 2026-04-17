"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState, useRef, useEffect } from "react";
import katex from "katex";

export function MathBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const { latex } = node.attrs;
  const [isEditing, setIsEditing] = useState(!latex);
  const [editValue, setEditValue] = useState(latex || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renderRef = useRef<HTMLDivElement>(null);

  // Render KaTeX
  useEffect(() => {
    if (!isEditing && renderRef.current && latex) {
      try {
        katex.render(latex, renderRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch {
        renderRef.current.textContent = latex;
      }
    }
  }, [latex, isEditing]);

  // Focus + auto-resize
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [isEditing]);

  const handleConfirm = () => {
    if (editValue.trim()) {
      updateAttributes({ latex: editValue.trim() });
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <NodeViewWrapper>
        <div className="my-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">$$</span>
            <span>块级公式 — Enter 确认，Shift+Enter 换行</span>
          </div>
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleConfirm();
              }
              if (e.key === "Escape") setIsEditing(false);
            }}
            onBlur={handleConfirm}
            className="w-full resize-none rounded border-0 bg-transparent font-mono text-sm focus:outline-none"
            placeholder="输入 LaTeX 公式..."
            rows={2}
          />
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div
        className={`my-3 cursor-pointer rounded-lg px-4 py-3 text-center transition-colors hover:bg-muted/50 ${
          selected ? "bg-muted/50 ring-1 ring-primary/30" : ""
        }`}
        onClick={() => setIsEditing(true)}
      >
        <div ref={renderRef} className="overflow-x-auto" />
      </div>
    </NodeViewWrapper>
  );
}
