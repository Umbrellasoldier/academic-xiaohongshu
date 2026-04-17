"use client";

import { useState, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  /** Current avatar URL */
  currentUrl?: string | null;
  /** Fallback text (first letter or icon) */
  fallback: string;
  /** CSS class for the fallback (e.g. colored background for rooms) */
  fallbackClassName?: string;
  /** "user" or "room" */
  targetType: "user" | "room";
  /** userId or roomId */
  targetId: string;
  /** Called with the new public URL after successful upload */
  onUploadComplete: (url: string) => void;
  /** Called on upload error */
  onError?: (message: string) => void;
  /** Avatar size */
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-16 w-16",
  md: "h-20 w-20",
  lg: "h-28 w-28",
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export function AvatarUpload({
  currentUrl,
  fallback,
  fallbackClassName,
  targetType,
  targetId,
  onUploadComplete,
  onError,
  size = "md",
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Client-side validation
      if (!ALLOWED_TYPES.includes(file.type)) {
        onError?.("不支持的图片格式，仅支持 JPEG、PNG、WebP、GIF");
        return;
      }
      if (file.size > MAX_SIZE) {
        onError?.("文件过大，最大支持 2MB");
        return;
      }

      // Show local preview immediately
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", targetType);
        formData.append("targetId", targetId);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "上传失败");
        }

        const { url } = await res.json();
        onUploadComplete(url);
      } catch (err) {
        setPreview(null);
        onError?.(
          err instanceof Error ? err.message : "上传失败，请稍后重试"
        );
      } finally {
        setIsUploading(false);
      }
    },
    [targetType, targetId, onUploadComplete, onError]
  );

  const displayUrl = preview || currentUrl;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "relative cursor-pointer rounded-full group",
          sizeClasses[size]
        )}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="上传头像"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ")
            fileInputRef.current?.click();
        }}
      >
        <Avatar className={cn(sizeClasses[size], "border")}>
          {displayUrl && <AvatarImage src={displayUrl} alt="头像" />}
          <AvatarFallback className={cn("text-lg", fallbackClassName)}>
            {fallback}
          </AvatarFallback>
        </Avatar>

        {/* Hover overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full",
            "bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity",
            isUploading && "opacity-100"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = ""; // allow re-selecting same file
          }}
        />
      </div>

      <p className="text-[10px] text-muted-foreground">
        点击上传（最大 2MB）
      </p>
    </div>
  );
}
