import { mockChannels, mockTrendKeywords, formatNumber } from "@/lib/mock-data";

function StatCard({ label, value, change }: { label: string; value: string; change?: string }) {
  return (
    <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {change && <p className="text-sm text-success mt-1">{change}</p>}
    </div>
  );
}

export default function Dashboard() {
  const totalSubscribers = mockChannels.reduce((sum, ch) => sum + ch.subscribers, 0);
  const avgEngagement = 4.05;
  const risingKeywords = mockTrendKeywords.filter((k) => k.trend === "rising").length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-gray-500 mt-1">Competitive overview of the fortune-telling/spiritual YouTube space</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard label="Tracked Channels" value={mockChannels.length.toString()} />
        <StatCard label="Total Subscribers (Tracked)" value={formatNumber(totalSubscribers)} change="+15.2% avg growth" />
        <StatCard label="Avg Engagement Rate" value={`${avgEngagement}%`} />
        <StatCard label="Rising Keywords" value={risingKeywords.toString()} change={`${risingKeywords} trending up`} />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Channels */}
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Top Channels by Growth</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {[...mockChannels]
              .sort((a, b) => b.recentGrowth - a.recentGrowth)
              .slice(0, 5)
              .map((ch, i) => (
                <div key={ch.id} className="px-6 py-4 flex items-center gap-4">
                  <span className="text-sm font-bold text-gray-400 w-6">{i + 1}</span>
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                    {ch.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{ch.name}</p>
                    <p className="text-xs text-gray-500">{formatNumber(ch.subscribers)} subscribers</p>
                  </div>
                  <span className="text-sm font-semibold text-success">+{ch.recentGrowth}%</span>
                </div>
              ))}
          </div>
        </div>

        {/* Trending Keywords */}
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Trending Keywords</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {mockTrendKeywords
              .filter((k) => k.trend === "rising")
              .sort((a, b) => b.monthlyChange - a.monthlyChange)
              .slice(0, 5)
              .map((kw) => (
                <div key={kw.keyword} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{kw.keyword}</p>
                    <p className="text-xs text-gray-500">{formatNumber(kw.searchVolume)} searches/month</p>
                  </div>
                  <span className="text-sm font-semibold text-success">+{kw.monthlyChange}%</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Recent Top Videos */}
      <div className="mt-8 bg-card-bg rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Top Performing Videos (Recent)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Channel</th>
                <th className="px-6 py-3 font-medium text-right">Views</th>
                <th className="px-6 py-3 font-medium text-right">Engagement</th>
                <th className="px-6 py-3 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mockChannels
                .flatMap((ch) => ch.topVideos.map((v) => ({ ...v, channelName: ch.name })))
                .sort((a, b) => b.views - a.views)
                .slice(0, 6)
                .map((video) => (
                  <tr key={video.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-medium max-w-xs truncate">{video.title}</td>
                    <td className="px-6 py-4 text-gray-500">{video.channelName}</td>
                    <td className="px-6 py-4 text-right">{formatNumber(video.views)}</td>
                    <td className="px-6 py-4 text-right">{video.engagementRate}%</td>
                    <td className="px-6 py-4 text-right text-gray-500">{video.publishedAt}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
