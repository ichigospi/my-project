"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/* ── Types ── */
interface Message {
  id: string;
  direction: "incoming" | "outgoing";
  messageType: "text" | "image" | "sticker";
  content: string;
  aiSuggestions?: string[];
  sentAt: string;
}

interface Conversation {
  id: string;
  lineUserId: string;
  displayName: string;
  lastMessageAt: string;
  status: "active" | "waiting" | "resolved";
  unreadCount: number;
  messages: Message[];
}

interface LineAccount {
  autoReplyMode: "suggest" | "auto" | "off";
}

type AutoReplyMode = LineAccount["autoReplyMode"];
type ConversationStatus = Conversation["status"];

const STATUS_LABEL: Record<ConversationStatus, string> = {
  active: "対応中",
  waiting: "待機中",
  resolved: "解決済み",
};

const STATUS_COLOR: Record<ConversationStatus, string> = {
  active: "bg-success",
  waiting: "bg-warning",
  resolved: "bg-gray-400",
};

const MODE_LABEL: Record<AutoReplyMode, string> = {
  suggest: "提案モード",
  auto: "自動モード",
  off: "オフ",
};

/* ── Helpers ── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadConversations(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem("line_conversations") || "[]");
  } catch {
    return [];
  }
}

function saveConversations(c: Conversation[]) {
  localStorage.setItem("line_conversations", JSON.stringify(c));
}

function loadAccount(): LineAccount | null {
  try {
    const raw = localStorage.getItem("line_account");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAccount(a: LineAccount) {
  localStorage.setItem("line_account", JSON.stringify(a));
}

/* ── Component ── */
export default function LineRepliesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [account, setAccount] = useState<LineAccount | null>(null);
  const [connected, setConnected] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const acct = loadAccount();
    if (acct) {
      setAccount(acct);
      setConnected(true);
    }
    const convs = loadConversations();
    setConversations(convs);
    if (convs.length > 0) setSelectedId(convs[0].id);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedId, conversations]);

  const persist = (updated: Conversation[]) => {
    setConversations(updated);
    saveConversations(updated);
  };

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  /* ── Auto-reply mode ── */
  const changeMode = (mode: AutoReplyMode) => {
    const acct: LineAccount = { ...(account ?? { autoReplyMode: "suggest" }), autoReplyMode: mode };
    setAccount(acct);
    saveAccount(acct);
  };

  /* ── Conversation status ── */
  const changeStatus = (status: ConversationStatus) => {
    if (!selected) return;
    const updated = conversations.map((c) =>
      c.id === selected.id ? { ...c, status } : c
    );
    persist(updated);
  };

  /* ── Send reply ── */
  const sendReply = () => {
    if (!selected || !replyText.trim()) return;
    const msg: Message = {
      id: uid(),
      direction: "outgoing",
      messageType: "text",
      content: replyText.trim(),
      sentAt: new Date().toISOString(),
    };
    const updated = conversations.map((c) =>
      c.id === selected.id
        ? { ...c, messages: [...c.messages, msg], lastMessageAt: msg.sentAt }
        : c
    );
    persist(updated);
    setReplyText("");
    setSuggestions([]);
    setSuggestingFor(null);
  };

  /* ── AI Suggestions ── */
  const fetchSuggestions = async (messageId: string, content: string) => {
    if (!selected) return;
    setLoadingSuggestions(true);
    setSuggestingFor(messageId);
    setSuggestions([]);
    try {
      const res = await fetch("/api/line/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          conversationHistory: selected.messages.map((m) => ({
            role: m.direction === "incoming" ? "user" : "assistant",
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      const sug: string[] = data.suggestions ?? [
        `承知いたしました。「${content}」について確認いたします。`,
        `ご連絡ありがとうございます。「${content}」の件、対応させていただきます。`,
        `「${content}」について、担当者に確認の上ご連絡いたします。`,
      ];
      setSuggestions(sug.slice(0, 3));
      // persist suggestions onto the message
      const updatedConvs = conversations.map((c) =>
        c.id === selected.id
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, aiSuggestions: sug.slice(0, 3) } : m
              ),
            }
          : c
      );
      persist(updatedConvs);
    } catch {
      // fallback suggestions
      setSuggestions([
        `承知いたしました。「${content}」について確認いたします。`,
        `ご連絡ありがとうございます。「${content}」の件、対応させていただきます。`,
        `「${content}」について、担当者に確認の上ご連絡いたします。`,
      ]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  /* ── Not connected ── */
  if (!connected) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">LINE返信管理</h1>
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-8">
          <p className="text-gray-600 mb-4">
            LINEアカウントが設定されていません。設定ページでLINE連携を行ってください。
          </p>
          <Link
            href="/settings"
            className="inline-block bg-accent text-white px-6 py-2 rounded-lg hover:opacity-90 transition"
          >
            設定ページへ
          </Link>
        </div>
      </div>
    );
  }

  /* ── Main layout ── */
  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">LINE返信管理</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">自動返信:</span>
          {(["suggest", "auto", "off"] as AutoReplyMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => changeMode(mode)}
              className={`px-3 py-1 text-sm rounded-lg transition ${
                account?.autoReplyMode === mode
                  ? "bg-accent text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {MODE_LABEL[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* Two-panel */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left panel – conversation list */}
        <div className="w-1/3 bg-card-bg rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-0">
          <div className="p-3 border-b border-gray-100 font-semibold text-sm text-gray-500">
            会話一覧（{conversations.length}）
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="p-4 text-center text-gray-400 text-sm">
                会話はまだありません
              </p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedId(conv.id);
                  setSuggestions([]);
                  setSuggestingFor(null);
                  // clear unread
                  const updated = conversations.map((c) =>
                    c.id === conv.id ? { ...c, unreadCount: 0 } : c
                  );
                  persist(updated);
                }}
                className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition ${
                  selectedId === conv.id ? "bg-accent/5" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate">
                    {conv.displayName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {conv.unreadCount > 0 && (
                      <span className="bg-accent text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {conv.unreadCount}
                      </span>
                    )}
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${STATUS_COLOR[conv.status]}`}
                      title={STATUS_LABEL[conv.status]}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 truncate">
                  {conv.messages.length > 0
                    ? conv.messages[conv.messages.length - 1].content
                    : "メッセージなし"}
                </p>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  {conv.lastMessageAt
                    ? new Date(conv.lastMessageAt).toLocaleString("ja-JP")
                    : ""}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel – messages */}
        <div className="w-2/3 bg-card-bg rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              会話を選択してください
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selected.displayName}</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${STATUS_COLOR[selected.status]}`}
                  />
                  <span className="text-xs text-gray-400">
                    {STATUS_LABEL[selected.status]}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {(["active", "waiting", "resolved"] as ConversationStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => changeStatus(st)}
                        className={`px-2 py-1 text-xs rounded transition ${
                          selected.status === st
                            ? "bg-accent text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {STATUS_LABEL[st]}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selected.messages.map((msg) => (
                  <div key={msg.id}>
                    <div
                      className={`flex ${
                        msg.direction === "outgoing" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                          msg.direction === "outgoing"
                            ? "bg-accent text-white rounded-br-md"
                            : "bg-gray-100 text-gray-800 rounded-bl-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            msg.direction === "outgoing"
                              ? "text-white/60"
                              : "text-gray-400"
                          }`}
                        >
                          {new Date(msg.sentAt).toLocaleTimeString("ja-JP", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    {/* AI suggestion area for incoming messages */}
                    {msg.direction === "incoming" && (
                      <div className="mt-1 ml-2">
                        {suggestingFor === msg.id && suggestions.length > 0 ? (
                          <div className="space-y-1.5">
                            <p className="text-xs text-gray-400">AI返信候補:</p>
                            {suggestions.map((sug, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setReplyText(sug);
                                  setSuggestions([]);
                                  setSuggestingFor(null);
                                }}
                                className="block w-full text-left bg-accent/5 border border-accent/20 rounded-lg px-3 py-2 text-sm hover:bg-accent/10 transition"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        ) : suggestingFor === msg.id && loadingSuggestions ? (
                          <p className="text-xs text-gray-400 animate-pulse">
                            AI候補を生成中...
                          </p>
                        ) : (
                          <button
                            onClick={() => fetchSuggestions(msg.id, msg.content)}
                            className="text-xs text-accent hover:underline mt-0.5"
                          >
                            AI返信候補を生成
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="メッセージを入力..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <button
                  onClick={sendReply}
                  disabled={!replyText.trim()}
                  className="bg-accent text-white px-5 py-2 rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  送信
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
