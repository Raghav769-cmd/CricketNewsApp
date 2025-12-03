"use client";

import { useState, useEffect } from "react";

interface Player {
  id: number;
  name: string;
  team_id: number;
}

interface Team {
  id: number;
  name: string;
}

interface Match {
  id: number;
  team1: string;
  team2: string;
  status: string;
  team1_id: number;
  team2_id: number;
}

export default function BallEntry() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<number>(0);
  const [battingTeamId, setBattingTeamId] = useState<number>(0);
  const [overNumber, setOverNumber] = useState<number>(0);
  const [ballNumber, setBallNumber] = useState<number>(0);
  const [runs, setRuns] = useState<number>(0);
  const [extras, setExtras] = useState<string>("0");
  const [extraType, setExtraType] = useState<string>("none");
  const [wicket, setWicket] = useState<boolean>(false);
  const [strikerId, setStrikerId] = useState<number>(0);
  const [nonStrikerId, setNonStrikerId] = useState<number>(0);
  const [bowlerId, setBowlerId] = useState<number>(0);
  const [eventText, setEventText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const selectedMatchObj = matches.find((m) => m.id === selectedMatch);

  const matchTeamIds: number[] = selectedMatchObj
    ? [selectedMatchObj.team1_id, selectedMatchObj.team2_id]
    : [];

  // Only players from these two teams
  const playersInMatch = players.filter((p) =>
    matchTeamIds.includes(p.team_id)
  );

  useEffect(() => {
    setBattingTeamId(0);
    setStrikerId(0);
    setNonStrikerId(0);
    setBowlerId(0);
  }, [selectedMatch]);

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
        team1_id: Number(m.team1_id),
        team2_id: Number(m.team2_id),
      }));

      setMatches(normalized);
    } catch (error) {
      console.error("Error fetching matches:", error);
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const needsBatsman = extraType === "none";
    if (
      !selectedMatch ||
      !battingTeamId ||
      !bowlerId ||
      (needsBatsman && !strikerId)
    ) {
      setMessage("Please fill all required fields (striker must be selected)");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const overToSend = overNumber + 1;
      const ballToSend = ballNumber + 1;

      const url = `${apiBase}/api/matches/${selectedMatch}/ball`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          overNumber: overToSend,
          ballNumber: ballToSend,
          runs,
          extras,
          extraType,
          wicket,
          is_wicket: wicket,
          event:
            eventText && eventText.trim().length > 0
              ? eventText.trim()
              : extraType !== "none"
                ? extraType
                : null,
          batsmanId: strikerId || null,
          nonStrikerId: nonStrikerId || null,
          bowlerId,
          battingTeamId,
        }),
      });

      if (response.ok) {
        setMessage("✅ Ball added successfully!");
        const illegal = /^(wide|wd|no-?ball|nb)$/i.test(extraType);
        const ballToSend2 = ballNumber + 1; // local for logic
        const isOddRun = runs === 1 || runs === 3 || runs === 5;

        if (!illegal) {
          if (ballToSend2 === 6) {
            // last ball of over
            // If single is taken on last ball, do NOT swap batters (per requirement)
            if (runs !== 1) {
              const tmp = strikerId;
              setStrikerId(nonStrikerId);
              setNonStrikerId(tmp);
            }
            setOverNumber(overNumber + 1);
            setBallNumber(0);
          } else {
            // not last ball
            if (isOddRun) {
              const tmp = strikerId;
              setStrikerId(nonStrikerId);
              setNonStrikerId(tmp);
            }
            setBallNumber(ballNumber + 1);
          }
        }

        setRuns(0);
        setExtras("0");
        setWicket(false);
        setEventText("");
        setExtraType("none");
      } else {
        setMessage("❌ Failed to add ball");
      }
    } catch (error) {
      console.error("Error adding ball:", error);
      setMessage("❌ Error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Live Scoring
            </h1>
            <p className="text-gray-600">
              Enter ball-by-ball data for live match updates
            </p>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-lg shadow-md ${
                message.includes("✅")
                  ? "bg-green-50 border-2 border-green-500 text-green-800"
                  : "bg-red-50 border-2 border-red-500 text-red-800"
              }`}
            >
              <p className="font-medium">{message}</p>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-xl shadow-lg p-6 space-y-6"
              >
                {/* Match and Team Selection */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Match
                    </label>
                    <select
                      value={selectedMatch}
                      onChange={(e) => setSelectedMatch(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      required
                    >
                      <option value={0}>Select Match</option>
                      {matches.map((match) => (
                        <option key={match.id} value={match.id}>
                          Match {match.id}: {match.team1} vs {match.team2}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Batting Team
                    </label>
                    <select
                      value={battingTeamId}
                      onChange={(e) => setBattingTeamId(Number(e.target.value))}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      required
                    >
                      <option value={0}>Select Batting Team</option>
                      {selectedMatchObj &&
                        teams
                          .filter((t) => matchTeamIds.includes(t.id))
                          .map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                    </select>
                  </div>
                </div>

                {/* Over Information */}
                <div className="bg-teal-50 rounded-lg p-4 border-2 border-teal-200">
                  <h3 className="text-sm font-bold text-teal-800 mb-3">
                    Over Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">
                        Over Number (0-based)
                      </label>
                      <input
                        type="number"
                        value={overNumber}
                        onChange={(e) => setOverNumber(Number(e.target.value))}
                        min={0}
                        max={50}
                        className="w-full p-3 border-2 border-teal-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">0 = 1st over</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">
                        Ball Number (0-5)
                      </label>
                      <input
                        type="number"
                        value={ballNumber}
                        onChange={(e) => setBallNumber(Number(e.target.value))}
                        min={0}
                        max={5}
                        className="w-full p-3 border-2 border-teal-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">0 = 1st ball</p>
                    </div>
                  </div>
                </div>

                {/* Batsmen Selection */}
                <div className="space-y-4">
                  <div className="bg-linear-to-r from-green-50 to-green-100 rounded-lg p-4 border-2 border-green-400">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-bold text-green-800 flex items-center">
                        <span className="inline-block w-3 h-3 bg-green-600 rounded-full mr-2 animate-pulse"></span>
                        Striker (On Strike)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const temp = strikerId;
                          setStrikerId(nonStrikerId);
                          setNonStrikerId(temp);
                        }}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                      >
                        ↔ Swap Batsmen
                      </button>
                    </div>
                    <select
                      value={strikerId}
                      onChange={(e) => setStrikerId(Number(e.target.value))}
                      className="w-full p-3 border-2 border-green-400 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                      required={extraType === "none"}
                    >
                      <option value={0}>Select Striker</option>
                      {playersInMatch
                        .filter(
                          (p) =>
                            battingTeamId === 0 || p.team_id === battingTeamId
                        )
                        .filter((p) => p.id !== nonStrikerId)
                        .map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="bg-linear-to-r from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-400">
                    <label className="text-sm font-bold text-blue-800 flex items-center mb-3">
                      <span className="inline-block w-3 h-3 bg-blue-600 rounded-full mr-2"></span>
                      Non-Striker
                    </label>
                    <select
                      value={nonStrikerId}
                      onChange={(e) => setNonStrikerId(Number(e.target.value))}
                      className="w-full p-3 border-2 border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value={0}>Select Non-Striker</option>
                      {playersInMatch
                        .filter(
                          (p) =>
                            battingTeamId === 0 || p.team_id === battingTeamId
                        )
                        .filter((p) => p.id !== strikerId)
                        .map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Bowler Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bowler
                  </label>
                  <select
                    value={bowlerId}
                    onChange={(e) => setBowlerId(Number(e.target.value))}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  >
                    <option value={0}>Select Bowler</option>
                    {playersInMatch
                      .filter(
                        (p) =>
                          battingTeamId === 0 || p.team_id !== battingTeamId
                      )
                      .map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Runs and Extras */}
                <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">
                    Ball Outcome
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">
                        Runs Scored
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[0, 1, 2, 4, 6].map((run) => (
                          <button
                            key={run}
                            type="button"
                            onClick={() => setRuns(run)}
                            className={`p-3 rounded-lg font-bold transition-all ${
                              runs === run
                                ? run === 6
                                  ? "bg-purple-600 text-white shadow-lg scale-105"
                                  : run === 4
                                    ? "bg-green-600 text-white shadow-lg scale-105"
                                    : "bg-teal-600 text-white shadow-lg scale-105"
                                : "bg-white border-2 border-gray-300 text-gray-700 hover:border-teal-400"
                            }`}
                          >
                            {run}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">
                        Extras
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={extras}
                          onChange={(e) => setExtras(e.target.value)}
                          className="w-1/3 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                          placeholder="0"
                        />
                        <select
                          value={extraType}
                          onChange={(e) => setExtraType(e.target.value)}
                          className="flex-1 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                  <div className="flex items-center p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={wicket}
                      onChange={(e) => setWicket(e.target.checked)}
                      className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                      id="wicket-checkbox"
                    />
                    <label
                      htmlFor="wicket-checkbox"
                      className="ml-3 text-sm font-bold text-red-800"
                    >
                      Wicket Fallen
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Event Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={eventText}
                      onChange={(e) => setEventText(e.target.value)}
                      placeholder="e.g., Brilliant cover drive! 4 runs"
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Add a commentary note for this delivery
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-linear-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white py-4 px-6 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></span>
                      Adding Ball...
                    </span>
                  ) : (
                    "Add Ball to Match"
                  )}
                </button>
              </form>
            </div>

            {/* Sidebar - Current Status */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6 sticky top-24">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <span className="text-2xl mr-2">📍</span>
                  Current Ball
                </h3>

                <div className="space-y-4">
                  <div className="bg-linear-to-r from-teal-50 to-teal-100 rounded-lg p-4 border-2 border-teal-200">
                    <div className="text-sm text-gray-600 mb-1">
                      Current Ball
                    </div>
                    <div className="text-3xl font-bold text-teal-700">
                      {overNumber}.{ballNumber}
                    </div>
                  </div>

                  {selectedMatch > 0 && (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="text-sm text-gray-600 mb-2">
                        Selected Match
                      </div>
                      <div className="font-semibold text-gray-800">
                        {matches.find((m) => m.id === selectedMatch)?.team1} vs{" "}
                        {matches.find((m) => m.id === selectedMatch)?.team2}
                      </div>
                    </div>
                  )}

                  {battingTeamId > 0 && (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="text-sm text-gray-600 mb-2">
                        Batting Team
                      </div>
                      <div className="font-semibold text-gray-800">
                        {teams.find((t) => t.id === battingTeamId)?.name}
                      </div>
                    </div>
                  )}

                  {strikerId > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 border-2 border-green-300">
                      <div className="text-sm text-green-700 mb-2 flex items-center">
                        <span className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse"></span>
                        On Strike
                      </div>
                      <div className="font-bold text-gray-800">
                        {players.find((p) => p.id === strikerId)?.name}
                      </div>
                    </div>
                  )}

                  {nonStrikerId > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-300">
                      <div className="text-sm text-blue-700 mb-2">
                        Non-Striker
                      </div>
                      <div className="font-bold text-gray-800">
                        {players.find((p) => p.id === nonStrikerId)?.name}
                      </div>
                    </div>
                  )}

                  {bowlerId > 0 && (
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                      <div className="text-sm text-orange-700 mb-2">Bowler</div>
                      <div className="font-bold text-gray-800">
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
