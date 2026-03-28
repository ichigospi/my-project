"use client";

import { useState } from "react";
import { mockChannels, formatNumber } from "@/lib/mock-data";
import type { ChannelData } from "@/lib/mock-data";

function ChannelCard({ channel, onSelect }: { channel: ChannelData; onSelect: (ch: ChannelData) => void }) {
  return (
    <div
      onClick={() => onSelect(channel)}
      className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 cursor-pointer hover:border-accent/30 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-lg shrink-0">
          {channel.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{channel.name}</h3>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{channel.category}</span>
        </div>
        <span className="text-sm font-semibold text-success whitespace-nowrap">+{channel.recentGrowth}%</span>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-5 text-center">
        <div>
          <p className="text-lg font-bold">{formatNumber(channel.subscribers)}</p>
          <p className="text-xs text-gray-500">Subscribers</p>
        </div>
        <div>
          <p className="text-lg font-bold">{formatNumber(channel.avgViews)}</p>
          <p className="text-xs text-gray-500">Avg Views</p>
        </div>
        <div>
          <p className="text-lg font-bold">{channel.uploadFrequency}</p>
          <p className="text-xs text-gray-500">Uploads</p>
        </div>
      </div>
    </div>
  );
}

function ChannelDetail({ channel, onBack }: { channel: ChannelData; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} className="text-accent text-sm font-medium mb-6 flex items-center gap-1 hover:underline">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Channel List
      </button>

      <div className="bg-card-bg rounded-xl p-8 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-2xl">
            {channel.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{channel.name}</h2>
            <span className="inline-block mt-1 text-sm px-3 py-1 rounded-full bg-accent/10 text-accent">{channel.category}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {[
            { label: "Subscribers", value: formatNumber(channel.subscribers) },
            { label: "Total Views", value: formatNumber(channel.totalViews) },
            { label: "Videos", value: channel.videoCount.toString() },
            { label: "Avg Views", value: formatNumber(channel.avgViews) },
            { label: "Growth", value: `+${channel.recentGrowth}%` },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-xl font-bold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Videos */}
      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold">Top Videos</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {channel.topVideos.map((video) => (
            <div key={video.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium mb-2">{video.title}</h4>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {video.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{tag}</span>
                    ))}
                  </div>
                  <div className="flex gap-6 text-sm text-gray-500">
                    <span>{formatNumber(video.views)} views</span>
                    <span>{formatNumber(video.likes)} likes</span>
                    <span>{formatNumber(video.comments)} comments</span>
                    <span>{video.duration}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-accent">{video.engagementRate}%</p>
                  <p className="text-xs text-gray-500">Engagement</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChannelAnalysisPage() {
  const [selectedChannel, setSelectedChannel] = useState<ChannelData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChannels = mockChannels.filter(
    (ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()) || ch.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedChannel) {
    return (
      <div className="p-8">
        <ChannelDetail channel={selectedChannel} onBack={() => setSelectedChannel(null)} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Channel Analysis</h1>
          <p className="text-gray-500 mt-1">Analyze competitor channels in the fortune/spiritual niche</p>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search channels by name or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredChannels.map((ch) => (
          <ChannelCard key={ch.id} channel={ch} onSelect={setSelectedChannel} />
        ))}
      </div>

      {filteredChannels.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No channels found</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
}
