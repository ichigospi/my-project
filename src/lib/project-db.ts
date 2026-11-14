// 企画（台本プロジェクト）の永続化先: IndexedDB
//
// 以前は localStorage（Chromeで約10MB／Safariで約5MB）に全企画を1つのJSONで保存していた。
// 157件・約10MBに達した端末では書き込みが失敗し、提出した台本が端末にもサーバーにも残らず消える事故が起きた。
// IndexedDB は実質上限が大きく（数百MB〜）、1企画=1レコードで差分書き込みできるため、ここへ移す。
//
// 読み取りは同期APIを維持する必要がある（getProjects() が各画面で同期的に呼ばれている）ので、
// project-store 側でメモリキャッシュを持ち、このモジュールは「起動時の全件ロード」と「差分書き込み」だけを担う。

const DB_NAME = "fortune_yt_projects";
const STORE = "projects";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

// 接続を捨てて次回開き直す（書き込み失敗時の再試行用）
export function resetProjectDb(): void {
  dbPromise = null;
}

export function idbAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => {
        const db = req.result;
        // 他タブでのバージョンアップ等で閉じられたら次回開き直す
        db.onversionchange = () => { try { db.close(); } catch { /* ignore */ } dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
      req.onblocked = () => { /* 他タブが古い接続を握っている。成功を待つ */ };
    } catch (e) {
      dbPromise = null;
      reject(e);
    }
  });
  return dbPromise;
}

export async function idbLoadAll<T extends { id: string }>(): Promise<T[]> {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutMany<T extends { id: string }>(items: T[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const it of items) store.put(it);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

export async function idbDeleteMany(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

export async function idbCount(): Promise<number> {
  const db = await openDb();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
