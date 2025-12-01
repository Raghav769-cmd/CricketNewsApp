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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  if (!matchId) return (
    <div className="p-6">Invalid match id</div>
  );

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.push('/matches')} className="text-sm text-blue-600 cursor-pointer">← Back to matches</button>
          <button onClick={() => router.push(`/matches/${matchId}/player-descriptions`)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded">Player Descriptions</button>
        </div>
        <h1 className="text-2xl font-semibold text-gray-800">{match ? `${match.team1} vs ${match.team2}` : `Match ${matchId}`}</h1>
        <p className="text-sm text-gray-600">{match?.venue} • {match?.status} • {match?.date ? new Date(match.date).toLocaleString() : ''}</p>

        <div className="mt-4">
          {score && score.scores && score.scores.length > 0 && (
            <div className="p-3 bg-green-50 rounded">
              {score.scores.map((s: TeamScore) => (
                <div key={s.teamId} className="font-bold text-green-700">Team {s.teamId}: {s.runs}/{s.wickets} ({s.overs})</div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 rounded">
            <h3 className="text-lg font-semibold">Match Insights</h3>
            {loading && <p className="text-sm text-gray-600">Loading...</p>}
            {/* Scorecard rendering */}
            {!loading && scorecard && (
              <div className="mb-4">
                {Object.keys(scorecard.teams).map((tid) => {
                  const t = scorecard.teams[Number(tid)];
                  return (
                    <div key={tid} className="mb-4 bg-white p-3 rounded shadow-sm">
                      <div className="flex items-baseline justify-between mb-2">
                        <div className="font-semibold">Team {tid}</div>
                        <div className="text-sm text-gray-700">{t.totals ? `${t.totals.totalRuns}/${t.totals.wickets} (${Math.floor((t.totals.balls||0)/6)}.${(t.totals.balls||0)%6})` : ''}</div>
                      </div>
                      <table className="w-full text-sm table-auto">
                        <thead>
                          <tr className="text-left text-xs text-gray-500">
                            <th className="pb-2">Batsman</th>
                            <th className="pb-2">Dismissal</th>
                            <th className="pb-2">R</th>
                            <th className="pb-2">B</th>
                            <th className="pb-2">4s</th>
                            <th className="pb-2">6s</th>
                            <th className="pb-2">SR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.batting.map((b: any) => (
                            <tr key={b.playerId} className="border-t">
                              <td className="py-2"><span className="text-blue-600">{b.playerName}</span></td>
                              <td className="py-2 text-gray-600">{b.dismissal}</td>
                              <td className="py-2 font-semibold">{b.runs}</td>
                              <td className="py-2">{b.balls}</td>
                              <td className="py-2">{b.fours}</td>
                              <td className="py-2">{b.sixes}</td>
                              <td className="py-2">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : '0.00'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-2 text-sm">
                        <div><strong>Extras:</strong> {t.totals ? t.totals.extras : 0}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!loading && insights && (
              <div className="space-y-3 mt-2">
                <div className="text-sm text-gray-700">
                  {renderDescriptions(insights).map((l, i) => <p key={i}>{l}</p>)}
                </div>

                <div>
                  <h4 className="font-medium">Player Insights</h4>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(insights.battingRows || insights.topScorers).map(p => (
                      <div key={p.playerId} className="p-2 bg-white rounded shadow-sm">
                        <div className="font-medium">{p.playerName}</div>
                        <div className="text-xs text-gray-600">Position: {p.battingPosition ?? 'N/A'}</div>
                        <div className="text-xs">Runs: {p.runs} • Fours: {p.fours} • Sixes: {p.sixes}</div>
                        <div className="text-xs text-gray-600">Balls: {p.balls}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium">Event Timeline</h4>
                  <div className="mt-2 space-y-2 max-h-72 overflow-y-auto text-sm text-gray-700">
                    {(insights.balls || []).slice().reverse().map(b => (
                      <div key={b.ballId} className="p-2 bg-white rounded shadow-sm">
                        <div className="font-medium">Over {b.overNumber}.{b.ballNumber} — {b.batsmanName || 'Batsman'} vs {b.bowlerName || 'Bowler'}</div>
                        <div className="text-xs text-gray-600">{b.event ? b.event : `${b.runs} runs`}{b.extras && b.extras !== '0' ? ` • extras: ${b.extras}` : ''}{b.isWicket ? ' • WICKET' : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="font-medium">Player Descriptions</h4>
                  <div className="mt-2 space-y-2 max-h-72 overflow-y-auto text-sm text-gray-700">
                    {playerDescriptions.length === 0 && <p className="text-sm text-gray-600">No player descriptions yet. Click "Player Descriptions" button to add.</p>}
                    {playerDescriptions.map(d => (
                      <div key={d.id} className="p-2 bg-white rounded shadow-sm">
                        <div className="flex justify-between">
                          <div className="font-medium">{d.player_name ?? `Player ${d.player_id}`}</div>
                          <div className="text-xs text-gray-500">{d.updated_at ? new Date(d.updated_at).toLocaleString() : ''}{d.author ? ` • ${d.author}` : ''}</div>
                        </div>
                        <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{d.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!loading && !insights && <p className="text-sm text-red-600">Failed to load insights.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
