"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { MathInline, MathBlock } from "@/lib/tiptap-extensions";
import { EditorToolbar } from "./editor-toolbar";

interface RichEditorProps {
  content?: string;
  onChange?: (json: Record<string, unknown>) => void;
  placeholder?: string;
  editable?: boolean;
  onCitationClick?: () => void;
}

export function RichEditor({
  content,
  onChange,
  placeholder = "开始写你的学术笔记...\n\n支持 Markdown 快捷语法：# 标题、**加粗**、*斜体*、- 列表、> 引用、```代码块\n\nLaTeX 公式：$行内公式$ 或 $$块级公式$$，Shift+Enter 换行",
  editable = true,
  onCitationClick,
}: RichEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: "rounded-md bg-muted p-4 font-mono text-sm",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "border-l-4 border-primary/30 pl-4 italic text-muted-foreground",
          },
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full mx-auto",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-4 hover:text-primary/80",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      MathInline,
      MathBlock,
    ],
    content: content || "",
    editable,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[300px] px-4 py-3",
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON() as Record<string, unknown>);
    },
  });

  if (!editor) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="h-12 border-b bg-muted/30" />
        <div className="min-h-[300px] animate-pulse px-4 py-3">
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="mt-3 h-4 w-1/2 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {editable && <EditorToolbar editor={editor} onCitationClick={onCitationClick} />}
      <EditorContent editor={editor} />
    </div>
  );
}
