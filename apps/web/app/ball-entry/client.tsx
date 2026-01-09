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
  format?: string;
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
  const [transitionInning, setTransitionInning] = useState<number>(1); // Track which inning just ended
  const [transitionNextInning, setTransitionNextInning] = useState<number>(2); // Track next inning
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [outBatsmen, setOutBatsmen] = useState<Set<number>>(new Set());
  const [restingBowler, setRestingBowler] = useState<number | null>(null);
  const [bowlerOversMap, setBowlerOversMap] = useState<Map<number, number>>(new Map());
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

  const getDraftKey = (matchId?: number) => {
    const userId = user?.id ?? user?.email ?? "anon";
    return `ballEntryDraft:${matchId ?? "no-match"}:user:${userId}`;
  };

  const saveDraft = (matchId?: number) => {
    if (!matchId || matchId === 0) return;
    try {
      const key = getDraftKey(matchId);
      const payload = {
        selectedMatch,
        battingTeamId,
        strikerId,
        nonStrikerId,
        bowlerId,
        overNumber,
        ballNumber,
        runs,
        extras: watch("extras"),
        extraType,
        wicket,
        eventText,
        outBatsmen: Array.from(outBatsmen),
        restingBowler,
        bowlerOversMap: Array.from(bowlerOversMap.entries()),
      };
      localStorage.setItem(key, JSON.stringify(payload));
      console.log(`[Draft] auto-saved for match ${matchId}`);
    } catch (e) {
      console.warn("[Draft] save failed", e);
    }
  };

  const clearDraft = (matchId?: number) => {
    if (!matchId || matchId === 0) return;
    try {
      const key = getDraftKey(matchId);
      localStorage.removeItem(key);
      console.log(`[Draft] cleared for match ${matchId}`);
    } catch (e) {
      console.warn("[Draft] clear failed", e);
    }
  };

  const draftTimerRef = useRef<NodeJS.Timeout | null>(null);
  const draftRestoreCheckedRef = useRef<Set<number>>(new Set());

  // Restore draft when selectedMatch changes
  useEffect(() => {
    if (!selectedMatch || selectedMatch === 0) return;
    
    // Only attempt restore once per match session
    if (draftRestoreCheckedRef.current.has(selectedMatch)) return;
    draftRestoreCheckedRef.current.add(selectedMatch);

    try {
      const key = getDraftKey(selectedMatch);
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      
      // Use dynamic import to avoid SSR issues
      import("@/context/DialogStore").then(({ useDialogStore }) => {
        const { openDialog } = useDialogStore.getState();
        openDialog({
          title: "Restore Saved Draft?",
          message: "A saved form state was found for this match. Would you like to restore it?",
          confirmText: "Restore",
          cancelText: "Start Fresh",
          onConfirm: () => {
            // Restore form fields in the correct order with a small delay to ensure state updates propagate
            if (typeof parsed.battingTeamId === "number") setValue("battingTeamId", parsed.battingTeamId);
            
            // Batsmen must be set after batting team is set
            if (typeof parsed.strikerId === "number") setValue("strikerId", parsed.strikerId, { shouldDirty: true });
            if (typeof parsed.nonStrikerId === "number") setValue("nonStrikerId", parsed.nonStrikerId, { shouldDirty: true });
            
            // Bowler selection
            if (typeof parsed.bowlerId === "number") setValue("bowlerId", parsed.bowlerId, { shouldDirty: true });
            
            // Over and ball info
            if (typeof parsed.overNumber === "number") setValue("overNumber", parsed.overNumber);
            if (typeof parsed.ballNumber === "number") setValue("ballNumber", parsed.ballNumber);
            
            // Runs and extras
            if (typeof parsed.runs === "number") setValue("runs", parsed.runs);
            if (typeof parsed.extras === "string") setValue("extras", parsed.extras);
            if (typeof parsed.extraType === "string") setValue("extraType", parsed.extraType);
            
            // Wicket and event
            if (typeof parsed.wicket === "boolean") setValue("wicket", parsed.wicket);
            if (typeof parsed.eventText === "string") setValue("eventText", parsed.eventText);
            
            // Restore out batsmen as a Set
            if (Array.isArray(parsed.outBatsmen)) {
              setOutBatsmen(new Set(parsed.outBatsmen));
              console.log("[Draft] restored out batsmen:", parsed.outBatsmen);
            }
            
            // Restore resting bowler
            if (typeof parsed.restingBowler === "number" || parsed.restingBowler === null) {
              setRestingBowler(parsed.restingBowler);
              console.log("[Draft] restored resting bowler:", parsed.restingBowler);
            }
            
            // Restore bowler overs map
            if (Array.isArray(parsed.bowlerOversMap)) {
              setBowlerOversMap(new Map(parsed.bowlerOversMap));
              console.log("[Draft] restored bowler overs map:", parsed.bowlerOversMap);
            }
            
            console.log("[Draft] fully restored for match", selectedMatch);
          },
          onCancel: () => {
            console.log("[Draft] user chose to start fresh");
          },
        });
      }).catch(e => console.warn("[Draft] dialog import failed", e));
    } catch (e) {
      console.warn("[Draft] restore check failed", e);
    }
  }, [selectedMatch]);

  // Autosave draft on form changes
  useEffect(() => {
    if (!selectedMatch || selectedMatch === 0) return;

    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
    }

    draftTimerRef.current = setTimeout(() => {
      saveDraft(selectedMatch);
    }, 1000);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    selectedMatch,
    battingTeamId,
    strikerId,
    nonStrikerId,
    bowlerId,
    overNumber,
    ballNumber,
    runs,
    extraType,
    wicket,
    eventText,
    outBatsmen,
    restingBowler,
    bowlerOversMap,
  ]);

  const allowReloadRef = useRef<boolean>(false);
  const reloadAttemptRef = useRef<boolean>(false);

  // Intercept reload and show custom dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        if (selectedMatch && selectedMatch > 0 && !allowReloadRef.current) {
          e.preventDefault();
          showReloadDialog();
        }
      }
      
      if (e.key === 'F5') {
        if (selectedMatch && selectedMatch > 0 && !allowReloadRef.current) {
          e.preventDefault();
          showReloadDialog();
        }
      }
    };

    const showReloadDialog = () => {
      import("@/context/DialogStore").then(({ useDialogStore }) => {
        const { openDialog } = useDialogStore.getState();
        openDialog({
          title: "Unsaved Changes",
          message: "You have unsaved form data for this match. Your data will be auto-saved and restored when you return. Are you sure you want to reload?",
          confirmText: "Reload Page",
          cancelText: "Stay",
          isDangerous: true,
          onConfirm: () => {
            allowReloadRef.current = true;
            window.location.reload();
          },
          onCancel: () => {
            console.log("[Draft] user chose to stay on page");
          },
        });
      }).catch(e => console.warn("[Draft] dialog import failed", e));
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowReloadRef.current) {
        return;
      }

      if (selectedMatch && selectedMatch > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [selectedMatch]);

  const getMaxOversForFormat = (format: string | undefined): number => {
    if (!format) return 4; 
    const formatlower = format.toLowerCase();
    if (formatlower === "odi") return 10;
    if (formatlower === "test") return Infinity; // No limit for Test matches
    return 4; // T20 default limit
  };

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
    }, 3000); 
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsPolling(false);
      console.log("⏹️ Stopped polling");
    }
  };

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

  useEffect(() => {
    if (!selectedMatchDetails) {
      stopPolling();
      return;
    }

    if (selectedMatchDetails.inning1_complete) {
      if (!isPolling && !pollingIntervalRef.current) {
        startPolling();
      }
    } else {
      if (isPolling) {
        stopPolling();
      }
    }
    return () => {
    };
  }, [selectedMatchDetails?.inning1_complete, selectedMatchDetails?.id, isPolling]);

  // Cleanup polling 
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-black via-slate-900 to-black">
        <div className="text-center max-w-sm">
          {/* Animated cricket ball icon */}
          <div className="mb-8 flex justify-center">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 bg-linear-to-r from-lime-500 to-lime-600 rounded-full animate-spin" 
                   style={{ animationDuration: '3s' }}></div>
              <div className="absolute inset-1 bg-linear-to-br from-black via-slate-900 to-black rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-lime-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                </svg>
              </div>
            </div>
          </div>
          
          {/* Loading text with animation */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold bg-linear-to-r from-lime-400 to-lime-500 bg-clip-text text-transparent">
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
        clearDraft(selectedMatch);
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
        // Clear draft after match completion
        clearDraft(selectedMatch);
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
          const result = await response.json();
          
          // Handle inning end all-out
          if (result.inningEnded) {
            console.log("[UI] Inning ended:", result);  
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
            };
            setSelectedMatchDetails(normalizedMatch);
          }
          
          // Show inning transition
          setShowInningTransition(true);
          setTransitionTimer(5);
          
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
          
          // Dynamic message based on inning that just ended
          const inningEnded = result.inning || 1;
          const nextInning = inningEnded + 1;
          setTransitionInning(inningEnded);
          setTransitionNextInning(nextInning);
          setMessage(`✅ Inning ${inningEnded} completed! Team all out. Preparing Inning ${nextInning}...`);
          
          // Reset form for next inning
          setValue("battingTeamId", 0); // ← RESET BATTING TEAM so user must reselect
          setValue("ballNumber", 0);
          setValue("overNumber", 0);
          setValue("runs", 0);
          setValue("extras", "0");
          setValue("wicket", false);
          setValue("eventText", "");
          setValue("extraType", "none");
          setValue("strikerId", 0); // Reset batsmen
          setValue("nonStrikerId", 0);
          setValue("bowlerId", 0); // Reset bowler
          
          // Reset out batsmen and resting bowler for the new inning
          setOutBatsmen(new Set());
          setRestingBowler(null);
          setBowlerOversMap(new Map());
          // Clear draft after inning completes
          clearDraft(selectedMatch);
          return;
        }
        
        // Handle match completion
        if (result.completed && result.match?.match_status === 'completed') {
          console.log("[UI] Match completed:", result);
          
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
            };
            setSelectedMatchDetails(normalizedMatch);
          }
          
          // Update form to show the final ball that was just submitted
          const illegal = /^(wide|wd|no-?ball|nb)$/i.test(data.extraType);
          if (!illegal) {
            if (ballToSend === 6) {
              setValue("overNumber", data.overNumber + 1);
              setValue("ballNumber", 0);
            } else {
              setValue("ballNumber", ballToSend);
            }
          }
          
          setMessage(`✅ Match Completed! ${result.result}`);
          // Clear draft after match completes
          clearDraft(selectedMatch);
          return;
        }
        
        // Normal ball submission
        setMessage("✅ Ball added successfully!");
        
        // Track out batsmen when wicket is submitted
        if (data.wicket && data.strikerId > 0) {
          setOutBatsmen(prev => new Set([...prev, data.strikerId]));
          console.log(`[UI] Batsman ${data.strikerId} marked as out`);
        }
        
        const illegal = /^(wide|wd|no-?ball|nb)$/i.test(data.extraType);
        const ballToSend2 = data.ballNumber + 1;
        const isOddRun = data.runs === 1 || data.runs === 3 || data.runs === 5;

        if (!illegal) {
          if (ballToSend2 === 6) {
            // Over complete - mark bowler as resting for next over and increment overs bowled
            setRestingBowler(data.bowlerId);
            
            // Track overs bowled by this bowler
            setBowlerOversMap(prev => {
              const newMap = new Map(prev);
              const currentOvers = newMap.get(data.bowlerId) || 0;
              newMap.set(data.bowlerId, currentOvers + 1);
              const maxOvers = getMaxOversForFormat(selectedMatchDetails?.format || "t20");
              console.log(`[UI] Bowler ${data.bowlerId} completed over. Total overs: ${currentOvers + 1}/${maxOvers === Infinity ? 'Unlimited' : maxOvers}`);
              if (maxOvers !== Infinity && currentOvers + 1 >= maxOvers) {
                console.log(`[UI] Bowler ${data.bowlerId} has reached max overs limit (${currentOvers + 1}/${maxOvers}) - PERMANENTLY DISABLED`);
              }
              return newMap;
            });
            
            // First, do the normal end-of-over swap
            if (data.runs !== 1) {
              const tmp = data.strikerId;
              setValue("strikerId", data.nonStrikerId);
              setValue("nonStrikerId", tmp);
            }
            
            // If wicket fell on last ball, clear non-striker field after swap
            if (data.wicket) {
              setValue("nonStrikerId", 0);
              console.log(`[UI] Wicket on last ball: Non-striker field cleared after swap.`);
            }
            
            setValue("overNumber", data.overNumber + 1);
            setValue("ballNumber", 0);
            setValue("bowlerId", 0);
          } else {
            if (isOddRun) {
              const tmp = data.strikerId;
              setValue("strikerId", data.nonStrikerId);
              setValue("nonStrikerId", tmp);
            }
            setValue("ballNumber", data.ballNumber + 1);
            
            // If we're not at the start of an over, clear resting bowler if next ball is 1st of new over
            if (data.ballNumber + 1 === 1) {
              setRestingBowler(null);
              console.log(`[UI] Resting period over - bowler is available again`);
            }
          }
        }

        setValue("runs", 0);
        setValue("extras", "0");
        setValue("wicket", false);
        setValue("eventText", "");
        setValue("extraType", "none");
        
        // Clear striker ID if wicket was marked - but NOT if it's the last ball of the over
        if (data.wicket && ballToSend2 !== 6) {
          setValue("strikerId", 0);
          console.log("[UI] Wicket marked - striker ID cleared");
        }
        
        // Clear draft after successful ball submission
        clearDraft(selectedMatch);
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
              <p className="text-lime-400 font-semibold">✅ Inning {transitionInning} Completed</p>
              <p className="text-gray-400 text-sm">Preparing for Inning {transitionNextInning}...</p>
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
                      value={selectedMatch}
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
                      (() => {
                        if (!selectedMatchDetails) return "";
                        const currentInning = Number(selectedMatchDetails.current_inning) || 1;
                        const isTest = selectedMatchDetails.format === 'test';
                        
                        if (currentInning === 2) {
                          return `✅ Inning 1 completed! Now select Inning 2 team.`;
                        }
                        if (currentInning === 3 && isTest) {
                          return `✅ Inning 2 completed! Now select Inning 3 team (same as Inning 1).`;
                        }
                        if (currentInning === 4 && isTest) {
                          return `✅ Inning 3 completed! Now select Inning 4 team (same as Inning 2).`;
                        }
                        return "";
                      })()
                    }
                  >
                    <div className="space-y-2">
                      <select
                        {...register("battingTeamId", { valueAsNumber: true })}
                        value={battingTeamId}
                        key={`${selectedMatch}-${selectedMatchDetails?.current_inning}`}
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
                              
                              const currentInning = Number(currentMatch.current_inning) || 1;
                              const inning1TeamId = Number(currentMatch.inning1_team_id);
                              const isTestFormat = currentMatch.format === 'test';
                              
                              // For test format with 4 innings
                              if (isTestFormat) {
                                // Inning 1: Both teams can be selected
                                if (currentInning === 1) {
                                  return true;
                                }
                                // Inning 2: Only the OTHER team (not team from inning 1)
                                if (currentInning === 2) {
                                  return Number(t.id) !== inning1TeamId;
                                }
                                // Inning 3: Same team as inning 1
                                if (currentInning === 3) {
                                  return Number(t.id) === inning1TeamId;
                                }
                                // Inning 4: Same team as inning 2 (the other team)
                                if (currentInning === 4) {
                                  return Number(t.id) !== inning1TeamId;
                                }
                              } else {
                                // For non-test formats (2 innings only)
                                if (currentInning === 1) {
                                  return true;
                                }
                                if (currentInning === 2) {
                                  return Number(t.id) !== inning1TeamId;
                                }
                              }
                              
                              return false;
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

                {/* Placeholder when match/team not selected */}
                {(selectedMatch === 0 || battingTeamId === 0) && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-linear-to-br from-lime-500/20 to-lime-600/20 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">
                      {selectedMatch === 0 ? "Select a Match to Begin" : "Select a Batting Team to Begin"}
                    </h3>
                    <p className="text-gray-400 text-sm max-w-sm">
                      {selectedMatch === 0 
                        ? "Choose a match from the dropdown above to start ball-by-ball entry."
                        : "Select which team is batting to unlock the full scoring form."}
                    </p>
                  </div>
                )}

                {/* Rest of form - only visible when match and batting team are selected */}
                {selectedMatch > 0 && battingTeamId > 0 && (
                  <>
                  


                {/* Over Information */}
                <div className="bg-linear-to-r from-lime-500/20 to-lime-600/20 rounded-lg p-4 border border-lime-500">
                  <h3 className="text-sm font-bold text-lime-400 mb-3">
                    Over Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Over Number (0-based)"
                      helperText="0 = 1st over (Auto-updates)"
                    >
                      <div className="w-full p-3 border-2 border-lime-500/50 rounded-lg bg-slate-900 text-lime-300 font-mono font-bold">
                        {overNumber}
                      </div>
                      <input
                        type="number"
                        {...register("overNumber", { valueAsNumber: true })}
                        hidden
                      />
                    </FormField>
                    <FormField
                      label="Ball Number (0-5)"
                      helperText="0 = 1st ball (Auto-updates)"
                    >
                      <div className="w-full p-3 border-2 border-lime-500/50 rounded-lg bg-slate-900 text-lime-300 font-mono font-bold">
                        {ballNumber}
                      </div>
                      <input
                        type="number"
                        {...register("ballNumber", { valueAsNumber: true })}
                        hidden
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
                      value={strikerId}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 bg-slate-800 text-white ${
                        errors.strikerId ? "border-red-500" : "border-cyan-500"
                      }`}
                    >
                      <option value={0}>Select Striker</option>
                      {playersInMatch
                        .filter((p) => p.team_id === battingTeamId && !outBatsmen.has(p.id))
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
                      value={nonStrikerId}
                      className="w-full p-3 border border-amber-500 rounded-lg focus:ring-2 focus:ring-amber-500 bg-slate-800 text-white"
                    >
                      <option value={0}>Select Non-Striker</option>
                      {playersInMatch
                        .filter((p) => p.team_id === battingTeamId && !outBatsmen.has(p.id))
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
                    value={bowlerId}
                    className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 bg-slate-800 text-white ${
                      errors.bowlerId ? "border-red-500" : "border-slate-700"
                    }`}
                  >
                    <option value={0}>Select Bowler</option>
                    {playersInMatch
                      .filter((p) => {
                        // Exclude bowlers from opposite team (non-bowling team)
                        if (p.team_id === battingTeamId) return false;
                        
                        // Exclude resting bowler
                        if (p.id === restingBowler) return false;
                        
                        // Exclude bowlers who have completed max overs (but not for Test matches)
                        const bowlerOvers = bowlerOversMap.get(p.id) || 0;
                        const maxOvers = getMaxOversForFormat(selectedMatchDetails?.format || "t20");
                        if (maxOvers !== Infinity && bowlerOvers >= maxOvers) return false;
                        
                        return true;
                      })
                      .map((player) => {
                        const bowlerOvers = bowlerOversMap.get(player.id) || 0;
                        const maxOvers = getMaxOversForFormat(selectedMatchDetails?.format || "t20");
                        const oversDisplay = maxOvers === Infinity ? `${bowlerOvers}/∞` : `${bowlerOvers}/${maxOvers}`;
                        return (
                          <option key={player.id} value={player.id}>
                            {player.name} ({oversDisplay} overs)
                          </option>
                        );
                      })}
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
                            disabled={wicket}
                            className={`p-3 rounded-lg font-bold transition-all ${
                              wicket
                                ? "bg-slate-900 border-2 border-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                                : runs === run
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
                  disabled={isSubmitting || selectedMatchDetails?.match_status === 'completed' || bowlerId === 0 || strikerId === 0 || nonStrikerId === 0}
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
                  ) : bowlerId === 0 ? (
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
                      <span>Select Bowler First</span>
                    </span>
                  ) : strikerId === 0 ? (
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
                      <span>Select Striker First</span>
                    </span>
                  ) : nonStrikerId === 0 ? (
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
                      <span>Select Non-Striker First</span>
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
                  </>
                )}
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
