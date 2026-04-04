import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // LINE Webhook verification
    if (!body.events || body.events.length === 0) {
      return NextResponse.json({ status: "ok" });
    }

    // Process events (stored client-side for now, webhook logs for future server-side processing)
    for (const event of body.events) {
      if (event.type === "message") {
        console.log(`[LINE Webhook] Message from ${event.source?.userId}: ${event.message?.text}`);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("[LINE Webhook Error]", e);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "LINE webhook endpoint active" });
}
