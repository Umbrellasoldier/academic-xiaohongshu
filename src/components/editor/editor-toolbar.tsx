"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  CodeSquare,
  Undo,
  Redo,
  Link as LinkIcon,
  ImagePlus,
  Minus,
  Sigma,
  SquareSigma,
  BookMarked,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback } from "react";

interface EditorToolbarProps {
  editor: Editor;
  onCitationClick?: () => void;
}

interface ToolbarItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action: () => void;
  isActive?: () => boolean;
}

export function EditorToolbar({ editor, onCitationClick }: EditorToolbarProps) {
  const addImage = useCallback(() => {
    const url = window.prompt("输入图片 URL");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("输入链接 URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addInlineMath = useCallback(() => {
    const latex = window.prompt("输入行内 LaTeX 公式", "E=mc^2");
    if (latex) {
      editor.chain().focus().setMathInline(latex).run();
    }
  }, [editor]);

  const addBlockMath = useCallback(() => {
    const latex = window.prompt(
      "输入块级 LaTeX 公式",
      "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}"
    );
    if (latex) {
      editor.chain().focus().setMathBlock(latex).run();
    }
  }, [editor]);

  const toolbarGroups: ToolbarItem[][] = [
    // Text formatting
    [
      {
        icon: Bold,
        title: "加粗 (Ctrl+B)",
        action: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive("bold"),
      },
      {
        icon: Italic,
        title: "斜体 (Ctrl+I)",
        action: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive("italic"),
      },
      {
        icon: Strikethrough,
        title: "删除线",
        action: () => editor.chain().focus().toggleStrike().run(),
        isActive: () => editor.isActive("strike"),
      },
      {
        icon: Code,
        title: "行内代码",
        action: () => editor.chain().focus().toggleCode().run(),
        isActive: () => editor.isActive("code"),
      },
    ],
    // Headings
    [
      {
        icon: Heading1,
        title: "一级标题",
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor.isActive("heading", { level: 1 }),
      },
      {
        icon: Heading2,
        title: "二级标题",
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor.isActive("heading", { level: 2 }),
      },
      {
        icon: Heading3,
        title: "三级标题",
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: () => editor.isActive("heading", { level: 3 }),
      },
    ],
    // Lists & blocks
    [
      {
        icon: List,
        title: "无序列表",
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive("bulletList"),
      },
      {
        icon: ListOrdered,
        title: "有序列表",
        action: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: () => editor.isActive("orderedList"),
      },
      {
        icon: Quote,
        title: "引用块",
        action: () => editor.chain().focus().toggleBlockquote().run(),
        isActive: () => editor.isActive("blockquote"),
      },
      {
        icon: CodeSquare,
        title: "代码块",
        action: () => editor.chain().focus().toggleCodeBlock().run(),
        isActive: () => editor.isActive("codeBlock"),
      },
      {
        icon: Minus,
        title: "分割线",
        action: () => editor.chain().focus().setHorizontalRule().run(),
      },
    ],
    // Media & links
    [
      {
        icon: LinkIcon,
        title: "插入链接",
        action: setLink,
        isActive: () => editor.isActive("link"),
      },
      {
        icon: ImagePlus,
        title: "插入图片",
        action: addImage,
      },
    ],
    // Math / LaTeX
    [
      {
        icon: Sigma,
        title: "行内公式 ($...$)",
        action: addInlineMath,
      },
      {
        icon: SquareSigma,
        title: "块级公式 ($$...$$)",
        action: addBlockMath,
      },
    ],
    // Academic
    ...(onCitationClick
      ? [
          [
            {
              icon: BookMarked,
              title: "引用论文",
              action: onCitationClick,
            },
          ],
        ]
      : []),
    // History
    [
      {
        icon: Undo,
        title: "撤销 (Ctrl+Z)",
        action: () => editor.chain().focus().undo().run(),
      },
      {
        icon: Redo,
        title: "重做 (Ctrl+Shift+Z)",
        action: () => editor.chain().focus().redo().run(),
      },
    ],
  ];

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
      {toolbarGroups.map((group, groupIndex) => (
        <div key={groupIndex} className="flex items-center">
          {groupIndex > 0 && (
            <div className="mx-1 h-5 w-px bg-border" />
          )}
          {group.map((item, itemIndex) => (
            <Tooltip key={itemIndex}>
              <TooltipTrigger
                className={`inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors ${
                  item.isActive?.()
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  item.action();
                }}
                type="button"
              >
                <item.icon className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {item.title}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ))}
    </div>
  );
}
