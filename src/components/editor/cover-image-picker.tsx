"use client";

import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CoverImagePickerProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export function CoverImagePicker({ value, onChange }: CoverImagePickerProps) {
  const [showInput, setShowInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput("");
      setShowInput(false);
    }
  };

  if (value) {
    return (
      <div className="relative group rounded-lg overflow-hidden border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="封面图片"
          className="w-full h-48 object-cover"
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (showInput) {
    return (
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="输入图片 URL..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddUrl();
            }
          }}
          className="flex-1"
          autoFocus
        />
        <Button type="button" onClick={handleAddUrl} size="sm">
          确定
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowInput(false);
            setUrlInput("");
          }}
        >
          取消
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowInput(true)}
      className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors w-full"
    >
      <ImagePlus className="h-5 w-5" />
      添加封面图片（可选）
    </button>
  );
}
