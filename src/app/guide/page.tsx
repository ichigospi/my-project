"use client";

import { useSession } from "next-auth/react";

export default function GuidePage() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role || "";

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">使い方ガイド</h1>
        <p className="text-gray-500 mt-1">ツールの基本的な使い方と設定方法</p>
      </div>

      <div className="space-y-6">
        {/* 全体の流れ */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-lg mb-3">台本作成の流れ</h2>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">1</span>
              <div><strong>動画検索</strong> — 登録チャンネルから伸びてる動画を探す。再生数や倍率でフィルターして、参考にしたい動画を見つける</div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">2</span>
              <div><strong>台本分析</strong> — 参考動画の台本を読み取って、AIで構造・フック・CTAを分析。「台本分析へ」ボタンでURLが自動セットされる</div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">3</span>
              <div><strong>台本作成</strong> — 分析結果をもとに、AIが台本を生成。ジャンル→タイトル→参考動画→分析→構成→台本の6ステップ</div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">4</span>
              <div><strong>工程表</strong> — 制作の進捗を管理。台本作成から自動的にタスクが追加される</div>
            </div>
          </div>
        </div>

        {/* 画面読み取り設定 */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-lg mb-3">画面読み取り（テロップOCR）の設定</h2>
          <p className="text-sm text-gray-500 mb-4">
            字幕がない動画の台本を読み取るには、YouTube Cookieの設定が必要です。
          </p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">ステップ1: Chrome拡張機能をインストール</h3>
              <p className="text-sm text-gray-600">
                <a href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer" className="text-accent underline font-medium">
                  Get cookies.txt LOCALLY
                </a>
                {" "}をChromeにインストールしてください。
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">ステップ2: YouTubeのCookieをエクスポート</h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>YouTubeにログインした状態で <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" className="text-accent underline">youtube.com</a> を開く</li>
                <li>ブラウザ右上の拡張機能アイコンをクリック</li>
                <li>「Get cookies.txt LOCALLY」を選択</li>
                <li>「Export」ボタンを押して cookies.txt をダウンロード</li>
              </ol>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">ステップ3: ツールにアップロード</h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>このツールの<a href="/settings" className="text-accent underline">設定ページ</a>を開く</li>
                <li>「YouTube Cookie」セクションで cookies.txt をアップロード</li>
                <li>「Cookie設定済み」と表示されれば完了</li>
              </ol>
            </div>

            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <strong>注意:</strong> Cookieは数週間で期限切れになります。画面読み取りが失敗するようになったら、同じ手順で再アップロードしてください。
              </p>
            </div>
          </div>
        </div>

        {/* 台本分析の使い方 */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-lg mb-3">台本分析の使い方</h2>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">1</span>
              <div><strong>動画検索で「台本分析へ」をクリック</strong> — URLが自動で台本分析ページにセットされます</div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">2</span>
              <div><strong>「取得」ボタンを押す</strong> — 動画情報と字幕を取得します</div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">3</span>
              <div><strong>字幕がない場合は「自動で画面読み取り」</strong> — Cookie設定済みなら自動でテロップを読み取ります（数分かかります）</div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">4</span>
              <div><strong>「AIで台本を分析する」を押す</strong> — 構造・フック・CTA・成長要因をAIが分析します</div>
            </div>
          </div>
        </div>

        {/* ロールについて */}
        {(userRole === "owner" || userRole === "admin") && (
          <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-lg mb-3">ユーザーロールについて</h2>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3 items-start">
                <span className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">オーナー</span>
                <div className="text-gray-600">全操作 + ユーザー管理 + ロール変更（1人のみ）</div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">管理者</span>
                <div className="text-gray-600">全操作 + ユーザー招待</div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">編集者</span>
                <div className="text-gray-600">台本作成・工程表編集・分析・Cookie設定（ユーザー管理は不可）</div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">閲覧者</span>
                <div className="text-gray-600">全ページ閲覧のみ</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
