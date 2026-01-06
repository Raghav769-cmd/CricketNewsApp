"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/app/components/FormComponents";
import { useRef } from "react";

interface Player {
  id: number;
  name: string;
  team_id: number;
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

const ballEntrySchema = z.object({
  selectedMatch: z.number().min(1, "Match is required"),
  battingTeamId: z.number().min(1, "Batting team is required"),
  overNumber: z
    .number()
    .min(0, "Over number must be 0 or more")
    .max(50, "Over number must be 50 or less"),
  ballNumber: z
    .number()
    .min(0, "Ball must be 0 or more")
    .max(5, "Ball must be 5 or less"),
  runs: z
    .number()
    .min(0, "Runs must be 0 or more")
    .max(6, "Runs cannot exceed 6"),
  extras: z.string(),
  extraType: z.string(),
  wicket: z.boolean(),
  strikerId: z.number(),
  nonStrikerId: z.number(),
  bowlerId: z.number().min(1, "Bowler is required"),
  eventText: z.string(),
});

type BallEntryFormData = z.infer<typeof ballEntrySchema>;

interface Match {
  id: number;
  team1: number | string;
  team2: number | string;
  team1_name?: string;
  team2_name?: string;
  status: string;
  team1_id: number;
  team2_id: number;
  overs_per_inning?: number;
  current_inning?: number;
  inning1_team_id?: number;
  inning1_complete?: boolean;
  match_status?: string;
  winner?: number;
  result_description?: string;
}

interface BallEntryProps {
  initialMatches: Match[];
  initialPlayers: Player[];
  initialTeams: Team[];
  initialStadiums: Stadium[];
}

export default function BallEntry({
  initialMatches,
  initialPlayers,
  initialTeams,
  initialStadiums,
}: BallEntryProps) {
  const router = useRouter();
  const { user, isAuthenticated, token, loading: authLoading } = useAuth();

  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [matchesLoaded, setMatchesLoaded] = useState<boolean>(true);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [stadiums, setStadiums] = useState<Stadium[]>(initialStadiums);
  const [message, setMessage] = useState<string>("");
  const [selectedMatchDetails, setSelectedMatchDetails] = useState<Match | null>(null);
  const [inningComplete, setInningComplete] = useState<boolean>(false);
  const [showInningTransition, setShowInningTransition] = useState<boolean>(false);
  const [transitionTimer, setTransitionTimer] = useState<number>(3);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const inningCompletedRef = useRef(false);
  const inning2CompletedRef = useRef(false);
  const prevMatchRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BallEntryFormData>({
    shouldUnregister: false,
    resolver: zodResolver(ballEntrySchema),
    defaultValues: {
      selectedMatch: 0,
      battingTeamId: 0,
      overNumber: 0,
      ballNumber: 0,
      runs: 0,
      extras: "0",
      extraType: "none",
      wicket: false,
      strikerId: 0,
      nonStrikerId: 0,
      bowlerId: 0,
      eventText: "",
    },
  });

  const selectedMatch = watch("selectedMatch");
  const battingTeamId = watch("battingTeamId");
  const strikerId = watch("strikerId");
  const nonStrikerId = watch("nonStrikerId");
  const bowlerId = watch("bowlerId");
  const overNumber = watch("overNumber");
  const ballNumber = watch("ballNumber");
  const runs = watch("runs");
  const extraType = watch("extraType");
  const wicket = watch("wicket");
  const eventText = watch("eventText");

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  /**
   * Polling Helper Functions
   * Fetches updated match data every 3 seconds when inning 1 is complete
   */

  /**
   * Fetch a single match to get updated status (used for polling)
   */
  const fetchSingleMatch = async (matchId: number): Promise<Match | null> => {
    try {
      const response = await fetch(`${apiBase}/api/matches/${matchId}`);
      if (!response.ok) {
        console.error("Failed to fetch match during polling");
        return null;
      }

      const m = await response.json();
      const normalized: Match = {
        ...m,
        id: Number(m.id),
        team1: m.team1,
        team2: m.team2,
        team1_name: m.team1_name,
        team2_name: m.team2_name,
        team1_id: Number(m.team1_id),
        team2_id: Number(m.team2_id),
        overs_per_inning: Number(m.overs_per_inning),
        current_inning: Number(m.current_inning),
        inning1_team_id: m.inning1_team_id
          ? Number(m.inning1_team_id)
          : undefined,
        inning1_complete: Boolean(m.inning1_complete),
        match_status: m.match_status,
        winner: m.winner,
        result_description: m.result_description,
      };

      return normalized;
    } catch (error) {
      console.error("Error fetching match during polling:", error);
      return null;
    }
  };

  /**
   * Start polling: automatically fetch updated match data every 3 seconds
   * This activates after inning 1 is complete to track real-time changes for inning 2
   */
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      console.warn("Polling already started");
      return;
    }

    setIsPolling(true);
    console.log("🔄 Starting polling for match updates...");

    pollingIntervalRef.current = setInterval(async () => {
      if (!selectedMatch) return;

      const updatedMatch = await fetchSingleMatch(selectedMatch);
      if (updatedMatch) {
        // Update the matches array with the new data
        setMatches((prev) =>
          prev.map((m) => (m.id === selectedMatch ? updatedMatch : m))
        );

        // Also update selectedMatchDetails if it's the current match
        if (selectedMatchDetails?.id === selectedMatch) {
          setSelectedMatchDetails(updatedMatch);
        }

        console.log("✅ Match data updated via polling");
      }
    }, 3000); // Poll every 3 seconds
  };

  /**
   * Stop polling: clear the interval to prevent unnecessary requests
   * Call this when user navigates away or inning 2 completes
   */
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsPolling(false);
      console.log("⏹️ Stopped polling");
    }
  };

  // Optional: Refresh data on manual trigger (for updates during session)
  const refreshData = async () => {
    try {
      const [matchesResp, playersResp, teamsResp] = await Promise.all([
        fetch(`${apiBase}/api/matches`),
        fetch(`${apiBase}/api/players`),
        fetch(`${apiBase}/api/teams`),
      ]);

      const matchesData = await matchesResp.json();
      const playersData = await playersResp.json();
      const teamsData = await teamsResp.json();

      const normalizedMatches: Match[] = matchesData.map((m: any) => ({
        ...m,
        id: Number(m.id),
        team1: m.team1,
        team2: m.team2,
        team1_name: m.team1_name,
        team2_name: m.team2_name,
        team1_id: Number(m.team1_id),
        team2_id: Number(m.team2_id),
        overs_per_inning: Number(m.overs_per_inning),
        current_inning: Number(m.current_inning),
        inning1_team_id: m.inning1_team_id
          ? Number(m.inning1_team_id)
          : undefined,
        inning1_complete: Boolean(m.inning1_complete),
        match_status: m.match_status,
        winner: m.winner,
        result_description: m.result_description,
      }));

      const normalizedPlayers: Player[] = playersData.map((p: any) => ({
        ...p,
        id: Number(p.id),
        team_id: Number(p.team_id),
      }));

      const normalizedTeams: Team[] = teamsData.map((t: any) => ({
        ...t,
        id: Number(t.id),
      }));

      setMatches(normalizedMatches);
      setPlayers(normalizedPlayers);
      setTeams(normalizedTeams);
    } catch (error) {
      console.error("Error refreshing data:", error);
    }
  };

  // Update match details when selected match changes
  useEffect(() => {
    const matchObj = matches.find((m) => m.id === selectedMatch) || null;
    setSelectedMatchDetails(matchObj);
  }, [matches, selectedMatch]);

  useEffect(() => {
    if (
      !selectedMatchDetails ||
      !selectedMatchDetails.overs_per_inning ||
      selectedMatchDetails.inning1_complete
    ) {
      return;
    }

    if (
      overNumber >= selectedMatchDetails.overs_per_inning &&
      battingTeamId > 0 &&
      !inningCompletedRef.current
    ) {
      inningCompletedRef.current = true;
      autoCompleteInning1();
    }
  }, [overNumber, battingTeamId, selectedMatchDetails]);

  // Auto-complete Inning 2 when overs reach limit
  useEffect(() => {
    if (
      !selectedMatchDetails ||
      !selectedMatchDetails.overs_per_inning ||
      selectedMatchDetails.current_inning !== 2 ||
      !selectedMatchDetails.inning1_complete
    ) {
      return;
    }

    if (
      overNumber >= selectedMatchDetails.overs_per_inning &&
      battingTeamId > 0 &&
      !inning2CompletedRef.current
    ) {
      inning2CompletedRef.current = true;
      completeMatch();
    }
  }, [overNumber, battingTeamId, selectedMatchDetails]);

  useEffect(() => {
    inningCompletedRef.current = false;
    inning2CompletedRef.current = false;
  }, [selectedMatch]);

  useEffect(() => {
    if (selectedMatch !== prevMatchRef.current) {
      setValue("battingTeamId", 0);
      setValue("strikerId", 0);
      setValue("nonStrikerId", 0);
      setValue("bowlerId", 0);
      prevMatchRef.current = selectedMatch;
    }
  }, [selectedMatch, setValue]);

  /**
   * Monitor inning1_complete and manage polling lifecycle
   * When inning 1 is complete, start polling for real-time inning 2 updates
   * This enables automatic data refresh every 3 seconds
   */
  useEffect(() => {
    if (!selectedMatchDetails) {
      stopPolling();
      return;
    }

    if (selectedMatchDetails.inning1_complete) {
      // Inning 1 is complete - start polling for inning 2 updates
      if (!isPolling && !pollingIntervalRef.current) {
        startPolling();
      }
    } else {
      // Inning 1 is not complete - stop polling if active
      if (isPolling) {
        stopPolling();
      }
    }

    // Cleanup: stop polling when component unmounts or match selection changes
    return () => {
      // Don't stop polling on dependency change, only on unmount
      // This is handled by the condition above
    };
  }, [selectedMatchDetails?.inning1_complete, selectedMatchDetails?.id, isPolling]);

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-black via-slate-900 to-black">
        <div className="text-center max-w-sm">
          {/* Animated cricket ball icon */}
          <div className="mb-8 flex justify-center">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 bg-gradient-to-r from-lime-500 to-lime-600 rounded-full animate-spin" 
                   style={{ animationDuration: '3s' }}></div>
              <div className="absolute inset-1 bg-gradient-to-br from-black via-slate-900 to-black rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-lime-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                </svg>
              </div>
            </div>
          </div>
          
          {/* Loading text with animation */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold bg-gradient-to-r from-lime-400 to-lime-500 bg-clip-text text-transparent">
              Loading Match Data
            </h3>
            <p className="text-gray-400 text-sm">
              Getting live scoring ready...
            </p>
            
            {/* Animated dots */}
            <div className="flex justify-center gap-2 pt-4">
              <div className="w-2 h-2 bg-lime-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-lime-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-lime-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const selectedMatchObj = matches.find((m) => m.id === selectedMatch);

  // Use selectedMatchDetails if available (after inning completion), otherwise use selectedMatchObj
  const currentMatch = selectedMatchDetails || selectedMatchObj;

  const matchTeamIds: number[] = currentMatch
    ? [currentMatch.team1_id, currentMatch.team2_id]
    : [];

  // Only players from these two teams
  const playersInMatch = players.filter((p) =>
    matchTeamIds.includes(p.team_id)
  );

  const autoCompleteInning1 = async () => {
    if (!selectedMatch || !battingTeamId) return;

    try {
      const response = await fetch(
        `${apiBase}/api/matches/${selectedMatch}/inning`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ battingTeamId }),
        }
      );

      if (response.ok) {
        const updatedMatch = await response.json();

        const normalizedMatch: Match = {
          ...updatedMatch,
          id: Number(updatedMatch.id),
          team1_id: Number(updatedMatch.team1_id),
          team2_id: Number(updatedMatch.team2_id),
          team1_name: updatedMatch.team1_name,
          team2_name: updatedMatch.team2_name,
          overs_per_inning: Number(updatedMatch.overs_per_inning),
          current_inning: Number(updatedMatch.current_inning),
          inning1_team_id: updatedMatch.inning1_team_id
            ? Number(updatedMatch.inning1_team_id)
            : undefined,
          inning1_complete: Boolean(updatedMatch.inning1_complete),
        };

        setMatches((prev) =>
          prev.map((m) => (m.id === selectedMatch ? normalizedMatch : m))
        );
        setSelectedMatchDetails(normalizedMatch);
        setValue("battingTeamId", 0);
        setValue("overNumber", 0);
        setValue("ballNumber", 0);

        // Show transition modal
        setShowInningTransition(true);
        setTransitionTimer(3);

        // Start countdown
        const countdown = setInterval(() => {
          setTransitionTimer((prev) => {
            if (prev <= 1) {
              clearInterval(countdown);
              setShowInningTransition(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        setMessage("✅ Inning 1 completed! Preparing Inning 2...");
      } else {
        setMessage("❌ Failed to complete inning");
      }
    } catch (error) {
      console.error("Error completing inning:", error);
      setMessage("❌ Error completing inning");
    }
  };

  const completeMatch = async () => {
    if (!selectedMatch) return;

    try {
      const response = await fetch(
        `${apiBase}/api/matches/${selectedMatch}/complete`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setMessage(`✅ Match Completed! ${result.result}`);
        
        // Update match details
        if (result.match) {
          const normalizedMatch: Match = {
            ...result.match,
            id: Number(result.match.id),
            team1_id: Number(result.match.team1_id),
            team2_id: Number(result.match.team2_id),
            team1_name: result.match.team1_name,
            team2_name: result.match.team2_name,
            overs_per_inning: Number(result.match.overs_per_inning),
            current_inning: Number(result.match.current_inning),
            inning1_complete: Boolean(result.match.inning1_complete),
            match_status: result.match.match_status,
            winner: result.match.winner,
            result_description: result.match.result_description,
          };

          setMatches((prev) =>
            prev.map((m) => (m.id === selectedMatch ? normalizedMatch : m))
          );
          setSelectedMatchDetails(normalizedMatch);
        }

        // Stop polling
        stopPolling();
      } else {
        setMessage("❌ Failed to complete match");
      }
    } catch (error) {
      console.error("Error completing match:", error);
      setMessage("❌ Error completing match");
    }
  };

  const onSubmit = async (data: BallEntryFormData) => {
    // Prevent form submission if match is completed
    if (selectedMatchDetails?.match_status === 'completed') {
      setMessage("❌ Match is already completed. Cannot add more balls.");
      return;
    }

    const needsBatsman = data.extraType === "none";
    if (needsBatsman && !data.strikerId) {
      setMessage("Please select a striker for regular deliveries");
      return;
    }

    setMessage("");

    try {
      const overToSend = data.overNumber + 1;
      const ballToSend = data.ballNumber + 1;

      const url = `${apiBase}/api/matches/${data.selectedMatch}/ball`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          overNumber: overToSend,
          ballNumber: ballToSend,
          runs: data.runs,
          extras: data.extras,
          extraType: data.extraType,
          wicket: data.wicket,
          is_wicket: data.wicket,
          event:
            data.eventText && data.eventText.trim().length > 0
              ? data.eventText.trim()
              : data.extraType !== "none"
                ? data.extraType
                : null,
          batsmanId: data.strikerId || null,
          nonStrikerId: data.nonStrikerId || null,
          bowlerId: data.bowlerId,
          battingTeamId: data.battingTeamId,
        }),
      });

      if (response.ok) {
        setMessage("✅ Ball added successfully!");
        const illegal = /^(wide|wd|no-?ball|nb)$/i.test(data.extraType);
        const ballToSend2 = data.ballNumber + 1;
        const isOddRun = data.runs === 1 || data.runs === 3 || data.runs === 5;

        if (!illegal) {
          if (ballToSend2 === 6) {
            if (data.runs !== 1) {
              const tmp = data.strikerId;
              setValue("strikerId", data.nonStrikerId);
              setValue("nonStrikerId", tmp);
            }
            setValue("overNumber", data.overNumber + 1);
            setValue("ballNumber", 0);
          } else {
            if (isOddRun) {
              const tmp = data.strikerId;
              setValue("strikerId", data.nonStrikerId);
              setValue("nonStrikerId", tmp);
            }
            setValue("ballNumber", data.ballNumber + 1);
          }
        }

        setValue("runs", 0);
        setValue("extras", "0");
        setValue("wicket", false);
        setValue("eventText", "");
        setValue("extraType", "none");
      } else {
        setMessage("❌ Failed to add ball");
      }
    } catch (error) {
      console.error("Error adding ball:", error);
      setMessage("❌ Error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Inning Transition Modal */}
      {showInningTransition && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-lime-500/50 shadow-2xl p-8 text-center max-w-md w-full">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lime-500/20 border-2 border-lime-500 mb-4">
                <svg className="w-8 h-8 text-lime-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Inning Transition</h2>
              <p className="text-gray-300 mb-4">Changing innings in...</p>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-lime-500 text-black font-bold text-2xl">
                {transitionTimer}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-lime-400 font-semibold">✅ Inning 1 Completed</p>
              <p className="text-gray-400 text-sm">Preparing for Inning 2...</p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-black border border-lime-200 mb-2 sm:mb-3">
              <svg
                className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-lime-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span className="text-xs sm:text-sm font-medium text-lime-500">
                Ball-by-Ball Entry
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-200 mb-2">
              Live Scoring
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              Enter ball-by-ball data for real-time match updates
            </p>
          </div>

          {message && (
            <div
              className={`mb-6 p-3 sm:p-4 rounded-lg shadow-sm border-2 text-sm sm:text-base ${
                message.includes("✅")
                  ? "bg-green-500/20 border-green-500 text-green-400"
                  : "bg-red-500/20 border-red-500 text-red-400"
              }`}
            >
              <p className="font-medium">{message}</p>
            </div>
          )}

          {matchesLoaded && matches.length === 0 && (
            <div className="flex items-center justify-center py-12 sm:py-20">
              <div className="bg-slate-900 rounded-lg sm:rounded-xl border border-slate-800 shadow-sm p-6 sm:p-10 text-center w-full max-w-xl">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-linear-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 text-lime-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white">
                  No matches available
                </h2>
                <p className="text-gray-400 mb-4 sm:mb-6 text-sm sm:text-base">
                  There are currently no scheduled matches. Create a new match
                  from the Matches page to start live scoring.
                </p>
                <div className="flex justify-center">
                  <a
                    href="/matches"
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-linear-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-black rounded-lg font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all"
                  >
                    Go to Matches
                  </a>
                </div>
              </div>
            </div>
          )}

          <div
            className={`${matchesLoaded && matches.length === 0 ? "hidden" : ""} grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6`}
          >
            {/* Main Form */}
            <div className="lg:col-span-2">
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm p-6 space-y-6"
              >
                {/* Match Completed Banner */}
                {selectedMatch > 0 && selectedMatchDetails?.match_status === 'completed' && (
                  <div className="bg-linear-to-r from-green-900/80 to-emerald-900/80 border-2 border-green-500 rounded-lg p-4 flex items-start gap-3">
                    <div className="shrink-0">
                      <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-green-300 font-bold">✅ Match Completed</h3>
                      <p className="text-green-200 text-sm mt-1">{selectedMatchDetails.result_description}</p>
                      <p className="text-green-200/70 text-xs mt-1">This match cannot accept new balls.</p>
                    </div>
                  </div>
                )}

                {/* Match and Team Selection */}
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    label="Match"
                    required
                    error={errors.selectedMatch?.message}
                  >
                    <select
                      {...register("selectedMatch", { valueAsNumber: true })}
                      className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 transition-all bg-slate-800 text-white ${
                        errors.selectedMatch
                          ? "border-red-500"
                          : "border-slate-700"
                      }`}
                    >
                      <option value={0}>Select Match</option>
                      {matches.map((match) => (
                        <option key={match.id} value={match.id}>
                          Match {match.id}: {match.team1_name || match.team1} vs{" "}
                          {match.team2_name || match.team2}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label="Batting Team"
                    required
                    error={errors.battingTeamId?.message}
                    helperText={
                      selectedMatchDetails?.inning1_complete
                        ? `✅ Inning 1 completed! Now select Inning 2 team.`
                        : ""
                    }
                  >
                    <div className="space-y-2">
                      <select
                        {...register("battingTeamId", { valueAsNumber: true })}
                        key={`${selectedMatch}-${selectedMatchDetails?.inning1_complete}`}
                        className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 transition-all bg-slate-800 text-white ${
                          errors.battingTeamId
                            ? "border-red-500"
                            : "border-slate-700"
                        }`}
                      >
                        <option value={0}>Select Batting Team</option>
                        {selectedMatch > 0 &&
                          currentMatch &&
                          teams
                            .filter((t) => {
                              if (!matchTeamIds.includes(t.id)) return false;
                              // If inning 1 is complete, only show the other team
                              if (currentMatch.inning1_complete) {
                                const inning1TeamId = Number(
                                  currentMatch.inning1_team_id
                                );
                                return Number(t.id) !== inning1TeamId;
                              }
                              // If inning 1 is not complete, show both teams
                              return true;
                            })
                            .map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                      </select>
                    </div>
                  </FormField>
                </div>


                {/* Over Information */}
                <div className="bg-linear-to-r from-lime-500/20 to-lime-600/20 rounded-lg p-4 border border-lime-500">
                  <h3 className="text-sm font-bold text-lime-400 mb-3">
                    Over Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Over Number (0-based)"
                      error={errors.overNumber?.message}
                      helperText="0 = 1st over"
                    >
                      <input
                        type="number"
                        {...register("overNumber", { valueAsNumber: true })}
                        min={0}
                        max={50}
                        className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 bg-slate-800 text-white ${
                          errors.overNumber
                            ? "border-red-500"
                            : "border-lime-500/30"
                        }`}
                      />
                    </FormField>
                    <FormField
                      label="Ball Number (0-5)"
                      error={errors.ballNumber?.message}
                      helperText="0 = 1st ball"
                    >
                      <input
                        type="number"
                        {...register("ballNumber", { valueAsNumber: true })}
                        min={0}
                        max={5}
                        className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 bg-slate-800 text-white ${
                          errors.ballNumber
                            ? "border-red-500"
                            : "border-slate-700"
                        }`}
                      />
                    </FormField>
                  </div>
                </div>

                {/* Batsmen Selection */}
                <div className="space-y-4">
                  <div className="bg-linear-to-r from-cyan-500/20 to-cyan-600/20 rounded-lg p-4 border border-cyan-500">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-bold text-cyan-400 flex items-center">
                        <span className="inline-block w-3 h-3 bg-cyan-400 rounded-full mr-2 animate-pulse"></span>
                        Striker (On Strike)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!strikerId || !nonStrikerId) return;

                          setValue("strikerId", nonStrikerId, {
                            shouldDirty: true,
                          });
                          setValue("nonStrikerId", strikerId, {
                            shouldDirty: true,
                          });
                        }}
                        className="text-xs bg-linear-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm flex items-center space-x-1"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                          />
                        </svg>
                        <span>Swap</span>
                      </button>
                    </div>
                    <select
                      {...register("strikerId", { valueAsNumber: true })}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 bg-slate-800 text-white ${
                        errors.strikerId ? "border-red-500" : "border-cyan-500"
                      }`}
                    >
                      <option value={0}>Select Striker</option>
                      {playersInMatch
                        .filter((p) => p.team_id === battingTeamId)
                        .map((player) => (
                          <option
                            key={player.id}
                            value={player.id}
                            disabled={player.id === nonStrikerId}
                          >
                            {player.name}
                          </option>
                        ))}
                    </select>
                    {errors.strikerId && extraType === "none" && (
                      <p className="text-xs text-red-400 mt-2">
                        {errors.strikerId.message}
                      </p>
                    )}
                  </div>

                  <div className="bg-linear-to-r from-amber-500/20 to-amber-600/20 rounded-lg p-4 border border-amber-500">
                    <label className="text-sm font-bold text-amber-400 flex items-center mb-3">
                      <span className="inline-block w-3 h-3 bg-amber-400 rounded-full mr-2"></span>
                      Non-Striker
                    </label>
                    <select
                      {...register("nonStrikerId", { valueAsNumber: true })}
                      className="w-full p-3 border border-amber-500 rounded-lg focus:ring-2 focus:ring-amber-500 bg-slate-800 text-white"
                    >
                      <option value={0}>Select Non-Striker</option>
                      {playersInMatch
                        .filter((p) => p.team_id === battingTeamId)
                        .map((player) => (
                          <option
                            key={player.id}
                            value={player.id}
                            disabled={player.id === strikerId}
                          >
                            {player.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Bowler Selection */}
                <FormField
                  label="Bowler"
                  required
                  error={errors.bowlerId?.message}
                >
                  <select
                    {...register("bowlerId", { valueAsNumber: true })}
                    className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 bg-slate-800 text-white ${
                      errors.bowlerId ? "border-red-500" : "border-slate-700"
                    }`}
                  >
                    <option value={0}>Select Bowler</option>
                    {playersInMatch
                      .filter((p) => p.team_id !== battingTeamId)
                      .map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                  </select>
                </FormField>

                {/* Runs and Extras */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-sm font-bold text-lime-400 mb-4">
                    Ball Outcome
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-2">
                        Runs Scored
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[0, 1, 2, 4, 6].map((run) => (
                          <button
                            key={run}
                            type="button"
                            onClick={() => setValue("runs", run)}
                            className={`p-3 rounded-lg font-bold transition-all ${
                              runs === run
                                ? run === 6
                                  ? "bg-linear-to-r from-rose-500 to-pink-500 text-white shadow-lg scale-105"
                                  : run === 4
                                    ? "bg-linear-to-r from-orange-500 to-amber-500 text-black shadow-lg scale-105"
                                    : "bg-lime-500 text-black shadow-lg scale-105"
                                : "bg-slate-700 border-2 border-slate-600 text-gray-300 hover:border-lime-500"
                            }`}
                          >
                            {run}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-2">
                        Extras
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          {...register("extras")}
                          className="w-1/3 p-3 border-2 border-slate-700 rounded-lg focus:ring-2 focus:ring-lime-500 bg-slate-800 text-white"
                          placeholder="0"
                        />
                        <select
                          {...register("extraType")}
                          className="flex-1 p-3 border-2 border-slate-700 rounded-lg focus:ring-2 focus:ring-lime-500 bg-slate-800 text-white"
                        >
                          <option value="none">No Extra</option>
                          <option value="wide">Wide</option>
                          <option value="no-ball">No Ball</option>
                          <option value="bye">Bye</option>
                          <option value="leg-bye">Leg Bye</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wicket and Event */}
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-red-500/20 border border-red-500 rounded-lg">
                    <input
                      type="checkbox"
                      {...register("wicket")}
                      className="w-5 h-5 text-red-500 border-slate-700 rounded focus:ring-red-500 bg-slate-800"
                      id="wicket-checkbox"
                    />
                    <label
                      htmlFor="wicket-checkbox"
                      className="ml-3 text-sm font-bold text-red-400"
                    >
                      Wicket Fallen
                    </label>
                  </div>

                  <FormField
                    label="Event Description (Optional)"
                    error={errors.eventText?.message}
                    helperText="Add a commentary note for this delivery"
                  >
                    <input
                      type="text"
                      {...register("eventText")}
                      placeholder="e.g., Brilliant cover drive! 4 runs"
                      className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 bg-slate-800 text-white ${
                        errors.eventText ? "border-red-500" : "border-slate-700"
                      }`}
                    />
                  </FormField>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || selectedMatchDetails?.match_status === 'completed'}
                  className="w-full bg-linear-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-black py-4 px-6 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent mr-3"></span>
                      Adding Ball...
                    </span>
                  ) : selectedMatchDetails?.match_status === 'completed' ? (
                    <span className="flex items-center justify-center space-x-2">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Match Completed</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      <span>Add Ball to Match</span>
                    </span>
                  )}
                </button>

                {/* Complete Match Button (visible when inning 2 is ongoing) */}
                {/* {selectedMatch > 0 && 
                 selectedMatchDetails?.inning1_complete && 
                 selectedMatchDetails?.current_inning === 2 && (
                  <button
                    type="button"
                    onClick={completeMatch}
                    className="w-full bg-linear-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white py-4 px-6 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Complete Match</span>
                  </button>
                )} */}
              </form>
            </div>

            {/* Sidebar - Current Status */}
            <div className="lg:col-span-1">
              <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm p-6 sticky top-24">
                <h3 className="text-xl font-bold text-lime-400 mb-4 flex items-center">
                  <svg
                    className="w-6 h-6 mr-2 text-lime-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <span>Current Ball</span>
                </h3>

                <div className="space-y-4">
                  <div className="bg-linear-to-r from-lime-500/20 to-lime-600/20 rounded-lg p-4 border border-lime-500">
                    <div className="text-sm text-gray-400 mb-1">
                      Current Ball
                    </div>
                    <div className="text-3xl font-bold text-lime-400">
                      {overNumber}.{ballNumber}
                    </div>
                  </div>

                  {selectedMatch > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-gray-400 mb-2">
                        Selected Match
                      </div>
                      <div className="font-semibold text-gray-300">
                        {matches.find((m) => m.id === selectedMatch)
                          ?.team1_name ||
                          matches.find((m) => m.id === selectedMatch)
                            ?.team1}{" "}
                        vs{" "}
                        {matches.find((m) => m.id === selectedMatch)
                          ?.team2_name ||
                          matches.find((m) => m.id === selectedMatch)?.team2}
                      </div>
                    </div>
                  )}

                  {battingTeamId > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-gray-400 mb-2">
                        Batting Team
                      </div>
                      <div className="font-semibold text-gray-300">
                        {teams.find((t) => t.id === battingTeamId)?.name}
                      </div>
                    </div>
                  )}

                  {strikerId > 0 && (
                    <div className="bg-cyan-500/20 rounded-lg p-4 border-2 border-cyan-500">
                      <div className="text-sm text-cyan-400 mb-2 flex items-center">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full mr-2 animate-pulse"></span>
                        On Strike
                      </div>
                      <div className="font-bold text-gray-300">
                        {players.find((p) => p.id === strikerId)?.name}
                      </div>
                    </div>
                  )}

                  {nonStrikerId > 0 && (
                    <div className="bg-amber-500/20 rounded-lg p-4 border-2 border-amber-500">
                      <div className="text-sm text-amber-400 mb-2">
                        Non-Striker
                      </div>
                      <div className="font-bold text-gray-300">
                        {players.find((p) => p.id === nonStrikerId)?.name}
                      </div>
                    </div>
                  )}

                  {bowlerId > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-gray-400 mb-2">Bowler</div>
                      <div className="font-bold text-gray-300">
                        {players.find((p) => p.id === bowlerId)?.name}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
