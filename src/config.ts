import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

export function getBearerToken(): string {
  const token = process.env.X_BEARER_TOKEN;
  if (!token || token === "your_bearer_token_here") {
    console.error("エラー: X_BEARER_TOKEN が設定されていません。");
    console.error("");
    console.error("1. .env.example を .env にコピー:");
    console.error("   cp .env.example .env");
    console.error("");
    console.error("2. .env に Bearer Token を設定:");
    console.error("   X_BEARER_TOKEN=your_actual_token");
    console.error("");
    console.error("Bearer Token は https://developer.x.com/en/portal/dashboard で取得できます。");
    process.exit(1);
  }
  return token;
}
