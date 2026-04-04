export function getApiKey(key: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(key) || "";
}

export function setApiKey(key: string, value: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}
