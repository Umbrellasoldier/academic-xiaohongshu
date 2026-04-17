"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarUpload } from "@/components/avatar-upload";
import type { UserProfile } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function UserSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch current profile to pre-fill
  const { data: profileData } = useSWR<{ user: UserProfile }>(
    params.username ? `/api/users/${params.username}` : null,
    fetcher
  );

  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    institution: "",
    orcid: "",
    avatar: "",
  });

  // Pre-fill form when profile loads
  useEffect(() => {
    if (profileData?.user) {
      const u = profileData.user;
      setForm({
        displayName: u.displayName || "",
        bio: u.bio || "",
        institution: u.institution || "",
        orcid: u.orcid || "",
        avatar: u.avatar || "",
      });
    }
  }, [profileData]);

  const handleSave = async () => {
    if (!form.displayName.trim()) {
      setError("显示名称不能为空");
      return;
    }
    setError("");
    setIsSaving(true);

    try {
      // Build payload — only send non-empty avatar if it's a valid URL
      const payload: Record<string, string> = {
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        institution: form.institution.trim(),
        orcid: form.orcid.trim(),
      };
      if (form.avatar.trim()) {
        payload.avatar = form.avatar.trim();
      }

      const res = await fetch(`/api/users/${params.username}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "保存失败");
        return;
      }

      router.push(`/user/${params.username}`);
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setIsSaving(false);
    }
  };

  // Auth guard
  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    );
  }

  // Don't allow editing someone else's profile
  if (session.user?.username !== params.username) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-muted-foreground">无权修改他人资料</p>
        <Link
          href={`/user/${params.username}`}
          className="mt-4 inline-flex items-center text-sm text-primary hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回
        </Link>
      </div>
    );
  }

  const previewAvatar = form.avatar.trim() || profileData?.user?.avatar || null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/user/${session.user?.username}`}
        className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回个人主页
      </Link>

      <h1 className="text-2xl font-bold mb-6">编辑资料</h1>

      <div className="space-y-6">
        {/* Avatar */}
        <div className="space-y-2">
          <label className="text-sm font-medium">头像</label>
          <div className="flex items-center gap-4">
            {session.user?.id ? (
              <AvatarUpload
                currentUrl={previewAvatar}
                fallback={
                  form.displayName.charAt(0).toUpperCase() || "?"
                }
                targetType="user"
                targetId={session.user.id}
                onUploadComplete={(url) => {
                  setForm((prev) => ({ ...prev, avatar: url }));
                }}
                onError={(msg) => setError(msg)}
                size="md"
              />
            ) : null}
            <div className="flex-1">
              <Input
                value={form.avatar}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, avatar: e.target.value }))
                }
                placeholder="或粘贴图片链接（https://...）"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                支持点击上传或粘贴 HTTPS 图片链接
              </p>
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">显示名称</label>
          <Input
            value={form.displayName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, displayName: e.target.value }))
            }
            placeholder="你的名字"
            maxLength={50}
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="text-sm font-medium">个人简介</label>
          <textarea
            value={form.bio}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, bio: e.target.value }))
            }
            placeholder="介绍一下自己..."
            rows={3}
            maxLength={500}
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground text-right">
            {form.bio.length}/500
          </p>
        </div>

        {/* Institution */}
        <div className="space-y-2">
          <label className="text-sm font-medium">所在机构</label>
          <Input
            value={form.institution}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, institution: e.target.value }))
            }
            placeholder="大学或研究机构名称"
            maxLength={100}
          />
        </div>

        {/* ORCID */}
        <div className="space-y-2">
          <label className="text-sm font-medium">ORCID</label>
          <Input
            value={form.orcid}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, orcid: e.target.value }))
            }
            placeholder="0000-0000-0000-0000"
          />
          <p className="text-xs text-muted-foreground">
            ORCID 是学术身份标识符，可在{" "}
            <a
              href="https://orcid.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              orcid.org
            </a>{" "}
            注册获取
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Link href={`/user/${session.user?.username}`}>
            <Button variant="outline">取消</Button>
          </Link>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
