"use client";

import { useState } from "react";
import { mockScriptTemplates } from "@/lib/mock-data";
import type { ScriptTemplate, ScriptSection } from "@/lib/mock-data";

function TemplateSelector({ templates, onSelect }: { templates: ScriptTemplate[]; onSelect: (t: ScriptTemplate) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 text-left hover:border-accent/30 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{t.category}</span>
          </div>
          <h3 className="font-semibold text-foreground mb-1">{t.name}</h3>
          <p className="text-sm text-gray-500">{t.description}</p>
          <p className="text-xs text-gray-400 mt-3">{t.structure.length}セクション</p>
        </button>
      ))}
    </div>
  );
}

function ScriptEditor({ template, onBack }: { template: ScriptTemplate; onBack: () => void }) {
  const [sections, setSections] = useState<(ScriptSection & { content: string })[]>(
    template.structure.map((s) => ({ ...s, content: "" }))
  );
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSections, setGeneratedSections] = useState<Set<number>>(new Set());

  const handleContentChange = (index: number, content: string) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, content } : s)));
  };

  const handleAIAssist = async (index: number) => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const section = sections[index];
    let generated = section.placeholder;
    if (topic) {
      generated = generated.replace(/\[.*?\]/g, topic);
      generated = generated.replace(/【.*?】/g, topic);
    }
    handleContentChange(index, generated);
    setGeneratedSections((prev) => new Set(prev).add(index));
    setIsGenerating(false);
  };

  const handleGenerateAll = async () => {
    setIsGenerating(true);
    for (let i = 0; i < sections.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const section = sections[i];
      let generated = section.placeholder;
      if (topic) {
        generated = generated.replace(/\[.*?\]/g, topic);
        generated = generated.replace(/【.*?】/g, topic);
      }
      handleContentChange(i, generated);
      setGeneratedSections((prev) => new Set(prev).add(i));
    }
    setIsGenerating(false);
  };

  const handleExport = () => {
    const scriptText = sections
      .map((s) => `## ${s.name}（${s.duration}）\n\n${s.content || s.placeholder}\n`)
      .join("\n---\n\n");
    const header = `# ${template.name}\nテーマ: ${topic || "（未指定）"}\nテンプレート: ${template.category}\n\n---\n\n`;
    const blob = new Blob([header + scriptText], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `台本-${template.id}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalChars = sections.reduce((sum, s) => sum + (s.content || "").length, 0);

  return (
    <div>
      <button onClick={onBack} className="text-accent text-sm font-medium mb-6 flex items-center gap-1 hover:underline">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        テンプレート一覧に戻る
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{template.name}</h2>
          <p className="text-sm text-gray-500">{template.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{totalChars}文字</span>
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            エクスポート
          </button>
        </div>
      </div>

      {/* テーマ入力 */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">動画のテーマ</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例: ツインレイの再会サイン、牡羊座3月のタロットリーディング..."
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
          />
          <button
            onClick={handleGenerateAll}
            disabled={isGenerating}
            className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {isGenerating ? "生成中..." : "AIで全セクション生成"}
          </button>
        </div>
      </div>

      {/* 台本セクション */}
      <div className="space-y-4">
        {sections.map((section, i) => (
          <div key={i} className="bg-card-bg rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white bg-accent rounded-full w-6 h-6 flex items-center justify-center">{i + 1}</span>
                <div>
                  <h3 className="font-semibold text-sm">{section.name}</h3>
                  <p className="text-xs text-gray-500">{section.duration} &middot; {section.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleAIAssist(i)}
                disabled={isGenerating}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  generatedSections.has(i)
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-accent/10 text-accent hover:bg-accent/20"
                } disabled:opacity-50`}
              >
                {generatedSections.has(i) ? "再生成" : "AI補完"}
              </button>
            </div>
            <textarea
              value={section.content}
              onChange={(e) => handleContentChange(i, e.target.value)}
              placeholder={section.placeholder}
              rows={5}
              className="w-full px-6 py-4 text-sm resize-y outline-none placeholder:text-gray-300"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScriptPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate | null>(null);

  if (selectedTemplate) {
    return (
      <div className="p-8">
        <ScriptEditor template={selectedTemplate} onBack={() => setSelectedTemplate(null)} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">台本作成</h1>
        <p className="text-gray-500 mt-1">テンプレートを選んでAI補完付きの台本を作成</p>
      </div>
      <TemplateSelector templates={mockScriptTemplates} onSelect={setSelectedTemplate} />
    </div>
  );
}
