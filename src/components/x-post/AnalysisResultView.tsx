// 分析結果の構造化表示
"use client";

import type { AnalysisResult } from "@/lib/x-post-analysis-types";

interface Props {
  result: AnalysisResult;
}

export default function AnalysisResultView({ result }: Props) {
  return (
    <div className="space-y-4">
      {result.summary && (
        <Section emoji="📝" title="サマリ">
          <p className="text-sm text-gray-800">{result.summary}</p>
        </Section>
      )}

      {result.structureTypes.length > 0 && (
        <Section emoji="🏗️" title="構造タイプ">
          <ul className="space-y-1.5">
            {result.structureTypes.map((s, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-gray-900">{s.type}</span>
                {typeof s.count === "number" && (
                  <span className="ml-2 text-xs text-gray-500">{s.count}件</span>
                )}
                {s.evidence && (
                  <p className="text-xs text-gray-600 mt-0.5">{s.evidence}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.commonHooks.length > 0 && (
        <Section emoji="🎣" title="共通のフック">
          <ul className="space-y-2">
            {result.commonHooks.map((h, i) => (
              <li key={i} className="text-sm">
                <div className="font-medium text-gray-900">{h.type}</div>
                {h.description && (
                  <p className="text-xs text-gray-600 mt-0.5">{h.description}</p>
                )}
                {h.examples?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {h.examples.map((ex, ei) => (
                      <span key={ei} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                        「{ex}」
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.reinforcementElements.length > 0 && (
        <Section emoji="💪" title="共通の強化要素">
          <ul className="space-y-2">
            {result.reinforcementElements.map((r, i) => (
              <li key={i} className="text-sm">
                <div className="font-medium text-gray-900">{r.element}</div>
                {r.description && (
                  <p className="text-xs text-gray-600 mt-0.5">{r.description}</p>
                )}
                {r.examples?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.examples.map((ex, ei) => (
                      <span key={ei} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                        「{ex}」
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.educationTypes.length > 0 && (
        <Section emoji="📚" title="教育タイプ">
          <ul className="space-y-1.5">
            {result.educationTypes.map((e, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-gray-900">{e.type}</span>
                {e.description && (
                  <p className="text-xs text-gray-600 mt-0.5">{e.description}</p>
                )}
                {e.evidence && (
                  <p className="text-xs text-gray-500 mt-0.5 italic">根拠: {e.evidence}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.powerWords.length > 0 && (
        <Section emoji="🔥" title="使われたパワーワード">
          <div className="flex flex-wrap gap-1.5">
            {result.powerWords.map((w, i) => (
              <span key={i} className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded">
                {w}
              </span>
            ))}
          </div>
        </Section>
      )}

      {result.applicationHints.length > 0 && (
        <Section emoji="💡" title="自アカ転用ヒント">
          <ul className="space-y-1.5">
            {result.applicationHints.map((h, i) => (
              <li key={i} className="text-sm text-gray-800 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">›</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-bold text-gray-900 mb-2">
        {emoji} {title}
      </h4>
      {children}
    </section>
  );
}
