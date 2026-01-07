"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PlayerStatsCard from "@/app/components/PlayerStatsCard";

interface Player {
  id: number | string;
  name: string;
  team_id: number | string;
  team_name: string;
}

interface Team {
  id: number;
  name: string;
}

export default function TeamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        setLoading(true);
        setError(null);

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

        // Fetch team info
        const teamRes = await fetch(`${baseUrl}/api/teams/${teamId}`);
        if (!teamRes.ok) {
          throw new Error(`Failed to fetch team: ${teamRes.status}`);
        }
        const teamData = await teamRes.json();
        setTeam(teamData);

        // Fetch team players
        const playersRes = await fetch(`${baseUrl}/api/teams/${teamId}/players`);
        if (!playersRes.ok) {
          throw new Error(`Failed to fetch players: ${playersRes.status}`);
        }
        const playersData = await playersRes.json();
        console.log("Fetched players:", playersData);
        setPlayers(playersData || []);
      } catch (error) {
        console.error("Error fetching team data:", error);
        setError(error instanceof Error ? error.message : "Failed to load team data");
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    if (teamId) {
      fetchTeamData();
    }
  }, [teamId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 bg-linear-to-r from-lime-500 to-lime-600 rounded-full animate-spin" 
               style={{ animationDuration: '3s' }}></div>
          <div className="absolute inset-1 bg-black rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-lime-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
            </svg>
          </div>
        </div>
        <p className="text-gray-400 font-medium">Loading team details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 px-4 py-2 bg-slate-900 border border-slate-700 hover:border-lime-500 text-gray-300 hover:text-lime-400 rounded-lg font-semibold transition-all"
        >
          ← Back
        </button>
        <div className="mb-8">
          <div className="inline-block mb-3">
            <span className="px-3 py-2 bg-slate-900 text-lime-400 rounded-full text-xs font-medium border border-lime-500">
              Team Squad
            </span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">{team?.name}</h1>
          <p className="text-gray-400">
            {players.length} {players.length === 1 ? "player" : "players"} in the squad
          </p>
        </div>
      </div>

      {/* Players Grid */}
      <div className="container mx-auto px-4 pb-8 -mt-6">
        {error && (
          <div className="bg-red-900/20 border-2 border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}
        
        {players.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {players.map((player) => (
              <PlayerStatsCard
                key={player.id}
                playerId={Number(player.id)}
                playerName={player.name}
                teamId={parseInt(teamId)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-slate-900 rounded-xl border-2 border-slate-800 p-12 text-center max-w-2xl mx-auto">
            <svg className="w-16 h-16 text-lime-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-xl text-white font-semibold mb-2">No players found</p>
            <p className="text-gray-400">Players will appear here once added to the squad</p>
          </div>
        )}
      </div>
    </div>
  );
}
