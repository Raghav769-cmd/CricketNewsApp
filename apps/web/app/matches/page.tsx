"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Match {
  id: number;
  team1: number;
  team2: number;
  team1_name?: string;
  team2_name?: string;
  team1_id?: number;
  team2_id?: number;
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

interface Team {
  id: number;
  name: string;
}

export default function Matches() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [matchScores, setMatchScores] = useState<Record<number, MatchScore>>(
    {}
  );
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
  const [insightsMap, setInsightsMap] = useState<
    Record<number, Insights | null>
  >({});
  const expandedRef = useRef<number | null>(null);
  const socketRef = useRef<any>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showAddMatchForm, setShowAddMatchForm] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    team1: "",
    team2: "",
    date: "",
    venue: "",
    score: "",
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const fetchInsights = async (matchId: number) => {
    try {
      const [insRes, ballsRes] = await Promise.all([
        fetch(`${apiBase}/api/matches/${matchId}/insights`),
        fetch(`${apiBase}/api/matches/${matchId}/balls`),
      ]);

      if (!insRes.ok)
        throw new Error(`Failed to fetch insights: ${insRes.status}`);
      if (!ballsRes.ok)
        throw new Error(`Failed to fetch balls: ${ballsRes.status}`);

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

  // Helper to format overs string - handles cases like "0.6" -> "1.0", "1.6" -> "2.0"
  const formatOvers = (oversStr?: string | null) => {
    if (!oversStr) return "0.0";
    const parts = String(oversStr).split(".");
    const completedOvers = Number(parts[0] || 0);
    const ballsInOver = Number(parts[1] || 0);

    if (ballsInOver >= 6) {
      // Roll over to next over
      const extraOvers = Math.floor(ballsInOver / 6);
      const remainingBalls = ballsInOver % 6;
      return `${completedOvers + extraOvers}.${remainingBalls}`;
    }
    return `${completedOvers}.${ballsInOver}`;
  };

  // Helper to format over/ball from 1-based DB values to 0-based display
  const formatOverBall = (
    overNumber?: number | null,
    ballNumber?: number | null
  ) => {
    if (overNumber == null || ballNumber == null) return "0.0";
    const o = Number(overNumber);
    const b = Number(ballNumber);
    if (Number.isNaN(o) || Number.isNaN(b)) return "0.0";

    // Convert from 1-based to 0-based display
    const displayOver = Math.max(0, o - 1);
    const displayBall = Math.max(0, b - 1);

    // Handle ball rollover (if ball is 6, it means over completed)
    if (displayBall >= 6) {
      return `${displayOver + 1}.${displayBall % 6}`;
    }
    return `${displayOver}.${displayBall}`;
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch(`${apiBase}/api/teams`);
      if (response.ok) {
        const data: Team[] = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.team1 ||
      !formData.team2 ||
      !formData.date ||
      !formData.venue
    ) {
      alert("Please fill in all required fields");
      return;
    }

    if (formData.team1 === formData.team2) {
      alert("Team 1 and Team 2 must be different");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/matches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          team1: parseInt(formData.team1),
          team2: parseInt(formData.team2),
          date: formData.date,
          venue: formData.venue,
          score: formData.score || "0-0",
        }),
      });

      if (response.ok) {
        const newMatch = await response.json();
        const team1 = teams.find((t) => t.id === newMatch.team1);
        const team2 = teams.find((t) => t.id === newMatch.team2);

        const newMatchWithNames = {
          ...newMatch,
          team1_name: team1?.name || newMatch.team1,
          team2_name: team2?.name || newMatch.team2,
        };

        setMatches((prev) => [newMatchWithNames, ...prev]);

        setFormData({ team1: "", team2: "", date: "", venue: "", score: "" });
        setShowAddMatchForm(false);
        alert("Match added successfully!");
      } else {
        alert("Failed to add match");
      }
    } catch (error) {
      console.error("Error adding match:", error);
      alert("Error adding match");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    let fetchedMatches: Match[] = [];

    const run = async () => {
      try {
        // Fetch matches
        const response = await fetch(`${apiBase}/api/matches`);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        fetchedMatches = await response.json();
        setMatches(fetchedMatches);

        // Fetch scores for each match
        for (const match of fetchedMatches) {
          try {
            const scoreRes = await fetch(
              `${apiBase}/api/matches/${match.id}/score`
            );
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
                  ? {
                      ...match,
                      liveScore:
                        data.liveScore || data.score || JSON.stringify(data),
                    }
                  : match
              )
            );

            // Refetch score for this match
            try {
              const scoreRes = await fetch(
                `${apiBase}/api/matches/${matchIdNum}/score`
              );
              if (scoreRes.ok) {
                const scoreData: MatchScore = await scoreRes.json();
                setMatchScores((prev) => ({
                  ...prev,
                  [matchIdNum]: scoreData,
                }));
              }
            } catch (err) {
              console.error(
                `Error refetching score for match ${matchIdNum}:`,
                err
              );
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
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Live Matches
            </h1>
            <p className="text-gray-600">
              Follow your favorite cricket matches with live updates
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddMatchForm(true);
              setFormData({
                team1: "",
                team2: "",
                date: "",
                venue: "",
                score: "",
              });
            }}
            className="bg-linear-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center space-x-2 shadow-lg"
          >
            <span className="text-xl">+</span>
            <span>Add Match</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent" />
          </div>
        ) : matches.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="bg-white rounded-xl shadow-md p-12 text-center max-w-xl w-full">
              <div className="text-6xl mb-4">🏏</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                No matches available
              </h2>
              <p className="text-gray-600 mb-6">
                There are currently no scheduled matches. Create a new match to
                start live scoring.
              </p>
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setShowAddMatchForm(true);
                    setFormData({
                      team1: "",
                      team2: "",
                      date: "",
                      venue: "",
                      score: "",
                    });
                  }}
                  className="px-6 py-3 bg-linear-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white rounded-lg font-semibold shadow-lg"
                >
                  Add Match
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200"
              >
                {/* Match Header */}
                <div className="bg-linear-to-r from-teal-50 to-teal-100 px-6 py-4 border-b border-teal-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full flex items-center">
                        <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                        {match.status}
                      </span>
                      <span className="text-sm text-gray-600">
                        {match.venue}
                      </span>
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
                        <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                          {(match.team1_name || String(match.team1))
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">
                          {match.team1_name || match.team1}
                        </h3>
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
                      <span className="px-4 text-sm font-semibold text-gray-400">
                        VS
                      </span>
                      <div className="flex-1 border-t border-gray-300" />
                    </div>

                    {/* Team 2 */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-linear-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold">
                          {(match.team2_name || String(match.team2))
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">
                          {match.team2_name || match.team2}
                        </h3>
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

                  {match.liveScore &&
                    !matchScores[match.id]?.scores?.length && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-700 font-medium">
                          {match.liveScore}
                        </p>
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
                    {expandedMatchId === match.id
                      ? "Hide Insights"
                      : "View Insights"}
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
                    <div className="bg-linear-to-r from-slate-50 to-slate-100 rounded-lg p-6 border border-slate-200">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <span className="text-2xl mr-2">📊</span>
                        Match Insights
                      </h3>

                      {!insightsMap[match.id] && (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent" />
                        </div>
                      )}

                      {insightsMap[match.id] &&
                        insightsMap[match.id] !== null && (
                          <div className="space-y-4">
                            {/* Description */}
                            <div className="bg-white rounded-lg p-4 space-y-2">
                              {renderDescriptions(insightsMap[match.id]).map(
                                (line, idx) => (
                                  <p
                                    key={idx}
                                    className="text-sm text-gray-700 leading-relaxed"
                                  >
                                    • {line}
                                  </p>
                                )
                              )}
                            </div>

                            {/* Top Scorers */}
                            {insightsMap[match.id]!.topScorers.length > 0 && (
                              <div className="bg-white rounded-lg p-4">
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                                  <span className="text-lg mr-2">🏆</span>
                                  Top Performers
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {insightsMap[match.id]!.topScorers.slice(
                                    0,
                                    4
                                  ).map((p) => (
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
                                              Over{" "}
                                              {formatOverBall(
                                                b.overNumber,
                                                b.ballNumber
                                              )}
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

      {/* Add Match Modal */}
      {showAddMatchForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Add New Match
              </h2>
              <button
                onClick={() => setShowAddMatchForm(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddMatch} className="space-y-5">
              {/* Team 1 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Team 1 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.team1}
                  onChange={(e) =>
                    setFormData({ ...formData, team1: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Team 1</option>

                  {teams
                    .filter((team) => String(team.id) !== formData.team2)
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Team 2 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Team 2 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.team2}
                  onChange={(e) =>
                    setFormData({ ...formData, team2: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Team 2</option>

                  {teams
                    .filter((team) => String(team.id) !== formData.team1)
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Venue */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Venue <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={(e) =>
                    setFormData({ ...formData, venue: e.target.value })
                  }
                  placeholder="e.g., Lord's Cricket Ground"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Score (Optional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Initial Score{" "}
                  <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.score}
                  onChange={(e) =>
                    setFormData({ ...formData, score: e.target.value })
                  }
                  placeholder="e.g., 0-0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMatchForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-linear-to-r from-teal-600 to-teal-700 text-white rounded-lg font-semibold hover:from-teal-700 hover:to-teal-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Creating..." : "Create Match"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
