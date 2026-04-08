import { NextResponse } from "next/server";

// localStorageのデータをエクスポートするためのクライアント用HTMLページを返す
export async function GET() {
  const html = `<!DOCTYPE html>
<html><head><title>Export</title></head>
<body>
<script>
  const data = JSON.stringify({
    analyses: JSON.parse(localStorage.getItem("fortune_yt_analyses") || "[]"),
    proposals: JSON.parse(localStorage.getItem("fortune_yt_proposals") || "[]"),
  }, null, 2);
  const blob = new Blob([data], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "export.json";
  document.body.appendChild(a);
  a.click();
  document.body.innerHTML = "<h2>ダウンロード開始しました。このタブを閉じてOKです。</h2>";
</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
