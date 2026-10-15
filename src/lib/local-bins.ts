// ローカル実行バイナリ（yt-dlp / ffmpeg）の探索。Windows / macOS 両対応。
// macは Finderから起動した場合 PATH に homebrew が入らないため明示的に足す。
// Windowsは PATH の区切りが ";" で、whichではなくwhereを使う。
import { execSync } from "child_process";

export function localExecEnv(): NodeJS.ProcessEnv {
  const isWin = process.platform === "win32";
  const PATH = isWin
    ? (process.env.PATH || "")
    : [process.env.PATH || "", "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");
  return { ...process.env, PATH };
}

// バイナリのフルパスを返す（見つからなければnull）
export function findBinary(name: string, env: NodeJS.ProcessEnv): string | null {
  const isWin = process.platform === "win32";
  try {
    const out = execSync(`${isWin ? "where" : "which"} ${name}`, { env, stdio: "pipe" })
      .toString().trim().split(/\r?\n/)[0];
    return out || null;
  } catch {
    return null;
  }
}
