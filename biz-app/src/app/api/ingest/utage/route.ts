import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { SOURCES } from "@/lib/domain";

// UTAGEのwebhookアクションから叩かれる自動記録エンドポイント
//
// 使い方（UTAGE側のアクション設定）:
//   URL:  https://<このアプリのURL>/api/ingest/utage?key=<シークレット>&event=list_in&account=<アカウントID>&source=youtube
//   POSTボディ（任意）: email / name / date(YYYY-MM-DD) / source / event / account
//   クエリとボディの同名パラメータはクエリを優先
//
// event: list_in（リストイン）, free_apply（無料鑑定申込）, free_sent（鑑定送付）
// source: threads / insta / x / youtube / other（list_in時のみ意味を持つ）
const ALLOWED_STAGES = ["list_in", "free_apply", "free_sent"] as const;

async function parseBody(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const json = await req.json();
      return typeof json === "object" && json !== null ? json : {};
    }
    if (contentType.includes("form")) {
      const form = await req.formData();
      const out: Record<string, string> = {};
      form.forEach((v, k) => {
        if (typeof v === "string") out[k] = v;
      });
      return out;
    }
  } catch {
    // ボディなし・パース不能でもクエリだけで処理を続ける
  }
  return {};
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = await getSetting("ingest_secret");
  const key = url.searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseBody(req);
  const param = (name: string) => url.searchParams.get(name) || body[name] || "";

  const stage = param("event");
  if (!ALLOWED_STAGES.includes(stage as (typeof ALLOWED_STAGES)[number])) {
    return NextResponse.json(
      { error: `event は ${ALLOWED_STAGES.join(" / ")} のいずれかにしてください` },
      { status: 400 }
    );
  }

  const accountId = param("account");
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "account が不正です（設定画面のアカウントIDを指定）" }, { status: 400 });
  }

  const rawSource = param("source").toLowerCase();
  const source = SOURCES.some((s) => s.key === rawSource) ? rawSource : rawSource ? "other" : null;

  const dateParam = param("date");
  const occurredOn = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : new Date().toISOString().slice(0, 10);

  // 読者を識別できる場合はContactも作成/更新（将来の個人単位分析用）
  const externalId = param("email") || param("uid") || null;
  let contactId: string | null = null;
  if (externalId) {
    const contact = await prisma.contact.upsert({
      where: { accountId_externalId: { accountId, externalId } },
      update: { displayName: param("name") || undefined },
      create: {
        accountId,
        externalId,
        displayName: param("name") || "",
        source: source ?? "other",
      },
    });
    contactId = contact.id;
  }

  const event = await prisma.funnelEvent.create({
    data: {
      accountId,
      contactId,
      stage,
      source: stage === "list_in" ? (source ?? "other") : null,
      count: 1,
      occurredOn,
      note: param("note"),
      ingestedVia: "utage_webhook",
    },
  });

  return NextResponse.json({ ok: true, eventId: event.id });
}
