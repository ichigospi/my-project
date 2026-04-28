// 自アカ情報フォーム（ジャンルごとに1レコード）
// 過去のストーリー構造化フィールド含む
"use client";

import { useEffect, useState, useCallback } from "react";
import { useXPostGenre } from "@/lib/x-post-genre";
import {
  emptyAccountInfo,
  parseAccountInfo,
  serializeAccountInfo,
  type StoryEpisode,
  type XAccountInfoForm,
} from "@/lib/x-post-types";
import ArrayInput from "./ArrayInput";

export default function AccountInfoTab() {
  const [genre] = useXPostGenre();
  const [form, setForm] = useState<XAccountInfoForm>(() => emptyAccountInfo(genre));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // ジャンル変更時にロード
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/x-post/account-info?genre=${genre}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setForm(parseAccountInfo(data, genre));
        setSavedAt(null);
      })
      .catch(() => {
        if (cancelled) return;
        setForm(emptyAccountInfo(genre));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [genre]);

  const updateField = useCallback(<K extends keyof XAccountInfoForm>(key: K, value: XAccountInfoForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/x-post/account-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeAccountInfo(form)),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(`保存失敗: ${e.error || res.statusText}`);
        return;
      }
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 上部: 保存ボタン */}
      <div className="sticky top-0 bg-gray-50 z-10 flex items-center justify-between py-2 -my-2">
        <p className="text-xs text-gray-500">
          {savedAt ? `保存済み（${savedAt.toLocaleTimeString()}）` : "未保存の変更があります"}
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-md transition-colors"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      {/* アカウント基本 */}
      <Section title="📌 アカウント基本">
        <Field label="アカウント名">
          <TextInput value={form.accountName} onChange={(v) => updateField("accountName", v)} />
        </Field>
        <Field label="ハンドル (@)">
          <TextInput value={form.handle} onChange={(v) => updateField("handle", v)} placeholder="@xxx" />
        </Field>
        <Field label="コンセプト">
          <TextArea value={form.concept} onChange={(v) => updateField("concept", v)} rows={2} />
        </Field>
        <Field label="ターゲット（誰の何を解決するか）">
          <TextArea value={form.target} onChange={(v) => updateField("target", v)} rows={2} />
        </Field>
        <Field label="フォロワー像">
          <TextArea value={form.followerImage} onChange={(v) => updateField("followerImage", v)} rows={2} />
        </Field>
      </Section>

      {/* ポジショニング */}
      <Section title="🎯 ポジショニング">
        <Field label="USP（差別化ポイント）">
          <TextArea value={form.usp} onChange={(v) => updateField("usp", v)} rows={2} />
        </Field>
        <Field label="押し出すキャラクター">
          <TextArea value={form.character} onChange={(v) => updateField("character", v)} rows={2} />
        </Field>
        {genre === "spiritual" && (
          <Field label="鑑定スタイル / 流派">
            <TextInput value={form.divinationStyle} onChange={(v) => updateField("divinationStyle", v)} />
          </Field>
        )}
      </Section>

      {/* 口調・トーン */}
      <Section title="💬 口調・トーン">
        <div className="grid grid-cols-2 gap-4">
          <Field label="一人称">
            <TextInput value={form.pronoun} onChange={(v) => updateField("pronoun", v)} placeholder="俺/私/ぼく 等" />
          </Field>
          <Field label="文末">
            <TextInput value={form.sentenceEnd} onChange={(v) => updateField("sentenceEnd", v)} placeholder="〜だね/〜です 等" />
          </Field>
          <Field label="温度感">
            <TextInput value={form.temperature} onChange={(v) => updateField("temperature", v)} placeholder="熱い/落ち着き/フランク" />
          </Field>
          <Field label="絵文字使用">
            <TextInput value={form.emojiUsage} onChange={(v) => updateField("emojiUsage", v)} placeholder="多め/少なめ/なし" />
          </Field>
        </div>
        <Field label="改行ルール">
          <TextInput value={form.lineBreakRule} onChange={(v) => updateField("lineBreakRule", v)} placeholder="例: 1〜2行で改行" />
        </Field>
      </Section>

      {/* キーワード */}
      <Section title="🔑 キーワード">
        <Field label="メインKW">
          <ArrayInput
            values={form.mainKeywords}
            onChange={(v) => updateField("mainKeywords", v)}
            placeholder="メインKWを入力してEnter"
          />
        </Field>
        <Field label="サブKW">
          <ArrayInput
            values={form.subKeywords}
            onChange={(v) => updateField("subKeywords", v)}
            placeholder="サブKWを入力してEnter"
          />
        </Field>
        <Field label="避けたい表現・行為">
          <TextArea value={form.ngExpressions} onChange={(v) => updateField("ngExpressions", v)} rows={3} />
        </Field>
      </Section>

      {/* 商品 */}
      <Section title="🛒 商品・LP">
        <Field label="主力商品">
          <TextInput value={form.mainProduct} onChange={(v) => updateField("mainProduct", v)} />
        </Field>
        <Field label="LP / LINE 導線">
          <TextInput value={form.lpUrl} onChange={(v) => updateField("lpUrl", v)} placeholder="https://... または LINE 導線の説明" />
        </Field>
      </Section>

      {/* 過去のストーリー */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="text-base font-bold text-amber-900 mb-1">📖 過去のストーリー（信用の教育用）</h3>
        <p className="text-xs text-amber-800">
          「こんなポンコツでもうまくいった」を信用の教育で発信するための構造化情報。AIがこの情報を使って、出発点・転機・苦労・現在地を組み合わせたストーリー型ポストを生成します。
        </p>
      </div>

      <Section title="📍 出発点（Before状態）">
        <Field label="状況">
          <TextArea
            value={form.storyBeforeState.situation}
            onChange={(v) => updateField("storyBeforeState", { ...form.storyBeforeState, situation: v })}
            rows={2}
            placeholder="例: 工場勤務14年、SNS未経験..."
          />
        </Field>
        <Field label="数字（年齢/年収/貯金など）">
          <TextArea
            value={form.storyBeforeState.numbers}
            onChange={(v) => updateField("storyBeforeState", { ...form.storyBeforeState, numbers: v })}
            rows={2}
            placeholder="例: 年収200万 / 貯金0円 / 年齢34歳..."
          />
        </Field>
        <Field label="心境">
          <TextArea
            value={form.storyBeforeState.feeling}
            onChange={(v) => updateField("storyBeforeState", { ...form.storyBeforeState, feeling: v })}
            rows={2}
            placeholder="例: 将来不安、毎日寝れない..."
          />
        </Field>
      </Section>

      <Section title="⚡ 転機">
        <Field label="きっかけ">
          <TextArea
            value={form.storyTurningPoint.trigger}
            onChange={(v) => updateField("storyTurningPoint", { ...form.storyTurningPoint, trigger: v })}
            rows={2}
          />
        </Field>
        <Field label="出会った人 / 物">
          <TextArea
            value={form.storyTurningPoint.encounter}
            onChange={(v) => updateField("storyTurningPoint", { ...form.storyTurningPoint, encounter: v })}
            rows={2}
          />
        </Field>
        <Field label="衝撃・気付き">
          <TextArea
            value={form.storyTurningPoint.insight}
            onChange={(v) => updateField("storyTurningPoint", { ...form.storyTurningPoint, insight: v })}
            rows={2}
          />
        </Field>
      </Section>

      <Section title="💪 苦労した過程（エピソード）">
        <EpisodesEditor
          episodes={form.storyEpisodes}
          onChange={(v) => updateField("storyEpisodes", v)}
        />
      </Section>

      <Section title="🔥 ぶっ飛び体験（基準値・覚悟の教育用）">
        <ArrayInput
          values={form.storyExtremeActs}
          onChange={(v) => updateField("storyExtremeActs", v)}
          placeholder="例: 親に800万円借金して自己投資した"
        />
      </Section>

      <Section title="❌ 過去のNG行動（共感ポイント）">
        <ArrayInput
          values={form.storyNgBehaviors}
          onChange={(v) => updateField("storyNgBehaviors", v)}
          placeholder="例: ノウハウコレクターしてた"
        />
      </Section>

      <Section title="🎯 現在地（After状態）">
        <Field label="状況">
          <TextArea
            value={form.storyAfterState.situation}
            onChange={(v) => updateField("storyAfterState", { ...form.storyAfterState, situation: v })}
            rows={2}
            placeholder="例: 月収300万安定、コンサル満員..."
          />
        </Field>
        <Field label="数字">
          <TextArea
            value={form.storyAfterState.numbers}
            onChange={(v) => updateField("storyAfterState", { ...form.storyAfterState, numbers: v })}
            rows={2}
            placeholder="例: 月収:300万 / 自由時間:1日6h..."
          />
        </Field>
        <Field label="ライフスタイル">
          <TextArea
            value={form.storyAfterState.feeling}
            onChange={(v) => updateField("storyAfterState", { ...form.storyAfterState, feeling: v })}
            rows={2}
            placeholder="例: 週3日休み、平日昼旅行..."
          />
        </Field>
      </Section>

      <Section title="🤝 読者との共通点">
        <ArrayInput
          values={form.storyCommonGround}
          onChange={(v) => updateField("storyCommonGround", v)}
          placeholder="例: 元サラリーマン・低収入"
        />
      </Section>

      <Section title="💬 印象的なフレーズ・口癖（そのまま使える短文）">
        <ArrayInput
          values={form.storyPhrases}
          onChange={(v) => updateField("storyPhrases", v)}
          placeholder="例: 800万借金して自己投資して人生変わった"
        />
      </Section>

      {/* 最下部にも保存ボタン */}
      <div className="flex justify-end pt-4">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-md transition-colors"
        >
          {saving ? "保存中..." : "💾 すべて保存"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Sub components
// ============================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
    />
  );
}

function TextArea({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
    />
  );
}

function EpisodesEditor({ episodes, onChange }: { episodes: StoryEpisode[]; onChange: (v: StoryEpisode[]) => void }) {
  const update = (i: number, patch: Partial<StoryEpisode>) => {
    onChange(episodes.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  };
  const add = () => onChange([...episodes, { title: "", detail: "", learning: "" }]);
  const remove = (i: number) => onChange(episodes.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {episodes.map((ep, i) => (
        <div key={i} className="bg-gray-50 border border-gray-200 rounded-md p-3 space-y-2 relative">
          <button
            type="button"
            onClick={() => remove(i)}
            className="absolute top-2 right-2 text-xs text-gray-400 hover:text-red-500"
          >
            ✕ 削除
          </button>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">タイトル</label>
            <input
              type="text"
              value={ep.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="例: 初月の収益は700円"
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">詳細</label>
            <textarea
              value={ep.detail}
              onChange={(e) => update(i, { detail: e.target.value })}
              rows={2}
              placeholder="例: 毎日5時間ポストしたのに..."
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">学び</label>
            <input
              type="text"
              value={ep.learning}
              onChange={(e) => update(i, { learning: e.target.value })}
              placeholder="例: 興味付けが弱かった"
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition-colors"
      >
        + エピソード追加
      </button>
    </div>
  );
}
