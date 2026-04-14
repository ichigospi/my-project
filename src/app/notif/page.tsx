"use client";

import { useState, useEffect, useRef } from "react";

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

interface Settings {
  bgColor: string;
  bgImage: string; // data URL
  useImage: boolean;
  notifications: NotifItem[];
}

const STORAGE_KEY = "notif-kun-settings-v1";

const DEFAULT_SETTINGS: Settings = {
  bgColor: "#6b3a4a",
  bgImage: "",
  useImage: false,
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

// ===== 通知カード（プレビュー） =====
function NotifCard({
  notif,
  onClick,
}: {
  notif: NotifItem;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white/20 backdrop-blur-xl rounded-2xl px-3 py-3 flex gap-3 cursor-pointer active:bg-white/30 transition-colors"
    >
      {/* アイコン */}
      <div className="shrink-0">
        {notif.iconUrl ? (
          <div
            className="w-10 h-10 rounded-lg bg-cover bg-center"
            style={{ backgroundImage: `url(${notif.iconUrl})` }}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-base"
            style={{ backgroundColor: notif.iconBg }}
          >
            {notif.iconLetter}
          </div>
        )}
      </div>

      {/* 本文 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-white text-[13px] font-semibold truncate">
            {notif.sender}
          </p>
          <p className="text-white/70 text-[11px] shrink-0 tabular-nums">
            {notif.time}
          </p>
        </div>
        <p className="text-white text-[13px] leading-snug mt-0.5 line-clamp-4 whitespace-pre-wrap">
          {notif.content}
        </p>
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
  const [bgColor, setBgColor] = useState(settings.bgColor);
  const [bgImage, setBgImage] = useState(settings.bgImage);
  const [useImage, setUseImage] = useState(settings.useImage);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setBgImage(dataUrl);
    setUseImage(true);
  };

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

        {/* モード切替 */}
        <div className="flex gap-2">
          <button
            onClick={() => setUseImage(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              !useImage ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            単色
          </button>
          <button
            onClick={() => setUseImage(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              useImage ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            画像
          </button>
        </div>

        {!useImage ? (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">背景色</label>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-full h-14 rounded-xl border border-gray-200 cursor-pointer"
            />
            <div className="grid grid-cols-6 gap-2 mt-3">
              {["#6b3a4a", "#1a1a2e", "#2d3748", "#3b3f5c", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#000000", "#f5f5f5"].map((c) => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className="aspect-square rounded-lg border-2"
                  style={{ backgroundColor: c, borderColor: bgColor === c ? "#2563eb" : "transparent" }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">背景画像</label>
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
                onClick={() => { setBgImage(""); setUseImage(false); }}
                className="w-full mt-2 py-3 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 active:bg-gray-200"
              >
                画像を削除
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
          </div>
        )}

        <button
          onClick={() => { onSave({ bgColor, bgImage, useImage }); onClose(); }}
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
  const [loaded, setLoaded] = useState(false);

  // 初回読み込み
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettings(JSON.parse(raw));
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

  const bgStyle: React.CSSProperties = settings.useImage && settings.bgImage
    ? { backgroundImage: `url(${settings.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: settings.bgColor };

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
      {settings.useImage && settings.bgImage && (
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      )}

      <div className="relative max-w-md mx-auto px-3 pt-12 pb-32 min-h-screen flex flex-col">
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

        {/* 通知一覧 */}
        <div className="space-y-1.5 flex-1">
          {settings.notifications.map((n) => (
            <NotifCard
              key={n.id}
              notif={n}
              onClick={() => { setEditingNotif(n); setShowEditModal(true); }}
            />
          ))}

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
        className="fixed bottom-6 right-4 md:right-6 w-14 h-14 bg-blue-600 active:bg-blue-700 text-white rounded-full shadow-lg shadow-black/30 flex items-center justify-center z-30"
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
    </div>
  );
}
