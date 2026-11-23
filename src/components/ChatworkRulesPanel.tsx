"use client";

// Chatwork通知の設定パネル: 「いつ → どのルーム → 誰に → 何を」を1行ずつ読める形で設定する
import { useEffect, useState } from "react";
import { NOTIFY_EVENTS, PLACEHOLDERS, eventDef, genRuleId, recipientLabel, renderTemplate, type ChatworkConfig, type ChatworkRule, type NotifyEvent, type NotifyLogEntry, type Recipient } from "@/lib/chatwork-rules";
import { getChannels } from "@/lib/channel-store";

type Room = { roomId: string; name: string; type: string };
type Member = { accountId: string; name: string; role: string };

const SAMPLE_CTX = { title: "（テスト）半年以内に高額当選する人だけに届く話", channelName: "テストチャンネル", reviewUrl: "https://example.com/create?project=test&step=review", refUrls: ["https://youtu.be/xxxx"], thumbTelop: "金色の扉が開く", thumbDesignUrl: "https://example.com/design", assigneeName: "テストライター", comment: "（コメント）" };

export default function ChatworkRulesPanel({ token }: { token?: string }) {
  const [config, setConfig] = useState<ChatworkConfig | null>(null);
  const [log, setLog] = useState<NotifyLogEntry[]>([]);
  const [migrated, setMigrated] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [membersByRoom, setMembersByRoom] = useState<Record<string, Member[]>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const channels = typeof window !== "undefined" ? getChannels() : [];

  const load = async () => {
    try {
      const res = await fetch("/api/notify/rules");
      const d = await res.json();
      if (d.error) { setMsg({ ok: false, text: d.error }); return; }
      setConfig(d.config); setLog(d.log || []); setMigrated(!!d.migrated); setHasToken(!!d.hasToken);
    } catch { setMsg({ ok: false, text: "設定の読み込みに失敗しました" }); }
  };
  useEffect(() => { void load(); }, []);

  const update = (next: ChatworkConfig) => { setConfig(next); setDirty(true); };
  const save = async () => {
    if (!config) return;
    setBusy("save"); setMsg(null);
    try {
      const res = await fetch("/api/notify/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) });
      const d = await res.json();
      if (d.error) setMsg({ ok: false, text: d.error }); else { setMsg({ ok: true, text: "通知ルールを保存しました" }); setDirty(false); setMigrated(false); }
    } catch { setMsg({ ok: false, text: "保存に失敗しました" }); }
    finally { setBusy(""); }
  };
  const loadRooms = async () => {
    setBusy("rooms"); setMsg(null);
    try {
      const res = await fetch("/api/notify/chatwork-rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token || "" }) });
      const d = await res.json();
      if (d.error) setMsg({ ok: false, text: d.error }); else setRooms(d.rooms || []);
    } catch { setMsg({ ok: false, text: "ルーム一覧の取得に失敗しました" }); }
    finally { setBusy(""); }
  };
  const loadMembers = async (roomId: string) => {
    if (!roomId || membersByRoom[roomId]) return;
    setBusy(`members:${roomId}`);
    try {
      const res = await fetch(`/api/notify/rules?members=${encodeURIComponent(roomId)}`);
      const d = await res.json();
      if (!d.error) setMembersByRoom((p) => ({ ...p, [roomId]: d.members || [] }));
      else setMsg({ ok: false, text: d.error });
    } catch { /* ignore */ }
    finally { setBusy(""); }
  };
  const testRule = async (rule: ChatworkRule) => {
    if (dirty) { setMsg({ ok: false, text: "先に「保存」を押してからテスト送信してください" }); return; }
    setBusy(`test:${rule.id}`); setMsg(null);
    try {
      const res = await fetch("/api/notify/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: rule.event, context: SAMPLE_CTX, onlyRuleId: rule.id }) });
      const d = await res.json();
      const r = (d.results || [])[0];
      if (d.error) setMsg({ ok: false, text: d.error });
      else if (d.skipped) setMsg({ ok: false, text: d.skipped });
      else if (r?.ok) setMsg({ ok: true, text: `テスト送信しました → ${rule.roomName || rule.roomId}（To: ${r.to.length}人）` });
      else setMsg({ ok: false, text: r?.error || "送信に失敗しました" });
      void load();
    } catch { setMsg({ ok: false, text: "テスト送信に失敗しました" }); }
    finally { setBusy(""); }
  };

  const addRule = (event: NotifyEvent) => {
    if (!config) return;
    const d = eventDef(event);
    const base = config.rules.find((r) => r.event === event) || config.rules[0];
    const rule: ChatworkRule = { id: genRuleId(), event, enabled: true, roomId: base?.roomId || "", roomName: base?.roomName, to: [], template: { title: d.title, body: d.body } };
    update({ ...config, rules: [...config.rules, rule] });
    setEditing(rule.id);
  };
  const setRule = (id: string, patch: Partial<ChatworkRule>) => { if (config) update({ ...config, rules: config.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }); };
  const removeRule = (id: string) => { if (config && confirm("このルールを削除しますか？")) update({ ...config, rules: config.rules.filter((r) => r.id !== id) }); };
  const dupRule = (r: ChatworkRule) => { if (config) update({ ...config, rules: [...config.rules, { ...r, id: genRuleId(), memo: (r.memo || "") + "（複製）" }] }); };

  if (!config) return <p className="text-sm text-gray-400">通知ルールを読み込んでいます…</p>;

  const roomLabel = (r: ChatworkRule) => r.roomName || rooms.find((x) => x.roomId === r.roomId)?.name || (r.roomId ? `ルームID ${r.roomId}` : "（ルーム未設定）");
  const recipientsText = (list: Recipient[]) => (list.length ? list.map((x) => recipientLabel(x, config)).join("、") : "（宛先なし。Toを付けずに送ります）");

  const RecipientPicker = ({ value, onChange, roomId }: { value: Recipient[]; onChange: (v: Recipient[]) => void; roomId: string }) => {
    const members = membersByRoom[roomId] || [];
    const has = (k: Recipient["kind"], id?: string) => value.some((v) => v.kind === k && (k !== "account" || v.accountId === id));
    const toggle = (r: Recipient) => onChange(has(r.kind, r.accountId) ? value.filter((v) => !(v.kind === r.kind && (r.kind !== "account" || v.accountId === r.accountId))) : [...value, r]);
    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => toggle({ kind: "owner" })} className={`px-2 py-1 rounded-full text-xs border ${has("owner") ? "bg-accent text-white border-accent" : "bg-white border-gray-300 text-gray-600"}`}>オーナー</button>
          <button onClick={() => toggle({ kind: "assignee" })} className={`px-2 py-1 rounded-full text-xs border ${has("assignee") ? "bg-purple-600 text-white border-purple-600" : "bg-white border-gray-300 text-gray-600"}`}>この企画の担当ライター</button>
          {config.writers.map((w) => (
            <button key={w.accountId} onClick={() => toggle({ kind: "account", accountId: w.accountId, name: w.name })} className={`px-2 py-1 rounded-full text-xs border ${has("account", w.accountId) ? "bg-teal-600 text-white border-teal-600" : "bg-white border-gray-300 text-gray-600"}`}>{w.name}</button>
          ))}
          {members.filter((m) => !config.writers.some((w) => w.accountId === m.accountId)).map((m) => (
            <button key={m.accountId} onClick={() => toggle({ kind: "account", accountId: m.accountId, name: m.name })} className={`px-2 py-1 rounded-full text-xs border ${has("account", m.accountId) ? "bg-teal-600 text-white border-teal-600" : "bg-white border-gray-300 text-gray-600"}`}>{m.name}</button>
          ))}
          {!membersByRoom[roomId] && roomId && (
            <button onClick={() => loadMembers(roomId)} disabled={busy === `members:${roomId}`} className="px-2 py-1 rounded-full text-xs border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50">{busy === `members:${roomId}` ? "取得中…" : "＋ ルームのメンバーから選ぶ"}</button>
          )}
        </div>
        <p className="text-[11px] text-gray-400">「オーナー」「この企画の担当ライター」は送るときに実際の人に置き換わります（下の役割設定・企画の担当ライター）。</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {migrated && <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">今までの設定（ルームID・オーナー・ライター・追加メンション）から通知ルールを組み立てました。内容を確認して「保存」を押すと、この形で確定します。</p>}
      {!hasToken && <p className="text-xs rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2">APIトークンが未保存です。上でトークンを入力して「保存」してから、ルームを選んでください。</p>}

      {/* 役割 */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-semibold">役割（宛先の置き換え先）</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600 w-24">オーナー</span>
          <input value={config.ownerAccountId} onChange={(e) => update({ ...config, ownerAccountId: e.target.value.trim() })} placeholder="ChatworkアカウントID（数字）" className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-mono w-56" />
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm mb-1"><span className="text-gray-600 w-24">ライター名簿</span><span className="text-xs text-gray-400">企画ごとの担当ライターはここから選びます</span></div>
          <div className="space-y-1.5 pl-24">
            {config.writers.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={w.name} onChange={(e) => update({ ...config, writers: config.writers.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })} placeholder="名前" className="px-2 py-1 rounded border border-gray-200 text-sm w-40" />
                <input value={w.accountId} onChange={(e) => update({ ...config, writers: config.writers.map((x, k) => (k === i ? { ...x, accountId: e.target.value.trim() } : x)) })} placeholder="アカウントID" className="px-2 py-1 rounded border border-gray-200 text-sm font-mono w-36" />
                <button onClick={() => update({ ...config, writers: config.writers.filter((_, k) => k !== i) })} className="text-gray-400 hover:text-red-600 text-sm">✕</button>
              </div>
            ))}
            <button onClick={() => update({ ...config, writers: [...config.writers, { name: "", accountId: "" }] })} className="text-xs text-accent hover:underline">＋ ライターを追加</button>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 mt-2 pl-24">
            <input type="checkbox" checked={config.fallbackToAllWriters} onChange={(e) => update({ ...config, fallbackToAllWriters: e.target.checked })} />
            企画に担当ライターが設定されていないときは、名簿のライター全員に送る
          </label>
        </div>
      </div>

      {/* ルール一覧 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">通知ルール（{config.rules.length}件）</p>
        <div className="flex items-center gap-2">
          <button onClick={loadRooms} disabled={busy === "rooms"} className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs hover:bg-gray-50 disabled:opacity-50">{busy === "rooms" ? "取得中…" : "🏠 ルーム一覧を取得"}</button>
          <select onChange={(e) => { if (e.target.value) { addRule(e.target.value as NotifyEvent); e.target.value = ""; } }} defaultValue="" className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs bg-white">
            <option value="">＋ ルールを追加…</option>
            {NOTIFY_EVENTS.map((ev) => <option key={ev.id} value={ev.id}>{ev.emoji} {ev.label}</option>)}
          </select>
        </div>
      </div>
      {config.rules.length === 0 && <p className="text-sm text-gray-400">ルールがありません。「＋ ルールを追加」からイベントを選んでください。</p>}
      <div className="space-y-3">
        {config.rules.map((r) => {
          const ev = eventDef(r.event);
          const open = editing === r.id;
          return (
            <div key={r.id} className={`rounded-xl border p-4 ${r.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-70"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{ev.emoji} {ev.label}{r.memo ? <span className="ml-2 text-xs text-gray-400">{r.memo}</span> : null}</p>
                  <p className="text-xs text-gray-600 mt-1">ルーム: <span className="font-medium">{roomLabel(r)}</span>　→　To: <span className="font-medium">{recipientsText(r.to)}</span></p>
                  <p className="text-xs text-gray-500">タスク: {r.task?.enabled ? `${recipientsText(r.task.assignees)}／期限 ${r.task.dueDays === 0 ? "当日" : `${r.task.dueDays}日後`}` : "なし"}{r.channelIds?.length ? `　条件: ${r.channelIds.length}チャンネルのみ` : "　条件: 全チャンネル"}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <label className="flex items-center gap-1 text-xs text-gray-600 mr-1"><input type="checkbox" checked={r.enabled} onChange={(e) => setRule(r.id, { enabled: e.target.checked })} />有効</label>
                  <button onClick={() => setEditing(open ? null : r.id)} className="px-2 py-1 rounded border border-gray-300 text-xs hover:bg-gray-50">{open ? "閉じる" : "編集"}</button>
                  <button onClick={() => testRule(r)} disabled={busy === `test:${r.id}`} className="px-2 py-1 rounded border border-blue-300 text-blue-700 text-xs hover:bg-blue-50 disabled:opacity-50">{busy === `test:${r.id}` ? "送信中…" : "テスト送信"}</button>
                  <button onClick={() => dupRule(r)} className="px-2 py-1 rounded border border-gray-300 text-xs hover:bg-gray-50">複製</button>
                  <button onClick={() => removeRule(r.id)} className="px-2 py-1 rounded text-xs text-gray-400 hover:text-red-600">削除</button>
                </div>
              </div>
              {open && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 text-sm">
                  <p className="text-xs text-gray-500">発火: {ev.when}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-gray-600 w-16">ルーム</span>
                    {rooms.length > 0 ? (
                      <select value={r.roomId} onChange={(e) => setRule(r.id, { roomId: e.target.value, roomName: rooms.find((x) => x.roomId === e.target.value)?.name })} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white max-w-md">
                        <option value="">（選んでください）</option>
                        {rooms.map((x) => <option key={x.roomId} value={x.roomId}>{x.name}（{x.roomId}）</option>)}
                      </select>
                    ) : (
                      <input value={r.roomId} onChange={(e) => setRule(r.id, { roomId: e.target.value.trim() })} placeholder="ルームID" className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-mono w-48" />
                    )}
                    {rooms.length === 0 && <button onClick={loadRooms} className="text-xs text-accent hover:underline">ルーム一覧から選ぶ</button>}
                  </div>
                  <div className="flex items-start gap-2"><span className="text-gray-600 w-16 shrink-0 pt-1">To</span><div className="flex-1"><RecipientPicker value={r.to} onChange={(v) => setRule(r.id, { to: v })} roomId={r.roomId} /></div></div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 w-16 shrink-0 pt-1">タスク</span>
                    <div className="flex-1 space-y-2">
                      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!r.task?.enabled} onChange={(e) => setRule(r.id, { task: { enabled: e.target.checked, assignees: r.task?.assignees || [], dueDays: r.task?.dueDays ?? 1, body: r.task?.body } })} />Chatworkのタスクも作る</label>
                      {r.task?.enabled && (
                        <>
                          <RecipientPicker value={r.task.assignees} onChange={(v) => setRule(r.id, { task: { ...r.task!, assignees: v } })} roomId={r.roomId} />
                          <div className="flex items-center gap-2 text-xs"><span>期限</span>
                            <select value={r.task.dueDays} onChange={(e) => setRule(r.id, { task: { ...r.task!, dueDays: Number(e.target.value) as 0 | 1 | 3 | 7 } })} className="px-2 py-1 rounded border border-gray-200 bg-white">
                              <option value={0}>当日</option><option value={1}>翌日</option><option value={3}>3日後</option><option value={7}>7日後</option>
                            </select>
                          </div>
                          <input value={r.task.body || ""} onChange={(e) => setRule(r.id, { task: { ...r.task!, body: e.target.value } })} placeholder="タスクの本文（空なら通知の件名）" className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 w-16 shrink-0 pt-1">本文</span>
                    <div className="flex-1 space-y-1">
                      <input value={r.template.title} onChange={(e) => setRule(r.id, { template: { ...r.template, title: e.target.value } })} placeholder="件名" className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
                      <textarea value={r.template.body} onChange={(e) => setRule(r.id, { template: { ...r.template, body: e.target.value } })} rows={5} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm leading-6" />
                      <p className="text-[11px] text-gray-400">差し込み: {PLACEHOLDERS.join(" ")}（値が無い行は自動で省かれます）</p>
                      <details className="text-xs"><summary className="cursor-pointer text-gray-500">プレビュー（サンプル値）</summary>
                        <pre className="mt-1 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded p-2 text-[11px]">{`[${renderTemplate(r.template.title, SAMPLE_CTX)}]\n${renderTemplate(r.template.body, SAMPLE_CTX)}`}</pre>
                      </details>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-600 w-16 shrink-0 pt-1">条件</span>
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      <button onClick={() => setRule(r.id, { channelIds: [] })} className={`px-2 py-1 rounded-full text-xs border ${!r.channelIds?.length ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-300 text-gray-600"}`}>全チャンネル</button>
                      {channels.filter((c) => c.channelId).map((c) => {
                        const on = (r.channelIds || []).includes(c.channelId!);
                        return <button key={c.channelId} onClick={() => setRule(r.id, { channelIds: on ? (r.channelIds || []).filter((x) => x !== c.channelId) : [...(r.channelIds || []), c.channelId!] })} className={`px-2 py-1 rounded-full text-xs border ${on ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-300 text-gray-600"}`}>{c.name || c.handle || c.channelId}</button>;
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2"><span className="text-gray-600 w-16">メモ</span><input value={r.memo || ""} onChange={(e) => setRule(r.id, { memo: e.target.value })} placeholder="（任意）このルールの用途" className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm" /></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy === "save" || !dirty} className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">{busy === "save" ? "保存中…" : dirty ? "通知ルールを保存" : "保存済み"}</button>
        {msg && <span className={`text-xs ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</span>}
      </div>

      {/* 履歴 */}
      <div>
        <button onClick={() => setShowLog(!showLog)} className="text-xs text-gray-500 hover:text-gray-700">{showLog ? "▲" : "▼"} 通知履歴（直近{log.length}件）</button>
        {showLog && (
          <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto text-xs">
            {log.length === 0 && <p className="px-3 py-2 text-gray-400">まだ送信履歴がありません</p>}
            {log.map((l, i) => (
              <div key={i} className="px-3 py-2 flex items-start gap-2">
                <span className={l.ok ? "text-green-600" : "text-red-500"}>{l.ok ? "✓" : "✗"}</span>
                <span className="text-gray-400 shrink-0">{new Date(l.at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="flex-1 min-w-0">{eventDef(l.event).emoji} {eventDef(l.event).label} → {l.roomName || l.roomId}（To: {l.to.length}人）{l.title ? `「${l.title}」` : ""}{l.error ? <span className="text-red-500"> {l.error}</span> : null}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
