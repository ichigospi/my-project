// Threadsツール用の選択中アカウント切替（localStorage永続化、ページ間共有）
// Xツールの genre 切替と同じ仕組みだが、アカウントはDB管理で可変なのでIDを保持する
"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "threads_account_id";
const EVENT_NAME = "threads-account-changed";

export interface ThreadsAccountSummary {
  id: string;
  name: string;
  handle: string;
  isActive: boolean;
}

export function getSelectedAccountId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) || "";
}

export function setSelectedAccountId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: id }));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

// 現在の選択アカウントIDを購読（SSRセーフ）
export function useThreadsAccountId(): [string, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, getSelectedAccountId, () => "");
  return [id, setSelectedAccountId];
}
