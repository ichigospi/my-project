"use client";

import { mockTitlePatterns, mockChannels, formatNumber } from "@/lib/mock-data";

export default function ThumbnailsPage() {
  const allVideos = mockChannels.flatMap((ch) =>
    ch.topVideos.map((v) => ({ ...v, channelName: ch.name }))
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">サムネ・タイトル分析</h1>
        <p className="text-gray-500 mt-1">再生数を伸ばすタイトルパターンとサムネイル戦略を分析</p>
      </div>

      {/* タイトルパターン */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">タイトルパターン（パフォーマンス順）</h2>
        <div className="space-y-4">
          {mockTitlePatterns
            .sort((a, b) => b.avgViews - a.avgViews)
            .map((pattern, i) => (
              <div key={i} className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-white bg-accent rounded-full w-6 h-6 flex items-center justify-center">{i + 1}</span>
                      <h3 className="font-semibold text-foreground">{pattern.pattern}</h3>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-accent">{formatNumber(pattern.avgViews)}回</p>
                    <p className="text-xs text-gray-500">平均再生数</p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>使用頻度</span>
                    <span>人気動画の{pattern.frequency}%が使用</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${pattern.frequency}%` }} />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-2">実例:</p>
                  <div className="space-y-1">
                    {pattern.examples.map((ex, j) => (
                      <p key={j} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                        &ldquo;{ex}&rdquo;
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* サムネイル分析サマリ */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">サムネイルパターンの傾向</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "よく使われる色",
              items: ["紫 / ミステリアスな色調", "金色 / 暖かいハイライト", "ダークブルーの背景"],
              icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
            },
            {
              title: "よく使われる要素",
              items: ["タロットカード / クリスタルの画像", "驚いた表情の顔", "数字や日付のテキスト"],
              icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
            },
            {
              title: "テキスト戦略",
              items: ["大きい太字テキスト（3〜5文字）", "サムネにインパクトワード", "「？」で好奇心を刺激"],
              icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129",
            },
          ].map((insight) => (
            <div key={insight.title} className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={insight.icon} />
                </svg>
                <h3 className="font-semibold text-sm">{insight.title}</h3>
              </div>
              <ul className="space-y-2">
                {insight.items.map((item) => (
                  <li key={item} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-accent mt-1.5 shrink-0">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" /></svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 高パフォーマンスタイトル一覧 */}
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">高パフォーマンスタイトル一覧</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {allVideos
            .sort((a, b) => b.views - a.views)
            .map((video) => (
              <div key={video.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{video.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{video.channelName}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="font-bold text-sm">{formatNumber(video.views)}回</p>
                  <p className="text-xs text-gray-500">{video.engagementRate}% エンゲージメント</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
