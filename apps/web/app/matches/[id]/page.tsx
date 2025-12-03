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
      const teamSummaries = ins.teamTotals.map(t => `Team ${t.teamId} ${t.runs}/${t.wickets}`).join(' — ');
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="container mx-auto">
        <p className="text-red-600">Invalid match id</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <button 
            onClick={() => router.push('/matches')} 
            className="mb-6 inline-flex items-center text-teal-600 hover:text-teal-700 font-semibold transition-colors"
          >
            <span className="mr-2">←</span> Back to Matches
          </button>

          {/* Match Header */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
            <div className="bg-linear-to-r from-teal-600 to-teal-700 px-6 py-6 text-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">
                    {match ? `${match.team1} vs ${match.team2}` : `Match ${matchId}`}
                  </h1>
                  <div className="flex items-center space-x-4 text-teal-50 text-sm">
                    <span className="flex items-center">
                      <span className="mr-2">📍</span>
                      {match?.venue}
                    </span>
                    <span className="flex items-center">
                      <span className="mr-2">📅</span>
                      {match?.date ? new Date(match.date).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>
                <span className="px-4 py-2 bg-white text-teal-700 rounded-full text-sm font-semibold shadow-md">
                  {match?.status || 'LIVE'}
                </span>
              </div>

                {/* Live Score Display */}
                {score && score.scores && score.scores.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4 mt-6">
                    {score.scores.map((s: TeamScore, idx: number) => (
                      <div key={s.teamId} className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
                        <div className="text-teal-900 text-sm mb-1">Team {s.teamId}</div>
                        <div className="flex justify-between items-end">
                          <div className="text-4xl text-teal-800 font-bold">{s.runs}/{s.wickets}</div>
                          <div className="text-teal-900">({s.overs} ov)</div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button 
                onClick={() => router.push(`/matches/${matchId}/player-descriptions`)}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors"
              >
                Player Descriptions
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Scorecard Section */}
              {scorecard && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                      <span className="text-2xl mr-2">📊</span>
                      Scorecard
                    </h2>
                  </div>
                  <div className="p-6 space-y-6">
                    {Object.keys(scorecard.teams).map((tid) => {
                      const t = scorecard.teams[Number(tid)];
                      return (
                        <div key={tid} className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-linear-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                                T{tid}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-gray-800">Team {tid}</h3>
                                {t.totals && (
                                  <p className="text-sm text-gray-600">
                                    {t.totals.totalRuns}/{t.totals.wickets} ({Math.floor((t.totals.balls||0)/6)}.{(t.totals.balls||0)%6} ov)
                                  </p>
                                )}
                              </div>
                            </div>
                            {t.totals && (
                              <div className="text-right">
                                <div className="text-3xl font-bold text-teal-600">{t.totals.totalRuns}</div>
                                <div className="text-sm text-gray-500">Extras: {t.totals.extras}</div>
                              </div>
                            )}
                          </div>

                          {/* Batting Table */}
                          <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-slate-100">
                                  <tr className="text-left text-xs font-semibold text-gray-600 uppercase">
                                    <th className="px-4 py-3">Batsman</th>
                                    <th className="px-4 py-3">Dismissal</th>
                                    <th className="px-4 py-3 text-center">R</th>
                                    <th className="px-4 py-3 text-center">B</th>
                                    <th className="px-4 py-3 text-center">4s</th>
                                    <th className="px-4 py-3 text-center">6s</th>
                                    <th className="px-4 py-3 text-center">SR</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {t.batting.map((b: any) => {
                                    const nameClass = b.isStriker ? 'text-green-600 font-bold' : 
                                      (b.notOut && !b.isStriker ? 'text-blue-600 font-semibold' : 'text-gray-800');
                                    return (
                                      <tr key={b.playerId} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                          <div className="flex items-center">
                                            <span className={nameClass}>{b.playerName}</span>
                                            {b.isStriker && <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
                                            {b.notOut && !b.isStriker && <span className="ml-2 text-xs text-blue-600">*</span>}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{b.dismissal}</td>
                                        <td className="px-4 py-3 text-center font-bold text-gray-800">{b.runs}</td>
                                        <td className="px-4 py-3 text-center text-gray-600">{b.balls}</td>
                                        <td className="px-4 py-3 text-center text-gray-600">{b.fours}</td>
                                        <td className="px-4 py-3 text-center text-gray-600">{b.sixes}</td>
                                        <td className="px-4 py-3 text-center text-gray-600">
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
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                      <span className="text-2xl mr-2">💡</span>
                      Match Insights
                    </h2>
                  </div>
                  <div className="p-6 space-y-6">
                    {/* Commentary */}
                    <div className="bg-linear-to-r from-teal-50 to-teal-100 rounded-lg p-4 border-l-4 border-teal-500">
                      <div className="space-y-2">
                        {renderDescriptions(insights).map((l, i) => (
                          <p key={i} className="text-gray-700 leading-relaxed">• {l}</p>
                        ))}
                      </div>
                    </div>

                    {/* Top Performers */}
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <span className="text-xl mr-2">🏆</span>
                        Top Performers
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {(insights.battingRows || insights.topScorers).slice(0, 6).map(p => (
                          <div key={p.playerId} className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-bold text-gray-800 text-lg">{p.playerName}</div>
                                <div className="text-xs text-gray-500">Position: {p.battingPosition ?? 'N/A'}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-teal-600">{p.runs}</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <span>{p.balls} balls</span>
                              <span>{p.fours} × 4s</span>
                              <span>{p.sixes} × 6s</span>
                              <span className="font-semibold">{p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : '0.0'} SR</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Event Timeline */}
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <span className="text-xl mr-2">⚡</span>
                        Event Timeline
                      </h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(insights.balls || []).slice().reverse().map(b => {
                          if (b.event && String(b.event).includes('placeholder')) return null;
                          
                          return (
                            <div key={b.ballId} className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:bg-slate-100 transition-colors">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-800 mb-1">
                                    {b.batsmanName || 'Batsman'} vs {b.bowlerName || 'Bowler'}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {b.event ? b.event : `${b.runs} run${b.runs !== 1 ? 's' : ''}`}
                                    {b.extras && b.extras !== '0' ? ` • extras: ${b.extras}` : ''}
                                    {b.isWicket ? ' • 🔴 WICKET' : ''}
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-sm font-semibold text-gray-600">Over {formatOverBall(b.overNumber, b.ballNumber)}</div>
                                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1 ${
                                    b.runs === 6 ? 'bg-purple-500 text-white' :
                                    b.runs === 4 ? 'bg-green-500 text-white' :
                                    b.runs === 0 ? 'bg-gray-300 text-gray-700' :
                                    'bg-blue-500 text-white'
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
                        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                          <span className="text-xl mr-2">📝</span>
                          Player Descriptions
                        </h3>
                        <div className="space-y-3">
                          {playerDescriptions.map(d => (
                            <div key={d.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                              <div className="flex justify-between items-start mb-3">
                                <div className="font-bold text-gray-800">{d.player_name ?? `Player ${d.player_id}`}</div>
                                <div className="text-xs text-gray-500">
                                  {d.updated_at ? new Date(d.updated_at).toLocaleString() : ''}
                                  {d.author ? ` • ${d.author}` : ''}
                                </div>
                              </div>
                              <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{d.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!insights && !loading && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center">
                  <p className="text-red-600 font-semibold">Failed to load match insights</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
