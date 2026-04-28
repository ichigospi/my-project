"use client";

import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";

interface Props {
  title: string;
  emoji: string;
  description: string;
  upcoming: string[];
}

export default function XPostSkeleton({ title, emoji, description, upcoming }: Props) {
  const [genre] = useXPostGenre();
  const genreLabel = X_POST_GENRES.find((g) => g.value === genre)?.label ?? "";

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>{emoji}</span>
          {title}
          <span className="text-base font-normal text-gray-500">（{genreLabel}）</span>
        </h2>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-5xl mb-3">🚧</div>
        <div className="text-lg font-bold text-gray-900">Phase 2 以降で実装予定</div>
        <p className="text-sm text-gray-600 mt-2">
          このページの基盤は準備済みです。次のフェーズで機能を実装します。
        </p>

        <div className="mt-6 text-left max-w-md mx-auto">
          <div className="text-xs font-bold text-gray-700 mb-2">予定している機能:</div>
          <ul className="text-sm text-gray-600 space-y-1">
            {upcoming.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
