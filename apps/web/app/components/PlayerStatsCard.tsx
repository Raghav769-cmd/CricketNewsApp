"use client";

import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

interface PlayerStat {
  id?: number;
  player_id: number;
  team_id: number;
  format: string;
  matches_played: number;
  runs_scored: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  centuries: number;
  half_centuries: number;
  highest_score: number;
  times_out: number;
  wickets_taken: number;
  runs_conceded: number;
  overs_bowled: number;
  best_bowling: string;
  maidens: number;
}

const formatColors: Record<string, string> = {
  "1over": "border-lime-500",
  "t20": "border-blue-500",
  "odi": "border-amber-500",
  "test": "border-purple-500",
};

interface PlayerStatsCardProps {
  playerId: number;
  playerName: string;
  teamId: number;
}

export default function PlayerStatsCard({
  playerId,
  playerName,
  teamId,
}: PlayerStatsCardProps) {
  const [stats, setStats] = useState<Record<string, PlayerStat>>({});
  const [selectedFormat, setSelectedFormat] = useState<string>("t20");
  const [showBatting, setShowBatting] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const socketRef = useRef<any>(null);

  const formats = ["1over", "t20", "odi", "test"];

  const fetchStatsForFormat = async (format: string, baseUrl: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/players/${playerId}/stats/${format}`);
      return await res.json();
    } catch (error) {
      console.error(`Error fetching ${format} stats:`, error);
      return null;
    }
  };

  const refetchAllStats = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const responses = await Promise.all(
        formats.map((format) => fetchStatsForFormat(format, baseUrl))
      );

      const statsMap: Record<string, PlayerStat> = {};
      formats.forEach((format, index) => {
        if (responses[index]) {
          statsMap[format] = responses[index];
        }
      });

      setStats(statsMap);
    } catch (error) {
      console.error("Error refetching player stats:", error);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        
        // Fetch stats for all formats
        const responses = await Promise.all(
          formats.map((format) =>
            fetch(`${baseUrl}/api/players/${playerId}/stats/${format}`)
              .then((res) => res.json())
              .catch(() => null)
          )
        );

        const statsMap: Record<string, PlayerStat> = {};
        formats.forEach((format, index) => {
          if (responses[index]) {
            statsMap[format] = responses[index];
          }
        });

        setStats(statsMap);
      } catch (error) {
        console.error("Error fetching player stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Set up socket connection for real-time updates
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const socket = io(baseUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Listen for stats update events
    socket.on("statsUpdated", (data: { playerId: number; type: string }) => {
      if (data.playerId === playerId) {
        console.log(`Stats updated for player ${playerId}:`, data.type);
        refetchAllStats();
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [playerId]);

  const currentStats = stats[selectedFormat];

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-lg border-2 border-slate-800 p-6 hover:border-lime-500 transition-all">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-lime-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  // Calculate derived stats
  const strikeRate =
    currentStats && currentStats.balls_faced > 0
      ? ((currentStats.runs_scored / currentStats.balls_faced) * 100).toFixed(
          2
        )
      : "0.00";

  const battingAverage =
    currentStats && currentStats.times_out > 0
      ? (currentStats.runs_scored / currentStats.times_out).toFixed(2)
      : "0.00";

  const economy =
    currentStats && currentStats.overs_bowled > 0
      ? (currentStats.runs_conceded / currentStats.overs_bowled).toFixed(2)
      : "0.00";

  const bowlingAverage =
    currentStats && currentStats.wickets_taken > 0
      ? (currentStats.runs_conceded / currentStats.wickets_taken).toFixed(2)
      : "0.00";

  return (
    <div className="bg-slate-900 rounded-lg border-2 border-slate-800 hover:border-lime-500 transition-all shadow-lg hover:shadow-lime-500/20 p-6 group">
      {/* Player Name */}
      <h3 className="text-xl font-bold mb-4 text-lime-400 group-hover:text-lime-300 transition-colors">{playerName}</h3>

      {/* Format Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {formats.map((format) => (
          <button
            key={format}
            onClick={() => setSelectedFormat(format)}
            className={`px-3 py-1 text-xs font-semibold rounded border-2 transition-all ${
              selectedFormat === format
                ? `${formatColors[format] || "border-lime-500"} text-white bg-slate-800`
                : "border-slate-700 text-gray-400 hover:border-slate-600 hover:text-gray-300"
            }`}
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Batting/Bowling Toggle */}
      <div className="flex gap-2 mb-4 border-b border-slate-700">
        <button
          onClick={() => setShowBatting(true)}
          className={`px-3 py-2 text-sm font-semibold transition-colors ${
            showBatting
              ? "text-lime-400 border-b-2 border-lime-500"
              : "text-gray-500 hover:text-gray-400"
          }`}
        >
          Batting
        </button>
        <button
          onClick={() => setShowBatting(false)}
          className={`px-3 py-2 text-sm font-semibold transition-colors ${
            !showBatting
              ? "text-lime-400 border-b-2 border-lime-500"
              : "text-gray-500 hover:text-gray-400"
          }`}
        >
          Bowling
        </button>
      </div>

      {/* Stats Display */}
      {currentStats ? (
        <div className="grid grid-cols-2 gap-3">
          {showBatting ? (
            <>
              <StatRow label="Matches" value={currentStats.matches_played} />
              <StatRow label="Runs" value={currentStats.runs_scored} />
              <StatRow label="Balls" value={currentStats.balls_faced} />
              <StatRow label="SR %" value={strikeRate} />
              <StatRow label="4s" value={currentStats.fours} />
              <StatRow label="6s" value={currentStats.sixes} />
              <StatRow label="100s" value={currentStats.centuries} />
              <StatRow label="50s" value={currentStats.half_centuries} />
              <StatRow label="Avg" value={battingAverage} />
              <StatRow label="HS" value={currentStats.highest_score} />
            </>
          ) : (
            <>
              <StatRow label="Matches" value={currentStats.matches_played} />
              <StatRow label="Wickets" value={currentStats.wickets_taken} />
              <StatRow
                label="Runs Conceded"
                value={currentStats.runs_conceded}
              />
              <StatRow label="Overs" value={currentStats.overs_bowled} />
              <StatRow label="Economy" value={economy} />
              <StatRow label="Best Bowling" value={currentStats.best_bowling} />
              <StatRow label="Maidens" value={currentStats.maidens} />
              <StatRow label="Avg" value={bowlingAverage} />
            </>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">No stats available</div>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex justify-between items-center p-2 bg-slate-800 hover:bg-slate-750 rounded border border-slate-700 transition-colors">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="font-semibold text-lime-400">{value}</span>
    </div>
  );
}
