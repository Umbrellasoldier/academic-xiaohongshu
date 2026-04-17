"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState, useRef, useEffect } from "react";
import katex from "katex";

export function MathInlineView({ node, updateAttributes, selected }: NodeViewProps) {
  const { latex } = node.attrs;
  const [isEditing, setIsEditing] = useState(!latex);
  const [editValue, setEditValue] = useState(latex || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const renderRef = useRef<HTMLSpanElement>(null);

  // Render KaTeX
  useEffect(() => {
    if (!isEditing && renderRef.current && latex) {
      try {
        katex.render(latex, renderRef.current, {
          throwOnError: false,
          displayMode: false,
        });
      } catch {
        renderRef.current.textContent = latex;
      }
    }
  }, [latex, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
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
      <NodeViewWrapper as="span" className="inline">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") setIsEditing(false);
          }}
          onBlur={handleConfirm}
          className="inline-block rounded border border-primary/50 bg-primary/5 px-1.5 py-0.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="LaTeX..."
          style={{ minWidth: "60px" }}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className={`math-inline-rendered inline cursor-pointer rounded px-0.5 transition-colors hover:bg-primary/10 ${selected ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
      onClick={() => setIsEditing(true)}
    >
      <span ref={renderRef} />
    </NodeViewWrapper>
  );
}
