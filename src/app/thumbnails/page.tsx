"use client";

import { mockTitlePatterns, mockChannels, formatNumber } from "@/lib/mock-data";

export default function ThumbnailsPage() {
  const allVideos = mockChannels.flatMap((ch) =>
    ch.topVideos.map((v) => ({ ...v, channelName: ch.name }))
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Thumbnail & Title Analysis</h1>
        <p className="text-gray-500 mt-1">Analyze title patterns and thumbnail strategies that drive views</p>
      </div>

      {/* Title Patterns */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Title Patterns (by Performance)</h2>
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
                    <p className="text-lg font-bold text-accent">{formatNumber(pattern.avgViews)}</p>
                    <p className="text-xs text-gray-500">avg views</p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Usage frequency</span>
                    <span>{pattern.frequency}% of top videos</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${pattern.frequency}%` }} />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-2">Examples:</p>
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

      {/* Thumbnail Analysis Summary */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Thumbnail Pattern Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Dominant Colors",
              items: ["Purple / Mystical tones", "Gold / Warm highlights", "Deep blue backgrounds"],
              icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
            },
            {
              title: "Common Elements",
              items: ["Tarot cards / Crystal imagery", "Face with surprised expression", "Text overlay with numbers/dates"],
              icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
            },
            {
              title: "Text Strategies",
              items: ["Large bold text (3-5 words max)", "Emoji usage in thumbnails", "Question marks for curiosity"],
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

      {/* Video Title Examples */}
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">High-Performance Title Examples</h2>
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
                  <p className="font-bold text-sm">{formatNumber(video.views)}</p>
                  <p className="text-xs text-gray-500">{video.engagementRate}% engagement</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
