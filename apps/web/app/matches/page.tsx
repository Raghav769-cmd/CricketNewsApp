"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Match {
  id: number;
  team1: string;
  team2: string;
  date: string;
  venue: string;
  status: string;
  liveScore?: string;
}

interface TeamScore {
  teamId: number;
  runs: number;
  wickets: number;
  overs: string;
}

interface MatchScore {
  matchId: number;
  team1: string | number;
  team2: string | number;
  scores: TeamScore[];
}

interface PlayerInsight {
  playerId: number;
  playerName: string;
  runs: number;
  fours: number;
  sixes: number;
  balls: number;
  battingPosition: number | null;
}

interface BallEvent {
  ballId: number;
  overNumber: number;
  ballNumber: number;
  runs: number;
  extras: string | number | null;
  event: string | null;
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

export default function Matches() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [matchScores, setMatchScores] = useState<Record<number, MatchScore>>({});

  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
  const [insightsMap, setInsightsMap] = useState<Record<number, Insights | null>>({});

  const expandedRef = useRef<number | null>(null);

  const fetchInsights = async (matchId: number) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const [insRes, ballsRes] = await Promise.all([
        fetch(`${apiBase}/api/matches/${matchId}/insights`),
        fetch(`${apiBase}/api/matches/${matchId}/balls`),
      ]);
      if (!insRes.ok) throw new Error(`Failed to fetch insights: ${insRes.status}`);
      if (!ballsRes.ok) throw new Error(`Failed to fetch balls: ${ballsRes.status}`);
      const data: Insights = await insRes.json();
      const balls: BallEvent[] = await ballsRes.json();
      const merged = { ...data, balls };
      setInsightsMap((prev) => ({ ...prev, [matchId]: merged }));
      return merged;
    } catch (err) {
      console.error('Error fetching insights for match', matchId, err);
      setInsightsMap((prev) => ({ ...prev, [matchId]: null }));
      return null;
    }
  };

  const renderDescriptions = (insights: Insights) => {
    const lines: string[] = [];
    if (!insights) return lines;

    // Top scorer — only show if they have scored at least 1 run
    const top = insights.topScorers && insights.topScorers[0];
    if (top && (top.runs || 0) > 0) {
      lines.push(`${top.playerName} leads the scoring with ${top.runs} (${top.balls} balls) — ${top.fours}x4, ${top.sixes}x6.`);
    }

    // Top six hitter
    const sixLeader = insights.topSixHitters && insights.topSixHitters[0];
    if (sixLeader && sixLeader.sixes > 0) {
      lines.push(`${sixLeader.playerName} has hit ${sixLeader.sixes} six${sixLeader.sixes > 1 ? 'es' : ''} so far.`);
    }

    // Low-order mention
    if (insights.lowOrder30Count && insights.lowOrder30Count > 0) {
      lines.push(`${insights.lowOrder30Count} player${insights.lowOrder30Count > 1 ? 's' : ''} from No.4 or lower have crossed 30.`);
    }

    // Total sixes
    lines.push(`Total sixes in match: ${insights.totalSixes}.`);

    // Per-team quick summary
    if (insights.teamTotals && insights.teamTotals.length) {
      const teamSummaries = insights.teamTotals.map((t) => `Team ${t.teamId} ${t.runs}/${t.wickets}`).join(' — ');
      lines.push(teamSummaries + '.');
    }

    return lines;
  };

  useEffect(() => {
    (async () => {
      // Fetch matches first
      let fetchedMatches: Match[] = [];
      try {
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + '/api/matches';
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        fetchedMatches = await response.json();
        setMatches(fetchedMatches);
        
        // Fetch scores for each match
        for (const match of fetchedMatches) {
          try {
            const scoreUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + `/api/matches/${match.id}/score`;
            const scoreRes = await fetch(scoreUrl);
            if (scoreRes.ok) {
              const scoreData: MatchScore = await scoreRes.json();
              setMatchScores((prev) => ({ ...prev, [match.id]: scoreData }));
            }
          } catch (err) {
            console.error(`Error fetching score for match ${match.id}:`, err);
          }
        }
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setLoading(false);
      }
      let socket: any = null;
      try {
        const { io } = require('socket.io-client');
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';
        socket = io(wsUrl, { transports: ['websocket'] });

        socket.on('connect', () => {
          console.log('socket.io connected', socket.id);
          // Join rooms for all fetched matches
          fetchedMatches.forEach((m) => {
            socket.emit('joinMatch', String(m.id));
            console.log(`Requested joinMatch for ${m.id}`);
          });
        });

        socket.on('ballUpdate', async (data: any) => {
          console.log('Received ballUpdate:', data);
          if (data && data.matchId) {
            const matchIdNum = Number(data.matchId);
            setMatches((prev) =>
              prev.map((match) =>
                match.id === matchIdNum ? { ...match, liveScore: data.liveScore || data.score || JSON.stringify(data) } : match
              )
            );
            
            // Refetch score for this match
            try {
              const scoreUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + `/api/matches/${matchIdNum}/score`;
              const scoreRes = await fetch(scoreUrl);
              if (scoreRes.ok) {
                const scoreData: MatchScore = await scoreRes.json();
                setMatchScores((prev) => ({ ...prev, [matchIdNum]: scoreData }));
              }
            } catch (err) {
              console.error(`Error refetching score for match ${matchIdNum}:`, err);
            }
            try {
              if (expandedRef.current === matchIdNum) {
                await fetchInsights(matchIdNum);
              }
            } catch (err) {
              console.error('Error refetching insights after ballUpdate:', err);
            }
          }
        });

        socket.on('connect_error', (err: any) => {
          console.error('socket.io connect_error:', err);
        });
      } catch (err) {
        console.error('Failed to initialize socket.io-client:', err);
      }

      return () => {
        if (socket) socket.disconnect();
      };
    })();
  }, []);

  const toggleInsights = async (matchId: number) => {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
      expandedRef.current = null;
      return;
    }
    setExpandedMatchId(matchId);
    expandedRef.current = matchId;

    if (insightsMap[matchId]) return;

    await fetchInsights(matchId);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Matches</h1>
      {loading ? (
        <p className="text-lg text-gray-600">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match) => (
            <div
              key={match.id}
              className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
              onClick={() => router.push(`/matches/${match.id}`)}
            >
              <h2 className="text-xl font-semibold text-blue-600 mb-2">
                {match.team1} vs {match.team2}
              </h2>
              <p className="text-gray-700">
                <strong>Date:</strong> {new Date(match.date).toLocaleString()}
              </p>
              <p className="text-gray-700">
                <strong>Venue:</strong> {match.venue}
              </p>
              <p className="text-gray-700">
                <strong>Status:</strong> {match.status}
              </p>
              
              {matchScores[match.id]?.scores && matchScores[match.id]!.scores.length > 0 && (
                <div className="mt-3 p-2 bg-green-50 rounded">
                  <p className="text-sm font-semibold text-gray-800 mb-1">Live Score:</p>
                  {matchScores[match.id]!.scores.map((score) => (
                    <div key={score.teamId} className="text-green-700 font-bold">
                      Team {score.teamId}: {score.runs}/{score.wickets} ({score.overs})
                    </div>
                  ))}
                </div>
              )}
              
              {match.liveScore && !matchScores[match.id]?.scores.length && (
                <p className="text-green-600 font-bold mt-2">
                  {match.liveScore}
                </p>
              )}
              {/* Insights panel */}
              {expandedMatchId === match.id && (
                <div className="mt-4 p-3 bg-blue-50 rounded">
                  <h3 className="text-lg font-semibold text-blue-700 mb-2">Match Insights</h3>
                  {!insightsMap[match.id] && <p className="text-sm text-gray-600">Loading insights...</p>}
                  {insightsMap[match.id] && insightsMap[match.id] !== null && (
                    <div className="space-y-3">
                      {/* Narrative descriptions like Cricbuzz */}
                      <div className="text-sm text-gray-700">
                        {renderDescriptions(insightsMap[match.id]!).map((line, idx) => (
                          <p key={idx} className="mb-1">{line}</p>
                        ))}
                      </div>
                      <div className="text-sm text-gray-800">
                        <strong>Total Sixes:</strong> {insightsMap[match.id]!.totalSixes}
                      </div>
                      <div className="text-sm text-gray-800">
                        <strong>Low-order 30+ (No.4+):</strong> {insightsMap[match.id]!.lowOrder30Count}
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mt-2">Team Totals</h4>
                        <div className="flex gap-4 mt-1">
                          {insightsMap[match.id]!.teamTotals.map((t) => (
                            <div key={t.teamId} className="text-sm bg-white p-2 rounded shadow-sm">
                              <div className="font-medium">Team {t.teamId}</div>
                              <div>{t.runs}/{t.wickets}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mt-2">Player Insights</h4>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {(insightsMap[match.id]!.battingRows || insightsMap[match.id]!.topScorers).map((p) => (
                            <div key={p.playerId} className="p-2 bg-white rounded shadow-sm">
                              <div className="text-sm font-medium">{p.playerName}</div>
                              <div className="text-xs text-gray-600">Position: {p.battingPosition ?? 'N/A'}</div>
                              <div className="text-xs">Runs: {p.runs} &nbsp; Fours: {p.fours} &nbsp; Sixes: {p.sixes}</div>
                              <div className="text-xs text-gray-600">Balls: {p.balls}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mt-2">Event Timeline</h4>
                        <div className="mt-2 max-h-40 overflow-y-auto text-sm text-gray-700">
                          {(insightsMap[match.id]!.balls || []).slice().reverse().map((b) => (
                            <div key={b.ballId} className="mb-2 p-2 bg-white rounded shadow-sm">
                              <div className="font-medium">Over {b.overNumber}.{b.ballNumber} — {b.batsmanName || 'Batsman'} vs {b.bowlerName || 'Bowler'}</div>
                              <div className="text-xs text-gray-600">{b.event ? b.event : `${b.runs} runs`}{b.extras && b.extras !== '0' ? ` • extras: ${b.extras}` : ''}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {insightsMap[match.id] === null && (
                    <p className="text-sm text-red-600">Failed to load insights for this match.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}