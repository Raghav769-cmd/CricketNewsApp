"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "@/app/components/FormComponents";

interface Player {
  id: number;
  name: string;
  team_id: number;
}

interface Team {
  id: number;
  name: string;
}

const ballEntrySchema = z.object({
  selectedMatch: z.number().min(1, 'Match is required'),
  battingTeamId: z.number().min(1, 'Batting team is required'),
  overNumber: z.number().min(0, 'Over number must be 0 or more').max(50, 'Over number must be 50 or less'),
  ballNumber: z.number().min(0, 'Ball must be 0 or more').max(5, 'Ball must be 5 or less'),
  runs: z.number().min(0, 'Runs must be 0 or more').max(6, 'Runs cannot exceed 6'),
  extras: z.string(),
  extraType: z.string(),
  wicket: z.boolean(),
  strikerId: z.number(),
  nonStrikerId: z.number(),
  bowlerId: z.number().min(1, 'Bowler is required'),
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
}

export default function BallEntry() {
  const router = useRouter();
  const { user, isAuthenticated, token, loading: authLoading } = useAuth();
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoaded, setMatchesLoaded] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [message, setMessage] = useState<string>("");
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BallEntryFormData>({
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

  const selectedMatch = watch('selectedMatch');
  const battingTeamId = watch('battingTeamId');
  const strikerId = watch('strikerId');
  const nonStrikerId = watch('nonStrikerId');
  const bowlerId = watch('bowlerId');
  const overNumber = watch('overNumber');
  const ballNumber = watch('ballNumber');
  const runs = watch('runs');
  const extraType = watch('extraType');
  const wicket = watch('wicket');
  const eventText = watch('eventText');

  // Redirect to login if not authenticated or not admin (superadmin not allowed)
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, user?.role, router]);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const selectedMatchObj = matches.find((m) => m.id === selectedMatch);

  const matchTeamIds: number[] = selectedMatchObj
    ? [selectedMatchObj.team1_id, selectedMatchObj.team2_id]
    : [];

  // Only players from these two teams
  const playersInMatch = players.filter((p) =>
    matchTeamIds.includes(p.team_id)
  );

  useEffect(() => {
    setValue('battingTeamId', 0);
    setValue('strikerId', 0);
    setValue('nonStrikerId', 0);
    setValue('bowlerId', 0);
  }, [selectedMatch, setValue]);

  useEffect(() => {
    fetchMatches();
    fetchPlayers();
    fetchTeams();
  }, []);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const fetchMatches = async () => {
    try {
      const url = `${apiBase}/api/matches`;
      const response = await fetch(url);
      const data = await response.json();
      console.log(data);

      const normalized: Match[] = data.map((m: any) => ({
        ...m,
        id: Number(m.id),
        team1: m.team1,
        team2: m.team2,
        team1_name: m.team1_name || m.team1_name,
        team2_name: m.team2_name || m.team2_name,
        team1_id: Number(m.team1_id),
        team2_id: Number(m.team2_id),
      }));

      setMatches(normalized);
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setMatchesLoaded(true);
    }
  };

  const fetchPlayers = async () => {
    try {
      const url = `${apiBase}/api/players`;
      const response = await fetch(url);
      const data = await response.json();

      const normalized: Player[] = data.map((p: any) => ({
        ...p,
        id: Number(p.id),
        team_id: Number(p.team_id),
      }));
      console.log(normalized);
      setPlayers(normalized);
    } catch (error) {
      console.error("Error fetching players:", error);
    }
  };

  const fetchTeams = async () => {
    try {
      const url = `${apiBase}/api/teams`;
      const response = await fetch(url);
      const data = await response.json();

      const normalized: Team[] = data.map((t: any) => ({
        ...t,
        id: Number(t.id),
      }));

      setTeams(normalized);
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  const onSubmit = async (data: BallEntryFormData) => {
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
          "Authorization": `Bearer ${token}`,
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
              setValue('strikerId', data.nonStrikerId);
              setValue('nonStrikerId', tmp);
            }
            setValue('overNumber', data.overNumber + 1);
            setValue('ballNumber', 0);
          } else {
            if (isOddRun) {
              const tmp = data.strikerId;
              setValue('strikerId', data.nonStrikerId);
              setValue('nonStrikerId', tmp);
            }
            setValue('ballNumber', data.ballNumber + 1);
          }
        }

        setValue('runs', 0);
        setValue('extras', "0");
        setValue('wicket', false);
        setValue('eventText', "");
        setValue('extraType', "none");
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-black border border-lime-200 mb-3">
              <svg className="w-4 h-4 mr-2 text-lime-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-sm font-medium text-lime-500">Ball-by-Ball Entry</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-200 mb-2">
              Live Scoring
            </h1>
            <p className="text-gray-400">
              Enter ball-by-ball data for real-time match updates
            </p>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-lg shadow-sm border-2 ${
                message.includes("✅")
                  ? "bg-green-500/20 border-green-500 text-green-400"
                  : "bg-red-500/20 border-red-500 text-red-400"
              }`}
            >
              <p className="font-medium">{message}</p>
            </div>
          )}

          {matchesLoaded && matches.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm p-10 text-center max-w-xl w-full">
                <div className="w-20 h-20 mx-auto mb-6 bg-linear-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-white">No matches available</h2>
                <p className="text-gray-400 mb-6">There are currently no scheduled matches. Create a new match from the Matches page to start live scoring.</p>
                <div className="flex justify-center">
                  <a href="/matches" className="px-6 py-3 bg-linear-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-black rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all">Go to Matches</a>
                </div>
              </div>
            </div>
          )}

          <div className={`${matchesLoaded && matches.length === 0 ? 'hidden' : ''} grid lg:grid-cols-3 gap-6`}>
            {/* Main Form */}
            <div className="lg:col-span-2">
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm p-6 space-y-6"
              >
                {/* Match and Team Selection */}
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField label="Match" required error={errors.selectedMatch?.message}>
                    <select
                      {...register('selectedMatch', { valueAsNumber: true })}
                      className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 transition-all bg-slate-800 text-white ${
                        errors.selectedMatch ? 'border-red-500' : 'border-slate-700'
                      }`}
                    >
                      <option value={0}>Select Match</option>
                      {matches.map((match) => (
                        <option key={match.id} value={match.id}>
                          Match {match.id}: {match.team1_name || match.team1} vs {match.team2_name || match.team2}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Batting Team" required error={errors.battingTeamId?.message}>
                    <select
                      {...register('battingTeamId', { valueAsNumber: true })}
                      className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 transition-all bg-slate-800 text-white ${
                        errors.battingTeamId ? 'border-red-500' : 'border-slate-700'
                      }`}
                    >
                      <option value={0}>Select Batting Team</option>
                      {selectedMatch > 0 &&
                        teams
                          .filter((t) => matchTeamIds.includes(t.id))
                          .map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                    </select>
                  </FormField>
                </div>

                {/* Over Information */}
                <div className="bg-linear-to-r from-lime-500/20 to-lime-600/20 rounded-lg p-4 border border-lime-500">
                  <h3 className="text-sm font-bold text-lime-400 mb-3">
                    Over Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Over Number (0-based)" error={errors.overNumber?.message} helperText="0 = 1st over">
                      <input
                        type="number"
                        {...register('overNumber', { valueAsNumber: true })}
                        min={0}
                        max={50}
                        className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 bg-slate-800 text-white ${
                          errors.overNumber ? 'border-red-500' : 'border-lime-500/30'
                        }`}
                      />
                    </FormField>
                    <FormField label="Ball Number (0-5)" error={errors.ballNumber?.message} helperText="0 = 1st ball">
                      <input
                        type="number"
                        {...register('ballNumber', { valueAsNumber: true })}
                        min={0}
                        max={5}
                        className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 bg-slate-800 text-white ${
                          errors.ballNumber ? 'border-red-500' : 'border-slate-700'
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
                          const temp = strikerId;
                          setValue('strikerId', nonStrikerId);
                          setValue('nonStrikerId', temp);
                        }}
                        className="text-xs bg-linear-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span>Swap</span>
                      </button>
                    </div>
                    <select
                      {...register('strikerId', { valueAsNumber: true })}
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 bg-slate-800 text-white ${
                        errors.strikerId ? 'border-red-500' : 'border-cyan-500'
                      }`}
                    >
                      <option value={0}>Select Striker</option>
                      {playersInMatch
                        .filter((p) => p.team_id === battingTeamId && p.id !== nonStrikerId)
                        .map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))}
                    </select>
                    {errors.strikerId && extraType === 'none' && (
                      <p className="text-xs text-red-400 mt-2">{errors.strikerId.message}</p>
                    )}
                  </div>

                  <div className="bg-linear-to-r from-amber-500/20 to-amber-600/20 rounded-lg p-4 border border-amber-500">
                    <label className="text-sm font-bold text-amber-400 flex items-center mb-3">
                      <span className="inline-block w-3 h-3 bg-amber-400 rounded-full mr-2"></span>
                      Non-Striker
                    </label>
                    <select
                      {...register('nonStrikerId', { valueAsNumber: true })}
                      className="w-full p-3 border border-amber-500 rounded-lg focus:ring-2 focus:ring-amber-500 bg-slate-800 text-white"
                    >
                      <option value={0}>Select Non-Striker</option>
                      {playersInMatch
                        .filter((p) => p.team_id === battingTeamId && p.id !== strikerId)
                        .map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Bowler Selection */}
                <FormField label="Bowler" required error={errors.bowlerId?.message}>
                  <select
                    {...register('bowlerId', { valueAsNumber: true })}
                    className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 bg-slate-800 text-white ${
                      errors.bowlerId ? 'border-red-500' : 'border-slate-700'
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
                            onClick={() => setValue('runs', run)}
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
                          {...register('extras')}
                          className="w-1/3 p-3 border-2 border-slate-700 rounded-lg focus:ring-2 focus:ring-lime-500 bg-slate-800 text-white"
                          placeholder="0"
                        />
                        <select
                          {...register('extraType')}
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
                      {...register('wicket')}
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

                  <FormField label="Event Description (Optional)" error={errors.eventText?.message} helperText="Add a commentary note for this delivery">
                    <input
                      type="text"
                      {...register('eventText')}
                      placeholder="e.g., Brilliant cover drive! 4 runs"
                      className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-lime-500 bg-slate-800 text-white ${
                        errors.eventText ? 'border-red-500' : 'border-slate-700'
                      }`}
                    />
                  </FormField>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-linear-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-black py-4 px-6 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent mr-3"></span>
                      Adding Ball...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Ball to Match</span>
                    </span>
                  )}
                </button>
              </form>
            </div>

            {/* Sidebar - Current Status */}
            <div className="lg:col-span-1">
              <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-sm p-6 sticky top-24">
                <h3 className="text-xl font-bold text-lime-400 mb-4 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
                        {matches.find((m) => m.id === selectedMatch)?.team1_name || matches.find((m) => m.id === selectedMatch)?.team1} vs{" "}
                        {matches.find((m) => m.id === selectedMatch)?.team2_name || matches.find((m) => m.id === selectedMatch)?.team2}
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
