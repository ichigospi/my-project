// yt-dlp のローカル用Cookie戦略（サーバールート専用・fs使用）。
// インストールされていないブラウザは最初から除外する（「firefox が無い」等の
// 無意味なエラーが最後に上書き表示され、本当の失敗原因が隠れるのを防ぐ）。
import { existsSync } from "fs";
import { join } from "path";

export interface CookieStrategy {
  label: string;
  args: string[];
}

export function localCookieStrategies(): CookieStrategy[] {
  const out: CookieStrategy[] = [{ label: "no-cookie", args: [] }];
  const home = process.env.HOME || "";

  if (process.platform === "darwin") {
    if (home && existsSync(join(home, "Library/Application Support/Google/Chrome"))) {
      out.push({ label: "chrome", args: ["--cookies-from-browser", "chrome"] });
    }
    if (home && existsSync(join(home, "Library/Safari"))) {
      out.push({ label: "safari", args: ["--cookies-from-browser", "safari"] });
    }
    if (home && existsSync(join(home, "Library/Application Support/Firefox/Profiles"))) {
      out.push({ label: "firefox", args: ["--cookies-from-browser", "firefox"] });
    }
  } else {
    out.push({ label: "chrome", args: ["--cookies-from-browser", "chrome"] });
    if (home && existsSync(join(home, ".mozilla/firefox"))) {
      out.push({ label: "firefox", args: ["--cookies-from-browser", "firefox"] });
    }
  }
  return out;
}

// 全戦略失敗時に「どの戦略が何で落ちたか」を1行ずつまとめる（原因診断用）
export function summarizeStrategyErrors(errors: { label: string; err: string }[]): string {
  if (errors.length === 0) return "不明なエラー";
  const lines = errors.map((e) => `[${e.label}] ${e.err.replace(/\s+/g, " ").trim().slice(0, 180)}`);
  if (errors.some((e) => /CERTIFICATE_VERIFY_FAILED/.test(e.err))) {
    lines.push("※ SSL証明書エラー: Macの python.org 版 Python は証明書が未設定です。Finderで「アプリケーション → Python 3.x → Install Certificates.command」をダブルクリックしてから再試行してください（brew install yt-dlp でも解消します）");
  }
  return lines.join("\n");
}
