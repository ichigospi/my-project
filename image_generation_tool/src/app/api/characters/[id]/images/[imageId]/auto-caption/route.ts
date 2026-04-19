// 参照画像のキャプション自動生成スタブ。
//
// 実装候補（Phase 2 で差し込み）:
//   A. RunPod ComfyUI に ComfyUI-WD14-Tagger 拡張を追加し、
//      WD-Tagger で画像 → Danbooru タグ一覧
//   B. Hugging Face Inference API の SmilingWolf/wd-tagger-v3 を叩く
//   C. Claude / GPT-4V に画像を渡して Danbooru タグ風に書かせる
//
// いまは "not implemented" を返し、UI 側はローカルで
// キャラの登録情報からテンプレートタグを作る方針。

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "AI キャプションは Phase 2 で実装予定。今は「テンプレートから挿入」か手動編集をお使いください。",
      phase: "not_implemented",
    },
    { status: 501 },
  );
}
