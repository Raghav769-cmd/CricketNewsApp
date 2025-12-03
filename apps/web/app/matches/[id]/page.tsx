"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface PlayerInsight {
  playerId: number;
  playerName: string;
  runs: number;
  fours: number;
  sixes: number;
  balls: number;
  battingPosition: number | null;
}

interface TeamScore {
  teamId: number;
  runs: number;
  wickets: number;
  overs?: string;
}

interface BallEvent {
  ballId: number;
  overNumber: number;
  ballNumber: number;
  runs: number;
  extras: string | number | null;
  event: string | null;
  isWicket?: boolean;
  batsmanId: number | null;
  batsmanName: string | null;
  bowlerId: number | null;
  bowlerName: string | null;
  battingTeamId: number | null;
}

interface Insights {
  matchId: number;
  topScorers: PlayerInsight[];
  topSixHitters: PlayerInsight[];
  teamTotals: TeamScore[];
  totalSixes: number;
  lowOrder30Count: number;
  battingRows?: PlayerInsight[];
  balls?: BallEvent[];
}

interface DescriptionRow {
  id: number;
  match_id: number;
  player_id: number;
  player_name?: string;
  description: string;
  author?: string;
  updated_at?: string;
}

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = Number(params?.id || 0);

  const [match, setMatch] = useState<any | null>(null);
  const [score, setScore] = useState<any | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [scorecard, setScorecard] = useState<any | null>(null);
  const [playerDescriptions, setPlayerDescriptions] = useState<DescriptionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchAll = async () => {
    if (!matchId) return;
    setLoading(true);
    try {
      const [mRes, sRes, insRes, ballsRes, scRes, descRes] = await Promise.all([
        fetch(`${apiBase}/api/matches/${matchId}`),
        fetch(`${apiBase}/api/matches/${matchId}/score`),
        fetch(`${apiBase}/api/matches/${matchId}/insights`),
        fetch(`${apiBase}/api/matches/${matchId}/balls`),
        fetch(`${apiBase}/api/matches/${matchId}/scorecard`),
        fetch(`${apiBase}/api/matches/${matchId}/descriptions`),
      ]);
      if (mRes.ok) setMatch(await mRes.json());
      if (sRes.ok) setScore(await sRes.json());
      if (insRes.ok) {
        const ins = await insRes.json();
        if (ballsRes.ok) ins.balls = await ballsRes.json();
        setInsights(ins);
      }
      if (descRes && descRes.ok) setPlayerDescriptions(await descRes.json());
      if (scRes && scRes.ok) setScorecard(await scRes.json());
    } catch (err) {
      console.error('Error fetching match detail data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatOverBall = (overNumber?: number | null, ballNumber?: number | null) => {
    if (overNumber == null || ballNumber == null) return "0.0";
    const o = Number(overNumber);
    const b = Number(ballNumber);
    if (Number.isNaN(o) || Number.isNaN(b)) return "0.0";

    let displayOver = Math.max(0, o - 1);
    let displayBall = Math.max(0, b);
    
    if (displayBall >= 6) {
      displayOver += Math.floor(displayBall / 6);
      displayBall = displayBall % 6;
    }
    return `${displayOver}.${displayBall}`;
  };

  // Helper to resolve a team id to the team name
  const getTeamName = (teamId?: number | null) => {
    if (!match) {
      return teamId != null ? `Team ${teamId}` : 'Team';
    }
    const tId = String(teamId ?? '');
    if (String(match.team1) === tId || String((match as any).team1_id) === tId) return (match as any).team1_name || String(match.team1);
    if (String(match.team2) === tId || String((match as any).team2_id) === tId) return (match as any).team2_name || String(match.team2);
    return teamId != null ? `Team ${teamId}` : 'Team';
  };

  const renderDescriptions = (ins: Insights | null) => {
    if (!ins) return [] as string[];
    const lines: string[] = [];
    const top = ins.topScorers && ins.topScorers[0];
    if (top && (top.runs || 0) > 0) lines.push(`${top.playerName} leads with ${top.runs} (${top.balls} balls) — ${top.fours}x4, ${top.sixes}x6.`);
    const sixLeader = ins.topSixHitters && ins.topSixHitters[0];
    if (sixLeader && sixLeader.sixes > 0) lines.push(`${sixLeader.playerName} hit ${sixLeader.sixes} six${sixLeader.sixes>1?'es':''}.`);
    if (ins.lowOrder30Count && ins.lowOrder30Count > 0) lines.push(`${ins.lowOrder30Count} low-order player(s) crossed 30.`);
    lines.push(`Total sixes: ${ins.totalSixes}.`);
    if (ins.teamTotals && ins.teamTotals.length) {
      const teamSummaries = ins.teamTotals
        .map(t => `${getTeamName(t.teamId)} ${t.runs}/${t.wickets}`)
        .join(' — ');
      lines.push(teamSummaries + '.');
    }
    return lines;
  };

  useEffect(() => {
    fetchAll();

    let socket: any = null;
    (async () => {
      try {
        const { io } = require('socket.io-client');
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';
        socket = io(wsUrl, { transports: ['websocket'] });
        socket.on('connect', () => {
          socket.emit('joinMatch', String(matchId));
        });
        socket.on('ballUpdate', async (data: any) => {
          if (data && Number(data.matchId) === matchId) {
            await fetchAll();
          }
        });
      } catch (err) {
        console.error('socket init failed:', err);
      }
    })();

    return () => {
      if (socket) socket.disconnect();
    };
  }, [matchId]);

  if (!matchId) return (
    <div className="min-h-screen bg-black p-6">
      <div className="container mx-auto">
        <p className="text-red-500">Invalid match id</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <button 
            onClick={() => router.push('/matches')} 
            className="mb-6 inline-flex items-center text-lime-400 hover:text-lime-300 font-semibold transition-colors group"
          >
            <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Matches</span>
          </button>

          {/* Match Header */}
          <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden mb-6 border border-slate-800">
            <div className="bg-linear-to-r from-lime-500 to-slate-600 px-6 py-6 text-black">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">
                    {match ? `${match.team1_name || match.team1} vs ${match.team2_name || match.team2}` : `Match ${matchId}`}
                  </h1>
                  <div className="flex items-center space-x-4 text-lime-900 text-sm">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {match?.venue}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {match?.date ? new Date(match.date).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>
                <span className="px-4 py-2 bg-black text-lime-400 rounded-full text-sm font-semibold shadow-md">
                  {match?.status || 'LIVE'}
                </span>
              </div>

                {/* Live Score Display */}
                {score && score.scores && score.scores.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4 mt-6">
                    {score.scores.map((s: TeamScore, idx: number) => (
                      <div key={s.teamId} className="bg-slate-900 bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-white text-md font-medium mb-1">{getTeamName(s.teamId)}</div>
                        <div className="flex justify-between items-end">
                          <div className="text-4xl text-slate-200 font-bold">{s.runs}/{s.wickets}</div>
                          <div className="text-slate-500">({s.overs} ov)</div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-6 py-4 bg-slate-900 border-t border-slate-800">
              <button 
                onClick={() => router.push(`/matches/${matchId}/player-descriptions`)}
                className="px-6 py-2.5 bg-linear-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-black font-semibold rounded-lg transition-all shadow-sm hover:shadow-md flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Player Descriptions</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-lime-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Scorecard Section */}
              {scorecard && (
                <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden border border-slate-800">
                  <div className="bg-linear-to-r from-lime-500 to-lime-600 px-6 py-4 border-b border-lime-600">
                    <h2 className="text-2xl font-bold text-black flex items-center">
                      <svg className="w-6 h-6 mr-2 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Scorecard</span>
                    </h2>
                  </div>
                  <div className="p-6 space-y-6">
                    {Object.keys(scorecard.teams).map((tid) => {
                      const t = scorecard.teams[Number(tid)];
                      const teamName = getTeamName(Number(tid));
                      return (
                        <div key={tid} className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-linear-to-br from-lime-500 to-lime-600 rounded-xl flex items-center justify-center text-black font-bold shadow-md">
                                {teamName.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-white">{teamName}</h3>
                                {t.totals && (
                                  <p className="text-sm text-gray-400">
                                    {t.totals.totalRuns}/{t.totals.wickets} ({Math.floor((t.totals.balls||0)/6)}.{(t.totals.balls||0)%6} ov)
                                  </p>
                                )}
                              </div>
                            </div>
                            {t.totals && (
                              <div className="text-right">
                                <div className="text-3xl font-bold text-lime-400">{t.totals.totalRuns}</div>
                                <div className="text-sm text-gray-400">Extras: {t.totals.extras}</div>
                              </div>
                            )}
                          </div>

                          {/* Batting Table */}
                          <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-slate-800">
                                  <tr className="text-left text-xs font-semibold text-lime-400 uppercase">
                                    <th className="px-4 py-3">Batsman</th>
                                    <th className="px-4 py-3">Dismissal</th>
                                    <th className="px-4 py-3 text-center">R</th>
                                    <th className="px-4 py-3 text-center">B</th>
                                    <th className="px-4 py-3 text-center">4s</th>
                                    <th className="px-4 py-3 text-center">6s</th>
                                    <th className="px-4 py-3 text-center">SR</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                  {t.batting.map((b: any) => {
                                    const nameClass = b.isStriker ? 'text-cyan-400 font-bold' : 
                                      (b.notOut && !b.isStriker ? 'text-amber-400 font-semibold' : 'text-gray-300');
                                    return (
                                      <tr key={b.playerId} className="hover:bg-slate-800/50 transition-colors border-b border-slate-700">
                                        <td className="px-4 py-3">
                                          <div className="flex items-center">
                                            <span className={nameClass}>{b.playerName}</span>
                                            {b.isStriker && <span className="ml-2 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>}
                                            {b.notOut && !b.isStriker && <span className="ml-2 text-xs text-amber-400">*</span>}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-400">{b.dismissal}</td>
                                        <td className="px-4 py-3 text-center font-bold text-white">{b.runs}</td>
                                        <td className="px-4 py-3 text-center text-gray-400">{b.balls}</td>
                                        <td className="px-4 py-3 text-center text-gray-400">{b.fours}</td>
                                        <td className="px-4 py-3 text-center text-gray-400">{b.sixes}</td>
                                        <td className="px-4 py-3 text-center text-gray-400">
                                          {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Insights Section */}
              {insights && (
                <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden border border-slate-800">
                  <div className="bg-linear-to-r from-lime-500 to-lime-600 px-6 py-4 border-b border-lime-600">
                    <h2 className="text-2xl font-bold text-black flex items-center">
                      <svg className="w-6 h-6 mr-2 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>Match Insights</span>
                    </h2>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* Commentary */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border-l-4 border-lime-500">
                      <div className="space-y-2">
                        {renderDescriptions(insights).map((l, i) => (
                          <p key={i} className="text-gray-300 leading-relaxed">• {l}</p>
                        ))}
                      </div>
                    </div>

                    {/* Top Performers */}
                    <div>
                      <h3 className="text-xl font-bold text-lime-400 mb-4 flex items-center">
                        <svg className="w-6 h-6 mr-2 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        <span>Top Performers</span>
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {(insights.battingRows || insights.topScorers).slice(0, 6).map(p => (
                          <div key={p.playerId} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:shadow-lg transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-bold text-white text-lg">{p.playerName}</div>
                                <div className="text-xs text-gray-400">Position: {p.battingPosition ?? 'N/A'}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-lime-400">{p.runs}</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-sm text-gray-400">
                              <span>{p.balls} balls</span>
                              <span>{p.fours} × 4s</span>
                              <span>{p.sixes} × 6s</span>
                              <span className="font-semibold text-lime-300">{p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : '0.0'} SR</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Event Timeline */}
                    <div>
                      <h3 className="text-xl font-bold text-lime-400 mb-4 flex items-center">
                        <svg className="w-6 h-6 mr-2 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Event Timeline</span>
                      </h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(insights.balls || []).slice().reverse().map(b => {
                          if (b.event && String(b.event).includes('placeholder')) return null;
                          
                          return (
                            <div key={b.ballId} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:bg-slate-700/50 transition-colors">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-semibold text-white mb-1">
                                    {b.batsmanName || 'Batsman'} vs {b.bowlerName || 'Bowler'}
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    {b.event ? b.event : `${b.runs} run${b.runs !== 1 ? 's' : ''}`}
                                    {b.extras && b.extras !== '0' ? ` • extras: ${b.extras}` : ''}
                                    {b.isWicket ? ' • WICKET' : ''}
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-sm font-semibold text-gray-400">Over {formatOverBall(b.overNumber, b.ballNumber)}</div>
                                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1 ${
                                    b.runs === 6 ? 'bg-linear-to-r from-rose-500 to-pink-500 text-white shadow-lg' :
                                    b.runs === 4 ? 'bg-linear-to-r from-orange-500 to-amber-500 text-black shadow-lg' :
                                    b.runs === 0 ? 'bg-slate-700 text-gray-300' :
                                    'bg-linear-to-r from-lime-400 to-lime-500 text-black'
                                  }`}>
                                    {b.runs}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }).filter(Boolean)}
                      </div>
                    </div>

                    {/* Player Descriptions */}
                    {playerDescriptions.length > 0 && (
                      <div>
                        <h3 className="text-xl font-bold text-lime-400 mb-4 flex items-center">
                          <svg className="w-6 h-6 mr-2 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Player Descriptions</span>
                        </h3>
                        <div className="space-y-3">
                          {playerDescriptions.map(d => (
                            <div key={d.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                              <div className="flex justify-between items-start mb-3">
                                <div className="font-bold text-white">{d.player_name ?? `Player ${d.player_id}`}</div>
                                <div className="text-xs text-gray-500">
                                  {d.updated_at ? new Date(d.updated_at).toLocaleString() : ''}
                                  {d.author ? ` • ${d.author}` : ''}
                                </div>
                              </div>
                              <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{d.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!insights && !loading && (
                <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-8 text-center">
                  <p className="text-red-400 font-semibold">Failed to load match insights</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
