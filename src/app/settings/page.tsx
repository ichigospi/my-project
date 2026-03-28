"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In production, save to secure storage / env
    if (typeof window !== "undefined") {
      localStorage.setItem("yt_api_key", youtubeApiKey);
      localStorage.setItem("ai_api_key", aiApiKey);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Load saved keys on mount
  useState(() => {
    if (typeof window !== "undefined") {
      setYoutubeApiKey(localStorage.getItem("yt_api_key") || "");
      setAiApiKey(localStorage.getItem("ai_api_key") || "");
    }
  });

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-gray-500 mt-1">Configure API keys and preferences</p>
      </div>

      <div className="space-y-6">
        {/* YouTube API Key */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">YouTube Data API Key</h2>
          <p className="text-sm text-gray-500 mb-4">
            Required for live channel/video data. Get a key from{" "}
            <span className="text-accent">Google Cloud Console &gt; APIs &gt; YouTube Data API v3</span>.
          </p>
          <input
            type="password"
            value={youtubeApiKey}
            onChange={(e) => setYoutubeApiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm font-mono"
          />
          <div className="mt-3 p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>Setup Guide:</strong>
            </p>
            <ol className="text-xs text-amber-700 mt-1 space-y-1 list-decimal list-inside">
              <li>Go to Google Cloud Console</li>
              <li>Create a project (or select existing)</li>
              <li>Enable &quot;YouTube Data API v3&quot;</li>
              <li>Go to Credentials &gt; Create Credentials &gt; API Key</li>
              <li>Copy the key and paste it above</li>
            </ol>
          </div>
        </div>

        {/* AI API Key */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">AI API Key (Claude / OpenAI)</h2>
          <p className="text-sm text-gray-500 mb-4">
            Used for AI-powered script generation. Supports Claude API or OpenAI API.
          </p>
          <input
            type="password"
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            placeholder="sk-ant-... or sk-..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm font-mono"
          />
        </div>

        {/* Data Source Info */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">Data Source</h2>
          <p className="text-sm text-gray-500 mb-4">Current data mode</p>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
            youtubeApiKey ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${youtubeApiKey ? "bg-green-500" : "bg-amber-500"}`} />
            {youtubeApiKey ? "Live API Data" : "Demo Mode (Mock Data)"}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
