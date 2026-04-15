"use client";

import { useState, useEffect, useRef } from "react";
import AppTabBar from "@/components/AppTabBar";

// ===== 型定義 =====
interface NotifItem {
  id: string;
  iconUrl: string; // data URL or empty
  iconBg: string;  // fallback color
  iconLetter: string; // fallback letter
  sender: string;
  time: string;
  content: string;
}

type BgMode = "solid" | "gradient" | "image";
type GradientDir = "to bottom" | "to top" | "to right" | "to left" | "to bottom right" | "to bottom left" | "to top right" | "to top left" | "radial";

interface Settings {
  bgMode: BgMode;
  bgColor: string;      // 単色 or グラデーション1色目
  bgColor2: string;     // グラデーション2色目
  bgDirection: GradientDir;
  bgImage: string;      // data URL
  // 旧バージョン互換
  useImage?: boolean;
  notifications: NotifItem[];
}

const STORAGE_KEY = "notif-kun-settings-v1";

const DEFAULT_SETTINGS: Settings = {
  bgMode: "solid",
  bgColor: "#6b3a4a",
  bgColor2: "#3a1f2a",
  bgDirection: "to bottom",
  bgImage: "",
  notifications: [
    {
      id: "n1",
      iconUrl: "",
      iconBg: "#d4a5a5",
      iconLetter: "は",
      sender: "はる｜神聖ヒーリング占い師",
      time: "19:04",
      content: "こんばんは、はるです🌸 今日は「一粒万倍日×神吉日」小さなきっかけが大きく育ちやすく、願いや祈りも届きやすいとされる日です。",
    },
    {
      id: "n2",
      iconUrl: "",
      iconBg: "#b5937a",
      iconLetter: "み",
      sender: "みこと｜霊視占い師",
      time: "19:00",
      content: "こんばんは、みことです💫 今日は「一粒万倍日×神吉日」小さなきっかけが大きく育ちやすく、願いや祈りも届きやすいとされる日です。",
    },
  ],
};

function newId() {
  return "n" + Math.random().toString(36).slice(2, 9);
}

// ===== ファイル → data URL 変換 =====
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== アイコン =====
function IconView({ notif, badge }: { notif: NotifItem; badge?: number }) {
  return (
    <div className="relative shrink-0">
      {notif.iconUrl ? (
        <div
          className="w-[38px] h-[38px] rounded-lg bg-cover bg-center"
          style={{ backgroundImage: `url(${notif.iconUrl})` }}
        />
      ) : (
        <div
          className="w-[38px] h-[38px] rounded-lg flex items-center justify-center text-white font-bold text-base"
          style={{ backgroundColor: notif.iconBg }}
        >
          {notif.iconLetter}
        </div>
      )}
      {badge && badge > 1 && (
        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] flex items-center justify-center">
          <span className="text-gray-900 text-[10px] font-bold leading-none tabular-nums">{badge}</span>
        </div>
      )}
    </div>
  );
}

// ===== 通知カード共通スタイル =====
// 外枠（グラデーション光沢のみ）
// 円錐グラデーション: 右上と左下の角だけ完全に暗く、その他の辺・角はすべて均一に光る
// 暗ゾーンを狭く(±7°)して、辺は全部しっかり明るく
// from 135deg を起点に時計回り: 0°=右下, 90°=左下, 180°=左上, 270°=右上
const BORDER_GRADIENT =
  "conic-gradient(from 135deg at 50% 50%, rgba(255,255,255,0.75) 0deg, rgba(255,255,255,0.55) 45deg, rgba(255,255,255,0.5) 80deg, rgba(255,255,255,0.15) 87deg, rgba(255,255,255,0) 90deg, rgba(255,255,255,0.15) 93deg, rgba(255,255,255,0.5) 100deg, rgba(255,255,255,0.55) 135deg, rgba(255,255,255,0.75) 180deg, rgba(255,255,255,0.55) 225deg, rgba(255,255,255,0.5) 260deg, rgba(255,255,255,0.15) 267deg, rgba(255,255,255,0) 270deg, rgba(255,255,255,0.15) 273deg, rgba(255,255,255,0.5) 280deg, rgba(255,255,255,0.55) 315deg, rgba(255,255,255,0.75) 360deg)";

const BORDER_GRADIENT_BEHIND =
  "conic-gradient(from 135deg at 50% 50%, rgba(255,255,255,0.45) 0deg, rgba(255,255,255,0.32) 45deg, rgba(255,255,255,0.3) 80deg, rgba(255,255,255,0.08) 87deg, rgba(255,255,255,0) 90deg, rgba(255,255,255,0.08) 93deg, rgba(255,255,255,0.3) 100deg, rgba(255,255,255,0.32) 135deg, rgba(255,255,255,0.45) 180deg, rgba(255,255,255,0.32) 225deg, rgba(255,255,255,0.3) 260deg, rgba(255,255,255,0.08) 267deg, rgba(255,255,255,0) 270deg, rgba(255,255,255,0.08) 273deg, rgba(255,255,255,0.3) 280deg, rgba(255,255,255,0.32) 315deg, rgba(255,255,255,0.45) 360deg)";

// CSSマスクで枠だけ表示（リング状に切り抜く）
const BORDER_MASK = {
  WebkitMask:
    "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
} as React.CSSProperties;

// カード本体: 均一な半透明
const CARD_BODY: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.15)",
  WebkitBackdropFilter: "blur(40px) saturate(180%)",
  backdropFilter: "blur(40px) saturate(180%)",
};

const CARD_BODY_BEHIND: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.10)",
  WebkitBackdropFilter: "blur(30px) saturate(160%)",
  backdropFilter: "blur(30px) saturate(160%)",
};

// ===== 通知カード（プレビュー） =====
function NotifCard({
  notif,
  onClick,
  badge,
}: {
  notif: NotifItem;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <div
      onClick={onClick}
      className="relative rounded-[26px] cursor-pointer active:brightness-110 transition-all"
      style={{
        ...CARD_BODY,
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
      }}
    >
      {/* 枠グラデーション（マスクでリング状に切り抜き） */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[26px] pointer-events-none"
        style={{
          padding: "0.75px",
          background: BORDER_GRADIENT,
          ...BORDER_MASK,
        }}
      />

      {/* コンテンツ */}
      <div className="relative px-3.5 py-2 flex gap-3.5 items-center">
        <IconView notif={notif} badge={badge} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-white text-[15px] font-semibold truncate drop-shadow-sm">
              {notif.sender}
            </p>
            <p className="text-white/75 text-[12px] shrink-0 tabular-nums">
              {notif.time}
            </p>
          </div>
          <p className="text-white text-[15px] leading-[1.15] mt-0.5 line-clamp-4 whitespace-pre-wrap">
            {notif.content}
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== 束ねられたカード（複数通知） =====
function StackedCard({
  notif,
  count,
  onClick,
}: {
  notif: NotifItem;
  count: number;
  onClick: () => void;
}) {
  const renderBehindCard = (className: string) => (
    <div
      className={`${className} rounded-[26px]`}
      style={{
        ...CARD_BODY_BEHIND,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 rounded-[26px] pointer-events-none"
        style={{
          padding: "0.75px",
          background: BORDER_GRADIENT_BEHIND,
          ...BORDER_MASK,
        }}
      />
    </div>
  );

  return (
    <div className="relative" onClick={onClick}>
      {/* 後ろのカード（束ね表現） */}
      {count >= 3 &&
        renderBehindCard("absolute left-4 right-4 top-2 bottom-[-9px]")}
      {count >= 2 &&
        renderBehindCard("absolute left-2 right-2 top-1 bottom-[-4px]")}

      {/* 最前面のカード */}
      <div
        className="relative rounded-[26px] cursor-pointer active:brightness-110 transition-all"
        style={{
          ...CARD_BODY,
          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
        }}
      >
        {/* 枠グラデーション */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-[26px] pointer-events-none"
          style={{
            padding: "0.75px",
            background: BORDER_GRADIENT,
            ...BORDER_MASK,
          }}
        />

        {/* コンテンツ */}
        <div className="relative px-3.5 py-2 flex gap-3.5 items-center">
          <IconView notif={notif} badge={count} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-white text-[15px] font-semibold truncate drop-shadow-sm">
                {notif.sender}
              </p>
              <p className="text-white/75 text-[12px] shrink-0 tabular-nums">
                {notif.time}
              </p>
            </div>
            <p className="text-white text-[15px] leading-[1.15] mt-0.5 line-clamp-4 whitespace-pre-wrap">
              {notif.content}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== グループ展開時のヘッダー =====
function GroupHeader({
  title,
  onCollapse,
}: {
  title: string;
  onCollapse: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-1 py-1">
      <p className="text-white text-2xl font-bold">{title}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={onCollapse}
          className="flex items-center gap-1 px-3 h-8 rounded-full bg-black/40 backdrop-blur-md text-white text-[12px] font-medium active:bg-black/60"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M19 9l-7 7-7-7" />
          </svg>
          表示を減らす
        </button>
        <button
          onClick={onCollapse}
          className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center active:bg-black/60"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ===== 編集モーダル =====
function EditModal({
  notif,
  onClose,
  onSave,
  onDelete,
}: {
  notif: NotifItem | null;
  onClose: () => void;
  onSave: (n: NotifItem) => void;
  onDelete: (id: string) => void;
}) {
  const isNew = !notif;
  const [sender, setSender] = useState(notif?.sender || "");
  const [time, setTime] = useState(notif?.time || "19:00");
  const [content, setContent] = useState(notif?.content || "");
  const [iconUrl, setIconUrl] = useState(notif?.iconUrl || "");
  const [iconBg, setIconBg] = useState(notif?.iconBg || "#d4a5a5");
  const [iconLetter, setIconLetter] = useState(notif?.iconLetter || "A");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setIconUrl(dataUrl);
  };

  const handleSubmit = () => {
    if (!sender || !content) return;
    onSave({
      id: notif?.id || newId(),
      iconUrl,
      iconBg,
      iconLetter: iconLetter || sender.slice(0, 1),
      sender,
      time,
      content,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="md:hidden flex justify-center -mt-1 mb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {isNew ? "通知を追加" : "通知を編集"}
          </h3>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">&times;</button>
        </div>

        {/* アイコン */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">アイコン</label>
          <div className="flex items-center gap-3">
            {iconUrl ? (
              <div
                className="w-14 h-14 rounded-xl bg-cover bg-center border border-gray-200"
                style={{ backgroundImage: `url(${iconUrl})` }}
              />
            ) : (
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: iconBg }}
              >
                {iconLetter}
              </div>
            )}
            <div className="flex flex-col gap-2 flex-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 active:bg-blue-100"
              >
                画像を選択
              </button>
              {iconUrl && (
                <button
                  type="button"
                  onClick={() => setIconUrl("")}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 active:bg-gray-200"
                >
                  画像を削除
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
          </div>

          {/* 画像なしの場合: 色と文字 */}
          {!iconUrl && (
            <div className="flex gap-2 mt-3">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-400 mb-1">背景色</label>
                <input
                  type="color"
                  value={iconBg}
                  onChange={(e) => setIconBg(e.target.value)}
                  className="w-full h-9 rounded-lg border border-gray-200 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-400 mb-1">1文字</label>
                <input
                  type="text"
                  maxLength={2}
                  value={iconLetter}
                  onChange={(e) => setIconLetter(e.target.value)}
                  className="w-full h-9 rounded-lg border border-gray-200 px-2 text-sm text-center"
                />
              </div>
            </div>
          )}
        </div>

        {/* 差出人 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">差出人・アプリ名</label>
          <input
            type="text"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="例: はる｜神聖ヒーリング占い師"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base md:text-sm"
          />
        </div>

        {/* 時間 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">時間</label>
          <input
            type="text"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="例: 19:04 / 金 17:53"
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base md:text-sm"
          />
        </div>

        {/* 文章 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">文章</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="通知の本文"
            rows={4}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base md:text-sm resize-none"
          />
        </div>

        {/* 保存ボタン */}
        <button
          onClick={handleSubmit}
          disabled={!sender || !content}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-blue-600 active:bg-blue-700 disabled:bg-gray-300"
        >
          {isNew ? "追加する" : "更新する"}
        </button>

        {/* 編集時のみ削除 */}
        {!isNew && notif && (
          <button
            onClick={() => {
              if (confirm("この通知を削除しますか？")) onDelete(notif.id);
            }}
            className="w-full py-3 rounded-xl text-sm font-medium text-rose-500 active:bg-rose-50"
          >
            この通知を削除
          </button>
        )}

        <div className="md:hidden h-4" />
      </div>
    </div>
  );
}

// ===== 背景スタイル計算 =====
function getBgStyle(s: { bgMode: BgMode; bgColor: string; bgColor2: string; bgDirection: GradientDir; bgImage: string }): React.CSSProperties {
  if (s.bgMode === "image" && s.bgImage) {
    return { backgroundImage: `url(${s.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  if (s.bgMode === "gradient") {
    if (s.bgDirection === "radial") {
      return { background: `radial-gradient(circle at center, ${s.bgColor}, ${s.bgColor2})` };
    }
    return { background: `linear-gradient(${s.bgDirection}, ${s.bgColor}, ${s.bgColor2})` };
  }
  return { backgroundColor: s.bgColor };
}

const DIRECTION_OPTIONS: { label: string; value: GradientDir; icon: string }[] = [
  { label: "上→下", value: "to bottom", icon: "↓" },
  { label: "下→上", value: "to top", icon: "↑" },
  { label: "左→右", value: "to right", icon: "→" },
  { label: "右→左", value: "to left", icon: "←" },
  { label: "左上→右下", value: "to bottom right", icon: "↘" },
  { label: "右上→左下", value: "to bottom left", icon: "↙" },
  { label: "左下→右上", value: "to top right", icon: "↗" },
  { label: "右下→左上", value: "to top left", icon: "↖" },
  { label: "放射", value: "radial", icon: "◎" },
];

const PRESET_COLORS = [
  "#6b3a4a", "#3a1f2a", "#1a1a2e", "#2d3748", "#3b3f5c", "#8b5cf6",
  "#ec4899", "#f472b6", "#10b981", "#0ea5a5", "#f59e0b", "#ef4444",
  "#06b6d4", "#3b82f6", "#000000", "#ffffff", "#f5f5f5", "#d4a5a5",
];

// ===== HEX入力付きカラーピッカー =====
function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [hex, setHex] = useState(value);
  useEffect(() => { setHex(value); }, [value]);

  const handleHex = (v: string) => {
    setHex(v);
    // 有効なHEX形式ならonChange
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      onChange(v);
    }
  };

  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>}
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={value}
          onChange={(e) => { onChange(e.target.value); setHex(e.target.value); }}
          className="w-14 h-11 rounded-lg border border-gray-200 cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={hex}
          onChange={(e) => handleHex(e.target.value)}
          placeholder="#ffffff"
          className="flex-1 h-11 rounded-lg border border-gray-200 px-3 text-sm font-mono uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ===== 背景設定モーダル =====
function BgModal({
  settings,
  onClose,
  onSave,
}: {
  settings: Settings;
  onClose: () => void;
  onSave: (s: Partial<Settings>) => void;
}) {
  const [bgMode, setBgMode] = useState<BgMode>(settings.bgMode);
  const [bgColor, setBgColor] = useState(settings.bgColor);
  const [bgColor2, setBgColor2] = useState(settings.bgColor2);
  const [bgDirection, setBgDirection] = useState<GradientDir>(settings.bgDirection);
  const [bgImage, setBgImage] = useState(settings.bgImage);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setBgImage(dataUrl);
    setBgMode("image");
  };

  const previewStyle = getBgStyle({ bgMode, bgColor, bgColor2, bgDirection, bgImage });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="md:hidden flex justify-center -mt-1 mb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">背景設定</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">&times;</button>
        </div>

        {/* プレビュー */}
        <div className="w-full h-20 rounded-xl border border-gray-200" style={previewStyle} />

        {/* モード切替 */}
        <div className="flex gap-2">
          {([
            { mode: "solid" as BgMode, label: "単色" },
            { mode: "gradient" as BgMode, label: "グラデーション" },
            { mode: "image" as BgMode, label: "画像" },
          ]).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setBgMode(mode)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                bgMode === mode ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* モード別設定 */}
        {bgMode === "solid" && (
          <div className="space-y-3">
            <ColorPicker value={bgColor} onChange={setBgColor} label="背景色" />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">プリセット</label>
              <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBgColor(c)}
                    className="aspect-square rounded-lg border-2"
                    style={{ backgroundColor: c, borderColor: bgColor.toLowerCase() === c.toLowerCase() ? "#2563eb" : "transparent" }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {bgMode === "gradient" && (
          <div className="space-y-3">
            <ColorPicker value={bgColor} onChange={setBgColor} label="色1（開始色）" />
            <ColorPicker value={bgColor2} onChange={setBgColor2} label="色2（終了色）" />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">方向</label>
              <div className="grid grid-cols-3 gap-2">
                {DIRECTION_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setBgDirection(d.value)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      bgDirection === d.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <span className="text-base">{d.icon}</span>
                    <span className="text-[10px]">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {bgMode === "image" && (
          <div>
            {bgImage && (
              <div
                className="w-full h-40 rounded-xl bg-cover bg-center mb-3 border border-gray-200"
                style={{ backgroundImage: `url(${bgImage})` }}
              />
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-3 rounded-xl text-sm font-medium bg-blue-50 text-blue-600 active:bg-blue-100"
            >
              画像を選択
            </button>
            {bgImage && (
              <button
                onClick={() => setBgImage("")}
                className="w-full mt-2 py-3 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 active:bg-gray-200"
              >
                画像を削除
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
          </div>
        )}

        <button
          onClick={() => { onSave({ bgMode, bgColor, bgColor2, bgDirection, bgImage }); onClose(); }}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-blue-600 active:bg-blue-700"
        >
          保存
        </button>

        <div className="md:hidden h-4" />
      </div>
    </div>
  );
}

// ===== メインページ =====
export default function NotifPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [editingNotif, setEditingNotif] = useState<NotifItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBgModal, setShowBgModal] = useState(false);
  const [expandedSender, setExpandedSender] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 初回読み込み（旧フォーマットも互換対応）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // 旧フォーマット(useImage)→新フォーマット(bgMode)へ変換
        const bgMode: BgMode =
          parsed.bgMode ?? (parsed.useImage ? "image" : "solid");
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          bgMode,
        });
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  // 保存
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota errors
    }
  }, [settings, loaded]);

  const handleSaveNotif = (n: NotifItem) => {
    setSettings((prev) => {
      const existing = prev.notifications.find((x) => x.id === n.id);
      if (existing) {
        return {
          ...prev,
          notifications: prev.notifications.map((x) => (x.id === n.id ? n : x)),
        };
      }
      return { ...prev, notifications: [...prev.notifications, n] };
    });
    setShowEditModal(false);
    setEditingNotif(null);
  };

  const handleDeleteNotif = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      notifications: prev.notifications.filter((n) => n.id !== id),
    }));
    setShowEditModal(false);
    setEditingNotif(null);
  };

  const bgStyle = getBgStyle(settings);

  // 現在時刻を表示（ロック画面風）
  const [clock, setClock] = useState("");
  useEffect(() => {
    const update = () => {
      const d = new Date();
      setClock(`${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`);
    };
    update();
    const t = setInterval(update, 1000 * 30);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen relative" style={bgStyle}>
      {/* うっすら暗くするオーバーレイ（画像使用時） */}
      {settings.bgMode === "image" && settings.bgImage && (
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      )}

      <div className="relative max-w-md mx-auto px-3 pt-12 pb-44 min-h-screen flex flex-col">
        {/* ステータスバー風 */}
        <div className="flex items-center justify-between text-white px-3 mb-2">
          <p className="text-base font-semibold tabular-nums">{clock}</p>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M1 11h2v2H1zm4-2h2v6H5zm4-2h2v10H9zm4-2h2v14h-2zm4-2h2v18h-2z" />
            </svg>
            <span className="text-xs font-semibold">5G</span>
            <div className="w-6 h-3 rounded-sm border border-white/80 relative">
              <div className="absolute inset-0.5 rounded-sm bg-white/80" style={{ width: "70%" }} />
            </div>
          </div>
        </div>

        {/* 通知一覧（差出人ごとにグループ化） */}
        <div className="space-y-2 flex-1">
          {(() => {
            // 差出人ごとにグループ化（元の並び順を保持）
            const groups: { sender: string; items: NotifItem[] }[] = [];
            const senderIdx = new Map<string, number>();
            for (const n of settings.notifications) {
              const i = senderIdx.get(n.sender);
              if (i === undefined) {
                senderIdx.set(n.sender, groups.length);
                groups.push({ sender: n.sender, items: [n] });
              } else {
                groups[i].items.push(n);
              }
            }

            return groups.map((g) => {
              const isGrouped = g.items.length >= 2;
              const isExpanded = expandedSender === g.sender;

              // 展開中のグループ
              if (isGrouped && isExpanded) {
                // グループ名: 区切り文字で差出人の前半部分を使用
                const title = g.sender.split(/[｜|]/)[0].trim();
                return (
                  <div key={g.sender} className="space-y-1.5 pt-2">
                    <GroupHeader
                      title={title}
                      onCollapse={() => setExpandedSender(null)}
                    />
                    {g.items.map((n) => (
                      <NotifCard
                        key={n.id}
                        notif={n}
                        onClick={() => { setEditingNotif(n); setShowEditModal(true); }}
                      />
                    ))}
                  </div>
                );
              }

              // 束ね表示（2件以上）
              if (isGrouped) {
                // 最新の通知を先頭として表示（配列上の最後の要素を最新とみなす）
                const newest = g.items[g.items.length - 1];
                return (
                  <StackedCard
                    key={g.sender}
                    notif={newest}
                    count={g.items.length}
                    onClick={() => setExpandedSender(g.sender)}
                  />
                );
              }

              // 単体
              const n = g.items[0];
              return (
                <NotifCard
                  key={n.id}
                  notif={n}
                  onClick={() => { setEditingNotif(n); setShowEditModal(true); }}
                />
              );
            });
          })()}

          {settings.notifications.length === 0 && (
            <div className="text-center text-white/70 py-16 text-sm">
              右下の「+」で通知を追加
            </div>
          )}
        </div>

        {/* 下部ボタン（ロック画面風） */}
        <div className="flex items-center justify-between mt-6 px-4">
          <button className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2s2-.9 2-2V4c0-1.1-.9-2-2-2zm0 20c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2s2 .9 2 2v4c0 1.1-.9 2-2 2z"/>
            </svg>
          </button>
          <button className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>
      </div>

      {/* 操作ボタン群（固定） */}
      <div className="fixed top-4 right-4 flex flex-col gap-2 z-30">
        <button
          onClick={() => setShowBgModal(true)}
          className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center active:bg-black/70"
          title="背景設定"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>

      <button
        onClick={() => { setEditingNotif(null); setShowEditModal(true); }}
        className="fixed bottom-20 right-4 md:right-6 w-14 h-14 bg-blue-600 active:bg-blue-700 text-white rounded-full shadow-lg shadow-black/30 flex items-center justify-center z-30"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* モーダル群 */}
      {showEditModal && (
        <EditModal
          notif={editingNotif}
          onClose={() => { setShowEditModal(false); setEditingNotif(null); }}
          onSave={handleSaveNotif}
          onDelete={handleDeleteNotif}
        />
      )}

      {showBgModal && (
        <BgModal
          settings={settings}
          onClose={() => setShowBgModal(false)}
          onSave={(s) => setSettings((prev) => ({ ...prev, ...s }))}
        />
      )}

      {/* ===== ボトムタブバー ===== */}
      <AppTabBar variant="dark" />
    </div>
  );
}
