import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Force dynamic — no build-time caching
export const dynamic = "force-dynamic";

// GET /api/subjects — Return the full subject hierarchy tree
export async function GET() {
  try {
    const all = await prisma.subject.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        nameZh: true,
        slug: true,
        color: true,
        icon: true,
        parentId: true,
      },
    });

    // Build tree: level-1 subjects with their level-2 children
    const level1 = all.filter((s) => !s.parentId);
    const childrenMap = new Map<string, typeof all>();

    for (const s of all) {
      if (s.parentId) {
        const arr = childrenMap.get(s.parentId) ?? [];
        arr.push(s);
        childrenMap.set(s.parentId, arr);
      }
    }

    const subjects = level1.map((s) => ({
      id: s.id,
      name: s.name,
      nameZh: s.nameZh,
      slug: s.slug,
      color: s.color,
      icon: s.icon,
      children: (childrenMap.get(s.id) ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        nameZh: c.nameZh,
        slug: c.slug,
        color: c.color,
        icon: c.icon,
      })),
    }));

    return NextResponse.json(
      { subjects },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("Get subjects error:", error);
    return NextResponse.json(
      { error: "获取学科列表失败" },
      { status: 500 }
    );
  }
}
