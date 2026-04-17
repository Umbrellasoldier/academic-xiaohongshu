"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
  Plus,
  Search,
  Loader2,
  MessageCircle,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { RoomCard, RoomCardSkeleton } from "@/components/rooms/room-card";
import { useSubjects } from "@/lib/hooks/use-subjects";
import type { RoomData } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RoomsPage() {
  const [filter, setFilter] = useState<"all" | "joined">("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const { subjects } = useSubjects();

  // Build query URL
  const queryParams = new URLSearchParams();
  if (filter === "joined") queryParams.set("joined", "true");
  if (subjectFilter) queryParams.set("subject", subjectFilter);
  if (searchQuery) queryParams.set("q", searchQuery);
  const qs = queryParams.toString();

  const { data, error, isLoading, mutate } = useSWR<{ rooms: RoomData[] }>(
    `/api/rooms${qs ? `?${qs}` : ""}`,
    fetcher
  );

  const rooms = data?.rooms || [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">学术研讨室</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            加入研讨室，与同领域的研究者实时讨论学术问题
          </p>
        </div>
        <CreateRoomDialog onCreated={() => mutate()} />
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索研讨室..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Tab + Subject filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* All / Joined tabs */}
          <div className="flex rounded-lg border p-0.5">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter("joined")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === "joined"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              已加入
            </button>
          </div>

          {/* Subject filter */}
          <div className="flex flex-wrap items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => setSubjectFilter("")}
              className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                !subjectFilter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              全部学科
            </button>
            {subjects?.slice(0, 8).map((s) => (
              <button
                key={s.slug}
                onClick={() =>
                  setSubjectFilter(subjectFilter === s.slug ? "" : s.slug)
                }
                className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                  subjectFilter === s.slug
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                style={
                  subjectFilter === s.slug
                    ? { backgroundColor: s.color }
                    : undefined
                }
              >
                {s.nameZh}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Room Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <RoomCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">加载失败，请稍后重试</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="py-20 text-center">
          <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            {filter === "joined" ? "还没有加入任何研讨室" : "没有找到研讨室"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "joined"
              ? "浏览全部研讨室，找到感兴趣的加入"
              : "尝试其他搜索条件，或创建一个新的研讨室"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}

// Create Room Dialog
function CreateRoomDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subjectSlug, setSubjectSlug] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const { subjects: dialogSubjects } = useSubjects();

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setIsCreating(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          subjectSlug: subjectSlug || null,
          isPublic,
        }),
      });

      if (res.ok) {
        setOpen(false);
        setName("");
        setDescription("");
        setSubjectSlug("");
        onCreated();
      }
    } catch {
      // handle error silently
    } finally {
      setIsCreating(false);
    }
  }, [name, description, subjectSlug, isPublic, onCreated]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5" />
        }
      >
        <Plus className="h-4 w-4" />
        创建研讨室
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>创建学术研讨室</DialogTitle>
          <DialogDescription>
            创建一个研讨室，邀请同领域的研究者一起讨论
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              研讨室名称 *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：LLM对齐与安全研讨"
              maxLength={50}
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              简介
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简单描述研讨室的主题和规则..."
              rows={3}
              maxLength={500}
              className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              学科分类
            </label>
            <select
              value={subjectSlug}
              onChange={(e) => setSubjectSlug(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">不限学科</option>
              {dialogSubjects?.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.nameZh}
                </option>
              ))}
            </select>
          </div>

          {/* Public/Private */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={isPublic}
                onChange={() => setIsPublic(true)}
                className="accent-primary"
              />
              公开 — 任何人可加入
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={!isPublic}
                onChange={() => setIsPublic(false)}
                className="accent-primary"
              />
              私密 — 需审核加入
            </label>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            取消
          </DialogClose>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
          >
            {isCreating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
