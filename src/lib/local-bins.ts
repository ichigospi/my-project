// ローカル実行バイナリ（yt-dlp / ffmpeg）の探索。Windows / macOS 両対応。
// macは Finderから起動した場合 PATH に homebrew が入らないため明示的に足す。
// Windowsは PATH の区切りが ";" で、whichではなくwhereを使う。
import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";

export function localExecEnv(): NodeJS.ProcessEnv {
  const isWin = process.platform === "win32";
  if (isWin) {
    // winget/scoop の設置先は、インストール前に起動したサーバープロセスの PATH には
    // 入っていないため、明示的に足す（サーバーを再起動しなくても yt-dlp/ffmpeg を見つけられるように）。
    const local = process.env.LOCALAPPDATA || "";
    const userprofile = process.env.USERPROFILE || "";
    const winPaths = [
      process.env.PATH || "",
      local ? `${local}\\Microsoft\\WinGet\\Links` : "",            // winget のショートカット置き場
      local ? `${local}\\Microsoft\\WindowsApps` : "",
      userprofile ? `${userprofile}\\scoop\\shims` : "",              // scoop
    ].filter(Boolean);
    return { ...process.env, PATH: winPaths.join(";") };
  }
  // mac: homebrew に加えて、python.org 版 Python（pip install yt-dlp の置き場）・pipx・MacPorts も探す
  const home = process.env.HOME || "";
  const extra: string[] = ["/opt/homebrew/bin", "/usr/local/bin", "/opt/local/bin", "/usr/bin", "/bin"];
  if (home) extra.push(`${home}/.local/bin`);
  const globDirs = (base: string, suffix: string) => {
    try {
      return readdirSync(base).map((v) => `${base}/${v}${suffix}`).filter((d) => existsSync(d));
    } catch { return []; }
  };
  extra.push(...globDirs("/Library/Frameworks/Python.framework/Versions", "/bin"));
  if (home) extra.push(...globDirs(`${home}/Library/Python`, "/bin"));
  const PATH = [process.env.PATH || "", ...extra].join(":");
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
