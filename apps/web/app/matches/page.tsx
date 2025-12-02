"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

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
  const socketRef = useRef<any>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const fetchInsights = async (matchId: number) => {
    try {
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
      console.error("Error fetching insights for match", matchId, err);
      setInsightsMap((prev) => ({ ...prev, [matchId]: null }));
      return null;
    }
  };

  const renderDescriptions = (insights?: Insights | null) => {
    const lines: string[] = [];
    if (!insights) return lines;

    const top = insights.topScorers && insights.topScorers[0];
    if (top && (top.runs || 0) > 0) {
      lines.push(
        `${top.playerName} leads the scoring with ${top.runs} (${top.balls} balls) — ${top.fours}x4, ${top.sixes}x6.`
      );
    }

    const sixLeader = insights.topSixHitters && insights.topSixHitters[0];
    if (sixLeader && sixLeader.sixes > 0) {
      lines.push(
        `${sixLeader.playerName} has hit ${sixLeader.sixes} six${sixLeader.sixes > 1 ? "es" : ""} so far.`
      );
    }

    if (insights.lowOrder30Count && insights.lowOrder30Count > 0) {
      lines.push(
        `${insights.lowOrder30Count} player${
          insights.lowOrder30Count > 1 ? "s" : ""
        } from No.4 or lower have crossed 30.`
      );
    }

    lines.push(`Total sixes in match: ${insights.totalSixes}.`);

    if (insights.teamTotals && insights.teamTotals.length) {
      const teamSummaries = insights.teamTotals
        .map((t) => `Team ${t.teamId} ${t.runs}/${t.wickets}`)
        .join(" — ");
      lines.push(teamSummaries + ".");
    }

    return lines;
  };

  // Optional: helper to format over/ball from 1-based values
  const formatOverBall = (overNumber?: number | null, ballNumber?: number | null) => {
    if (overNumber == null || ballNumber == null) return "0.0";
    const o = Number(overNumber);
    const b = Number(ballNumber);
    if (Number.isNaN(o) || Number.isNaN(b)) return "0.0";

    const totalBalls = (o - 1) * 6 + (b - 1);
    const over = Math.max(0, Math.floor(totalBalls / 6));
    const ball = Math.max(0, totalBalls % 6);
    return `${over}.${ball}`;
  };

  useEffect(() => {
    let fetchedMatches: Match[] = [];

    const run = async () => {
      try {
        // Fetch matches
        const response = await fetch(`${apiBase}/api/matches`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        fetchedMatches = await response.json();
        setMatches(fetchedMatches);

        // Fetch scores for each match
        for (const match of fetchedMatches) {
          try {
            const scoreRes = await fetch(`${apiBase}/api/matches/${match.id}/score`);
            if (scoreRes.ok) {
              const scoreData: MatchScore = await scoreRes.json();
              setMatchScores((prev) => ({ ...prev, [match.id]: scoreData }));
            }
          } catch (err) {
            console.error(`Error fetching score for match ${match.id}:`, err);
          }
        }
      } catch (error) {
        console.error("Error fetching matches:", error);
      } finally {
        setLoading(false);
      }

      // Setup socket
      try {
        const { io } = require("socket.io-client");
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:5000";
        const socket = io(wsUrl, { transports: ["websocket"] });
        socketRef.current = socket;

        socket.on("connect", () => {
          console.log("socket.io connected", socket.id);
          fetchedMatches.forEach((m) => {
            socket.emit("joinMatch", String(m.id));
            console.log(`Requested joinMatch for ${m.id}`);
          });
        });

        socket.on("ballUpdate", async (data: any) => {
          console.log("Received ballUpdate:", data);
          if (data && data.matchId) {
            const matchIdNum = Number(data.matchId);

            setMatches((prev) =>
              prev.map((match) =>
                match.id === matchIdNum
                  ? { ...match, liveScore: data.liveScore || data.score || JSON.stringify(data) }
                  : match
              )
            );

            // Refetch score for this match
            try {
              const scoreRes = await fetch(`${apiBase}/api/matches/${matchIdNum}/score`);
              if (scoreRes.ok) {
                const scoreData: MatchScore = await scoreRes.json();
                setMatchScores((prev) => ({ ...prev, [matchIdNum]: scoreData }));
              }
            } catch (err) {
              console.error(`Error refetching score for match ${matchIdNum}:`, err);
            }

            // Refetch insights if this match is expanded
            try {
              if (expandedRef.current === matchIdNum) {
                await fetchInsights(matchIdNum);
              }
            } catch (err) {
              console.error("Error refetching insights after ballUpdate:", err);
            }
          }
        });

        socket.on("connect_error", (err: any) => {
          console.error("socket.io connect_error:", err);
        });
      } catch (err) {
        console.error("Failed to initialize socket.io-client:", err);
      }
    };

    run();

    // ✅ Proper cleanup for socket
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [apiBase]);

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
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Live Matches</h1>
          <p className="text-gray-600">Follow your favorite cricket matches with live updates</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent" />
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🏏</div>
            <p className="text-xl text-gray-600">No matches available</p>
          </div>
        ) : (
          <div className="space-y-6">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200"
              >
                {/* Match Header */}
                <div className="bg-gradient-to-r from-teal-50 to-teal-100 px-6 py-4 border-b border-teal-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full flex items-center">
                        <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                        {match.status}
                      </span>
                      <span className="text-sm text-gray-600">{match.venue}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(match.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Teams and Scores */}
                <div
                  className="px-6 py-6 cursor-pointer"
                  onClick={() => router.push(`/matches/${match.id}`)}
                >
                  <div className="space-y-4">
                    {/* Team 1 */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                          {match.team1.substring(0, 2).toUpperCase()}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">{match.team1}</h3>
                      </div>
                      {matchScores[match.id]?.scores?.[0] && (
                        <div className="text-right">
                          <div className="text-3xl font-bold text-gray-800">
                            {matchScores[match.id]?.scores?.[0]?.runs}/
                            {matchScores[match.id]?.scores?.[0]?.wickets}
                          </div>
                          <div className="text-sm text-gray-500">
                            ({matchScores[match.id]?.scores?.[0]?.overs} ov)
                          </div>
                        </div>
                      )}
                    </div>

                    {/* VS Divider */}
                    <div className="flex items-center">
                      <div className="flex-1 border-t border-gray-300" />
                      <span className="px-4 text-sm font-semibold text-gray-400">VS</span>
                      <div className="flex-1 border-t border-gray-300" />
                    </div>

                    {/* Team 2 */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold">
                          {match.team2.substring(0, 2).toUpperCase()}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">{match.team2}</h3>
                      </div>
                      {matchScores[match.id]?.scores?.[1] && (
                        <div className="text-right">
                          <div className="text-3xl font-bold text-gray-800">
                            {matchScores[match.id]?.scores?.[1]?.runs}/
                            {matchScores[match.id]?.scores?.[1]?.wickets}
                          </div>
                          <div className="text-sm text-gray-500">
                            ({matchScores[match.id]?.scores?.[1]?.overs} ov)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {match.liveScore && !matchScores[match.id]?.scores?.length && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 font-medium">{match.liveScore}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="px-6 pb-4 flex gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleInsights(match.id);
                    }}
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors duration-200"
                  >
                    {expandedMatchId === match.id ? "Hide Insights" : "View Insights"}
                  </button>
                  <button
                    onClick={() => router.push(`/matches/${match.id}`)}
                    className="flex-1 px-4 py-2 border-2 border-teal-600 text-teal-600 hover:bg-teal-50 font-medium rounded-lg transition-colors duration-200"
                  >
                    Full Scorecard
                  </button>
                </div>

                {/* Insights Panel */}
                {expandedMatchId === match.id && (
                  <div className="px-6 pb-6">
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-6 border border-slate-200">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <span className="text-2xl mr-2">📊</span>
                        Match Insights
                      </h3>

                      {!insightsMap[match.id] && (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent" />
                        </div>
                      )}

                      {insightsMap[match.id] && insightsMap[match.id] !== null && (
                        <div className="space-y-4">
                          {/* Description */}
                          <div className="bg-white rounded-lg p-4 space-y-2">
                            {renderDescriptions(insightsMap[match.id]).map((line, idx) => (
                              <p
                                key={idx}
                                className="text-sm text-gray-700 leading-relaxed"
                              >
                                • {line}
                              </p>
                            ))}
                          </div>

                          {/* Top Scorers */}
                          {insightsMap[match.id]!.topScorers.length > 0 && (
                            <div className="bg-white rounded-lg p-4">
                              <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                                <span className="text-lg mr-2">🏆</span>
                                Top Performers
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {insightsMap[match.id]!.topScorers
                                  .slice(0, 4)
                                  .map((p) => (
                                    <div
                                      key={p.playerId}
                                      className="flex justify-between items-center p-3 bg-slate-50 rounded-lg"
                                    >
                                      <div>
                                        <div className="font-medium text-gray-800">
                                          {p.playerName}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          Position: {p.battingPosition ?? "N/A"}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-lg font-bold text-teal-600">
                                          {p.runs}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {p.balls}b • {p.fours}×4 • {p.sixes}×6
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Recent Balls */}
                          {insightsMap[match.id]!.balls &&
                            insightsMap[match.id]!.balls!.length > 0 && (
                              <div className="bg-white rounded-lg p-4">
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                                  <span className="text-lg mr-2">⚡</span>
                                  Recent Deliveries
                                </h4>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {(insightsMap[match.id]!.balls || [])
                                    .slice()
                                    .reverse()
                                    .slice(0, 10)
                                    .map((b) => (
                                      <div
                                        key={b.ballId}
                                        className="flex justify-between items-center p-2 bg-slate-50 rounded hover:bg-slate-100 transition-colors"
                                      >
                                        <div className="flex-1">
                                          <div className="text-sm font-medium text-gray-800">
                                            {b.batsmanName || "Batsman"} vs{" "}
                                            {b.bowlerName || "Bowler"}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            Over {formatOverBall(b.overNumber, b.ballNumber)}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <span
                                            className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                              b.runs === 6
                                                ? "bg-purple-500 text-white"
                                                : b.runs === 4
                                                ? "bg-green-500 text-white"
                                                : b.runs === 0
                                                ? "bg-gray-300 text-gray-700"
                                                : "bg-blue-500 text-white"
                                            }`}
                                          >
                                            {b.event ||
                                              `${b.runs} run${
                                                b.runs !== 1 ? "s" : ""
                                              }`}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                        </div>
                      )}

                      {insightsMap[match.id] === null && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                          <p className="text-red-600">
                            Unable to load insights for this match
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
