import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { aggregate } from "@/lib/aggregate";

export type { SummaryData } from "@/lib/aggregate";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const prevFrom = url.searchParams.get("prevFrom");
  const prevTo = url.searchParams.get("prevTo");
  const accountId = url.searchParams.get("accountId");

  const current = await aggregate(from, to, accountId);
  const previous =
    prevFrom && prevTo ? await aggregate(prevFrom, prevTo, accountId) : null;

  return NextResponse.json({ current, previous });
}
