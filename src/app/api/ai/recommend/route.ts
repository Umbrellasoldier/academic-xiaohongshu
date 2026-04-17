import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "@/services/ai.service";

// POST /api/ai/recommend — Get AI-powered content recommendations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { interests = [], recentPosts = [] } = body;

    const keywords = await getRecommendations(interests, recentPosts);

    return NextResponse.json({ keywords });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "推荐服务暂时不可用";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
