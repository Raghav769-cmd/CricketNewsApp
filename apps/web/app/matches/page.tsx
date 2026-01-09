"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@repo/ui/toast";
import { useDialogStore } from "@/context/DialogStore";
import { AddMatchForm } from "@/app/components/AddMatchForm";

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

interface Stadium {
  id: number;
  name: string;
  city?: string;
  country?: string;
  capacity?: number;
}

export default function Matches() {
  const router = useRouter();
  const { user, isAuthenticated, token, loading: authLoading } = useAuth();
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
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [showAddMatchForm, setShowAddMatchForm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deletingMatchId, setDeletingMatchId] = useState<number | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // No login required to view matches and insights
  // Just wait for auth state to load
  useEffect(() => {
    // Auth loading complete, can proceed
  }, [authLoading]);

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

    // Handle ball rollover 
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

  const fetchStadiums = async () => {
    try {
      const response = await fetch(`${apiBase}/api/stadiums`);
      if (response.ok) {
        const data: Stadium[] = await response.json();
        setStadiums(data);
      }
    } catch (error) {
      console.error("Error fetching stadiums:", error);
    }
  };

  const getTeamScore = (matchId: number, teamId: number) => {
    const ms = matchScores[matchId];
    if (!ms || !ms.scores) return undefined;
    return ms.scores.find((s) => Number(s.teamId) === Number(teamId));
  };

  const handleAddMatch = async (formData: {
    team1: string;
    team2: string;
    date: string;
    stadium: string;
    score?: string;
    overs_per_inning?: string;
  }) => {
    setSubmitting(true);
    try {
      // Get stadium name from selected stadium ID
      const selectedStadium = stadiums.find(
        (s) => s.id === parseInt(formData.stadium)
      );
      const venueName = selectedStadium?.name || "Unknown Stadium";

      const response = await fetch(`${apiBase}/api/matches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          team1: parseInt(formData.team1),
          team2: parseInt(formData.team2),
          date: formData.date,
          venue: venueName,
          stadium_id: parseInt(formData.stadium),
          score: formData.score || "0-0",
          overs_per_inning: parseInt(formData.overs_per_inning || '20'),
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
        setShowAddMatchForm(false);
        toast.success("Match added successfully!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to add match");
      }
    } catch (error) {
      console.error("Error adding match:", error);
      toast.error("Error adding match");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMatch = async (matchId: number) => {
    const openDialog = useDialogStore.getState().openDialog;
    const closeDialog = useDialogStore.getState().closeDialog;
    const setLoading = useDialogStore.getState().setLoading;

    openDialog({
      title: "Delete Match",
      message: "Are you sure you want to delete this match? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      isDangerous: true,
      onConfirm: async () => {
        setLoading(true);
        try {
          const response = await fetch(`${apiBase}/api/matches/${matchId}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
          });

          if (response.ok) {
            setMatches((prev) => prev.filter((match) => match.id !== matchId));
            toast.success("Match deleted successfully!");
            closeDialog();
          } else {
            const error = await response.json();
            toast.error(error.error || "Failed to delete match");
          }
        } catch (error) {
          console.error("Error deleting match:", error);
          toast.error("Error deleting match");
        } finally {
          setLoading(false);
          setDeletingMatchId(null);
        }
      },
    });
  };

  useEffect(() => {
    fetchTeams();
    fetchStadiums();
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
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start gap-4 sm:items-start">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-900 border border-lime-500 mb-3">
              <span className="w-2 h-2 bg-lime-500 rounded-full mr-2 animate-pulse" />
              <span className="text-xs sm:text-sm font-medium text-lime-400">Live Matches</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
              Match Center
            </h1>
            <p className="text-xs sm:text-sm text-gray-400">
              Follow your favorite cricket matches with real-time updates
            </p>
          </div>
          {user?.role === 'superadmin' && (
            <button
              onClick={() => {
                setShowAddMatchForm(true);
              }}
              className="w-full sm:w-auto bg-linear-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-black px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center sm:justify-start space-x-2 shadow-lg hover:shadow-xl text-xs sm:text-sm"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Match</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-lime-500 border-t-transparent" />
          </div>
        ) : matches.length === 0 ? (
          <div className="flex items-center justify-center py-12 sm:py-20 px-3 sm:px-0">
            <div className="bg-slate-900 rounded-lg sm:rounded-xl border border-slate-800 shadow-sm p-6 sm:p-12 text-center max-w-xl w-full">
              <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-linear-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 sm:w-10 sm:h-10 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-white mb-2">
                No matches available
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 mb-4 sm:mb-6">
                There are currently no scheduled matches. Create a new match to start live scoring.
              </p>
              {user?.role === 'superadmin' && (
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      setShowAddMatchForm(true);
                    }}
                    className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-linear-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-black rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 text-xs sm:text-sm"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Match</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-slate-900 rounded-lg sm:rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-slate-800"
              >
                {/* Match Header */}
                <div className="bg-linear-to-r from-slate-800/50 to-slate-700/50 px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-lime-500 text-black text-xs font-semibold rounded-full flex items-center shrink-0">
                        <span className="w-2 h-2 bg-black rounded-full mr-1.5 animate-pulse" />
                        {match.status}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-300 font-medium truncate">
                        {match.venue}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-400 shrink-0">
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
                  className="px-3 sm:px-6 py-4 sm:py-6 cursor-pointer"
                  onClick={() => router.push(`/matches/${match.id}`)}
                >
                  <div className="space-y-3 sm:space-y-4">
                    {/* Team 1 */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
                      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-linear-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold shadow-md text-xs sm:text-sm shrink-0">
                          {(match.team1_name || String(match.team1))
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <h3 className="text-base sm:text-xl font-bold text-white truncate">
                          {match.team1_name || match.team1}
                        </h3>
                      </div>
                      {getTeamScore(match.id, match.team1) && (
                        <div className="text-right shrink-0">
                          <div className="text-2xl sm:text-3xl font-bold text-white">
                            {getTeamScore(match.id, match.team1)?.runs}/
                            {getTeamScore(match.id, match.team1)?.wickets}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400">
                            ({getTeamScore(match.id, match.team1)?.overs} ov)
                          </div>
                        </div>
                      )}
                    </div>

                    {/* VS Divider */}
                    <div className="flex items-center">
                      <div className="flex-1 border-t border-slate-700" />
                      <span className="px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-400">
                        VS
                      </span>
                      <div className="flex-1 border-t border-slate-700" />
                    </div>

                    {/* Team 2 */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
                      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-linear-to-br from-orange-500 to-orange-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold shadow-md text-xs sm:text-sm shrink-0">
                          {(match.team2_name || String(match.team2))
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <h3 className="text-base sm:text-xl font-bold text-white truncate">
                          {match.team2_name || match.team2}
                        </h3>
                      </div>
                      {getTeamScore(match.id, match.team2) && (
                        <div className="text-right shrink-0">
                          <div className="text-2xl sm:text-3xl font-bold text-white">
                            {getTeamScore(match.id, match.team2)?.runs}/
                            {getTeamScore(match.id, match.team2)?.wickets}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400">
                            ({getTeamScore(match.id, match.team2)?.overs} ov)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {match.liveScore &&
                    !matchScores[match.id]?.scores?.length && (
                      <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-green-500/20 border border-green-500 rounded-lg">
                        <p className="text-xs sm:text-sm text-green-400 font-medium">
                          {match.liveScore}
                        </p>
                      </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="px-3 sm:px-6 pb-3 sm:pb-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleInsights(match.id);
                    }}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-linear-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-black font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center space-x-2 text-xs sm:text-sm"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="truncate">{expandedMatchId === match.id ? "Hide Insights" : "View Insights"}</span>
                  </button>
                  <button
                    onClick={() => router.push(`/matches/${match.id}`)}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-lime-500 text-lime-400 hover:bg-lime-500/10 font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 text-xs sm:text-sm"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate">Full Scorecard</span>
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => router.push(`/ball-entry`)}
                      className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center space-x-2 text-xs sm:text-sm"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="truncate">Live Entry</span>
                    </button>
                  )}
                  {user?.role === 'superadmin' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMatch(match.id);
                      }}
                      disabled={deletingMatchId === match.id}
                      className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-red-500 text-red-400 hover:bg-red-500/10 font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="truncate">{deletingMatchId === match.id ? "Deleting..." : "Delete"}</span>
                    </button>
                  )}
                </div>

                {/* Insights Panel */}
                {expandedMatchId === match.id && (
                  <div className="px-3 sm:px-6 pb-4 sm:pb-6">
                    <div className="bg-linear-to-br from-slate-800/50 to-slate-700/50 rounded-lg p-3 sm:p-6 border border-slate-700">
                      <h3 className="text-base sm:text-lg font-bold text-lime-400 mb-3 sm:mb-4 flex items-center">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Match Insights</span>
                      </h3>

                      {!insightsMap[match.id] && (
                        <div className="flex items-center justify-center py-6 sm:py-8">
                          <div className="animate-spin rounded-full h-7 w-7 sm:h-8 sm:w-8 border-4 border-lime-500 border-t-transparent" />
                        </div>
                      )}

                      {insightsMap[match.id] &&
                        insightsMap[match.id] !== null && (
                          <div className="space-y-3 sm:space-y-4">
                            {/* Description */}
                            <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 space-y-2 border border-slate-700">
                              {renderDescriptions(insightsMap[match.id]).map(
                                (line, idx) => (
                                  <p
                                    key={idx}
                                    className="text-xs sm:text-sm text-gray-300 leading-relaxed"
                                  >
                                    • {line}
                                  </p>
                                )
                              )}
                            </div>

                            {/* Top Scorers */}
                            {insightsMap[match.id]!.topScorers.length > 0 && (
                              <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
                                <h4 className="font-semibold text-xs sm:text-sm text-lime-400 mb-2 sm:mb-3 flex items-center">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                  </svg>
                                  <span>Top Performers</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                  {insightsMap[match.id]!.topScorers.slice(
                                    0,
                                    4
                                  ).map((p) => (
                                    <div
                                      key={p.playerId}
                                      className="flex justify-between items-start sm:items-center p-2 sm:p-3 bg-slate-700/30 rounded-lg border border-slate-600 gap-2"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-xs sm:text-sm text-white truncate">
                                          {p.playerName}
                                        </div>
                                        <div className="text-xs text-gray-400 truncate">
                                          Pos: {p.battingPosition ?? "N/A"}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="text-lg sm:text-xl font-bold text-lime-400">
                                          {p.runs}
                                        </div>
                                        <div className="text-xs text-gray-400">
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
                                <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700">
                                  <h4 className="font-semibold text-xs sm:text-sm text-lime-400 mb-2 sm:mb-3 flex items-center">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span>Recent Deliveries</span>
                                  </h4>
                                  <div className="space-y-1 sm:space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
                                    {(insightsMap[match.id]!.balls || [])
                                      .slice()
                                      .reverse()
                                      .slice(0, 10)
                                      .map((b) => (
                                        <div
                                          key={b.ballId}
                                          className="flex justify-between items-start sm:items-center p-2 sm:p-2 bg-slate-700/30 rounded hover:bg-slate-700/50 transition-colors border border-slate-600 gap-2"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs sm:text-sm font-medium text-white truncate">
                                              {b.batsmanName || "Batsman"} vs{" "}
                                              {b.bowlerName || "Bowler"}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                              Over{" "}
                                              {formatOverBall(
                                                b.overNumber,
                                                b.ballNumber
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <span
                                              className={`inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-bold ${
                                                b.runs === 6
                                                  ? "bg-linear-to-r from-rose-500 to-pink-500 text-white"
                                                  : b.runs === 4
                                                    ? "bg-linear-to-r from-orange-500 to-amber-500 text-black"
                                                    : b.runs === 0
                                                      ? "bg-slate-600 text-gray-300"
                                                      : "bg-linear-to-r from-lime-400 to-lime-500 text-black"
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
                        <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 sm:p-4 text-center">
                          <p className="text-xs sm:text-sm text-red-400">
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
        <AddMatchForm
          teams={teams}
          stadiums={stadiums}
          onClose={() => setShowAddMatchForm(false)}
          onSubmit={handleAddMatch}
          isSubmitting={submitting}
        />
      )}
    </div>
  );
}
