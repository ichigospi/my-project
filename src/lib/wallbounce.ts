// 壁打ち用のコピー文（Gemini等の外部AIに貼って、カード設計表・骨組みを相談するためのテキスト）
import type { ScriptProject } from "@/lib/project-store";
import { buildTechniqueBrief } from "@/lib/tarot-norms";

const GENRE_LABEL: Record<string, string> = { love: "恋愛", money: "金運", general: "総合運", work: "仕事運", health: "健康運" };

// カード設計表（背骨＋各カードの中身＋カードにしない要素＋今回の型）
export function cardPlanText(project: ScriptProject): string {
  const plan = project.cardPlan;
  if (!plan?.slots?.length) return "";
  const b = plan.backbone;
  const lines: string[] = [];
  lines.push(`【企画】${project.title || "（無題）"}${project.genre ? `／ジャンル: ${GENRE_LABEL[project.genre] || project.genre}` : ""}／${plan.slots.length}枚`);
  if (b && (b.theme || b.metaphor || b.promise)) {
    lines.push("【背骨】");
    lines.push(`- 主張: ${b.theme || "—"}`);
    lines.push(`- 中心メタファー: ${b.metaphor || "—"}`);
    lines.push(`- 冒頭の約束（終盤で同じ言葉で回収）: ${b.promise || "—"}`);
  }
  lines.push("【カード設計表】");
  plan.slots.forEach((sl, i) => {
    const role = sl.role === "追加" ? `追加「${sl.title}」` : sl.role;
    lines.push(`${i + 1}枚目${sl.card ? ` ${sl.card.name}（${sl.card.orientation}）` : "（カード未定）"}｜役割: ${role}`);
    if (sl.content) lines.push(`  - 何を視るか: ${sl.content}`);
    if (sl.meaning) lines.push(`  - 正統な意味: ${sl.meaning}`);
    if (sl.highlight) lines.push(`  - 絵柄の見せ場: ${sl.highlight}`);
    if (sl.message) lines.push(`  - 伝えること: ${sl.message}`);
    if (sl.flow) lines.push(`  - 流れ: ${sl.flow}`);
  });
  if (plan.outside?.length) lines.push(`【カードにしない要素】${plan.outside.map((o) => `${o.title}→${o.where}${o.note ? `（${o.note}）` : ""}`).join("／")}`);
  const brief = buildTechniqueBrief(plan.techniques, { genre: project.genre });
  if (brief) { lines.push(""); lines.push(brief); }
  return lines.join("\n");
}

// 骨組み（具体ロジック）。保存されているテキストをそのまま
export function skeletonText(project: ScriptProject): string {
  return (project.structureProposal?.concept || "").trim();
}

const ROLE_HEAD = "あなたはプロのタロット占い師兼スピリチュアルマーケターです。語り手はアリサ（守護天使様の世界観。龍神・白蛇・神様など別の存在は出さない）。";

// Gemini等に貼る壁打ちメッセージ
export function wallBounceMessage(project: ScriptProject, kind: "plan" | "skeleton" | "both"): string {
  const plan = cardPlanText(project);
  const skel = skeletonText(project);
  const parts: string[] = [ROLE_HEAD];
  if (kind === "plan") {
    parts.push("次の「カード設計表」を壁打ちしたいです。構成ロジック（1枚目 現状と兆し→2枚目 言い当てと共感→3枚目 仮想敵と常識破壊＝核→4枚目 今日やること1つ→最後 理想の未来。追加カードは元ネタ固有の内容）に照らして、次の5点で評価し、直すべき箇所は「このカードの伝えることをこう変える」の形で具体的に書き直してください。");
    parts.push("1. 各カードが役割どおりか（1〜2枚目で原因・解決・未来を先食いしていないか／3枚目が核になっているか／4枚目が現状診断になっていないか）\n2. 出たカードの正統な意味の範囲で読めているか（捏造していないか）\n3. 背骨（主張・中心メタファー・冒頭の約束）が全カードを貫いているか\n4. 訴求の強さ（言い当て・常識破壊・理想の未来が刺さるか。平熱になっていないか）\n5. カード間の橋渡し（前のカードの末尾が次のカードの役割を問いにしているか）");
    parts.push("出力は、カードごとに「評価（1行）→直すなら書き直し案」。最後に背骨の修正案があれば1行。前置き・挨拶は不要です。");
    parts.push(plan || "（カード設計表がありません）");
  } else if (kind === "skeleton") {
    parts.push("次の「骨組み（具体ロジック）」を壁打ちしたいです。カード設計表の役割どおりか、構成ロジック（冒頭: 選民→正当化→テーマ→予告→最後のカード予告→軽CTA／本編: 各カードの役割と橋渡し、3枚目直前の離脱防止、3枚目後の口コミ・時期／終盤: まとめ→思い→未知数→無料鑑定→口コミ→対比→枠切迫→選民回収→決め台詞、1,000字以内）に照らして、問題のあるセクションだけを指摘し、そのセクションの書き直し案を同じ書式で出してください。");
    parts.push("見るポイント: 先食い（後のカードや終盤の内容が前に出ていないか）／位置違い（離脱防止・口コミ・対比・CTAの場所）／意味が通らない・因果が飛ぶ箇所／重複／字数配分（約250字/分）／型が指定の場所に1回ずつ入っているか。問題のないセクションは触らないでください。前置き・挨拶は不要です。");
    if (plan) parts.push("＝＝ 参考: カード設計表 ＝＝\n" + plan);
    parts.push("＝＝ 骨組み ＝＝\n" + (skel || "（骨組みがありません）"));
  } else {
    parts.push("次の「カード設計表」と「骨組み（具体ロジック）」を壁打ちしたいです。まず設計表を構成ロジック（1枚目 現状と兆し→2枚目 言い当てと共感→3枚目 仮想敵と常識破壊＝核→4枚目 今日やること1つ→最後 理想の未来）に照らして評価し、次に骨組みが設計表どおりか・先食いや位置違いが無いか・字数配分（約250字/分）が適切かを見てください。直すべき箇所だけ、書き直し案を同じ書式で出してください。前置き・挨拶は不要です。");
    parts.push("＝＝ カード設計表 ＝＝\n" + (plan || "（カード設計表がありません）"));
    parts.push("＝＝ 骨組み ＝＝\n" + (skel || "（骨組みがありません）"));
  }
  return parts.join("\n\n");
}
