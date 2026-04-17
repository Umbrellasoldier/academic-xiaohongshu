import { NextRequest, NextResponse } from "next/server";
import { translateAcademic } from "@/services/ai.service";

// POST /api/ai/translate — Stream academic translation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, sourceLang = "英文", targetLang = "中文" } = body;

    if (!text) {
      return NextResponse.json(
        { error: "翻译文本不能为空" },
        { status: 400 }
      );
    }

    if (text.length > 10000) {
      return NextResponse.json(
        { error: "文本过长，最多支持10000字符" },
        { status: 400 }
      );
    }

    const stream = await translateAcademic(text, sourceLang, targetLang);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "翻译服务暂时不可用";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
