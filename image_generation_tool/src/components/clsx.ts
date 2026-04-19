// tailwind の条件付きクラス合成用ミニヘルパー。
// clsx パッケージは入れずに自作（依存を増やさない）。

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}
