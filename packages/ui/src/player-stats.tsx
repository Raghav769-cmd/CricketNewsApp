import React from 'react';

interface BattingStats {
  playerId: number;
  playerName: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  timesOut: number;
  dismissal: string | null;
  strikeRate: number;
}

interface BowlingStats {
  playerId: number;
  playerName: string;
  balls: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  foursConceded: number;
  sixesConceded: number;
}

interface PlayerStatsProps {
  type: 'batting' | 'bowling';
  stats: BattingStats | BowlingStats;
  isActive?: boolean;
  isStriker?: boolean;
}

const PlayerStats: React.FC<PlayerStatsProps> = ({ 
  type, 
  stats, 
  isActive = false,
  isStriker = false
}) => {
  if (type === 'batting') {
    const bStats = stats as BattingStats;
    
    return (
      <div className={`
        bg-slate-800/70 rounded-lg border-2 border-slate-700 
        hover:shadow-lg transition-all overflow-hidden
        ${isActive ? 'ring-2 ring-lime-500 shadow-lg shadow-lime-500/20 border-lime-500' : ''}
        ${isStriker ? 'border-cyan-400' : ''}
      `}>
        {/* Header Row */}
        <div className="bg-linear-to-r from-slate-900 to-slate-800 px-4 py-2 border-b border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`font-bold text-sm truncate ${isStriker ? 'text-cyan-400' : 'text-white'}`}>
                {bStats.playerName}
              </span>
              {isStriker && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-cyan-500/30 text-cyan-400 text-xs font-bold rounded shrink-0">
                  <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></span>
                  S
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-gray-400">Runs:</span>
              <span className="text-lg font-bold text-lime-400 ml-1">{bStats.runs}</span>
            </div>
          </div>
        </div>

        {/* Stats Row - Single Line */}
        <div className="px-4 py-3 flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
            <span className="text-gray-400">Balls:</span>
            <span className="font-bold text-white">{bStats.balls}</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
            <span className="text-gray-400">4s:</span>
            <span className="font-bold text-orange-400">{bStats.fours}</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
            <span className="text-gray-400">6s:</span>
            <span className="font-bold text-rose-400">{bStats.sixes}</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
            <span className="text-gray-400">SR:</span>
            <span className="font-bold text-lime-400">{bStats.strikeRate.toFixed(1)}</span>
          </div>
          {bStats.dismissal && (
            <div className="flex items-center gap-1 bg-red-900/30 rounded px-2 py-1 text-red-400 font-semibold ml-auto">
              <span className="text-xs">Out: {bStats.dismissal}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Bowling stats
  const bowlStats = stats as BowlingStats;

  return (
    <div className={`
      bg-slate-800/70 rounded-lg border-2 border-slate-700 
      hover:shadow-lg transition-all overflow-hidden
      ${isActive ? 'ring-2 ring-lime-500 shadow-lg shadow-lime-500/20 border-lime-500' : ''}
    `}>
      {/* Header Row */}
      <div className="bg-linear-to-r from-slate-900 to-slate-800 px-4 py-2 border-b border-slate-700">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-sm text-white truncate flex-1">{bowlStats.playerName}</span>
          <div className="text-right shrink-0">
            <span className="text-xs text-gray-400">Wickets:</span>
            <span className="text-lg font-bold text-amber-400 ml-1">{bowlStats.wickets}</span>
          </div>
        </div>
      </div>

      {/* Stats Row - Single Line */}
      <div className="px-4 py-3 flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
          <span className="text-gray-400">Balls:</span>
          <span className="font-bold text-white">{bowlStats.balls}</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
          <span className="text-gray-400">Runs:</span>
          <span className="font-bold text-red-400">{bowlStats.runsConceded}</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
          <span className="text-gray-400">Eco:</span>
          <span className="font-bold text-lime-400">{bowlStats.economy.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
          <span className="text-gray-400">4s:</span>
          <span className="font-bold text-orange-400">{bowlStats.foursConceded}</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
          <span className="text-gray-400">6s:</span>
          <span className="font-bold text-rose-400">{bowlStats.sixesConceded}</span>
        </div>
      </div>
    </div>
  );
};

export default PlayerStats;
export type { PlayerStatsProps, BattingStats, BowlingStats };
