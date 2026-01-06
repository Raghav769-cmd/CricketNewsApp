import { getMatches, getPlayers, getTeams, getStadiums } from "./fetch-data";
import BallEntryClient from "./client";

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
}

// Force dynamic rendering for real-time data
export const dynamic = "force-dynamic";

export default async function BallEntryPage() {
  // Fetch initial data on the server
  const [initialMatches, initialPlayers, initialTeams, initialStadiums] = await Promise.all([
    getMatches(),
    getPlayers(),
    getTeams(),
    getStadiums(),
  ]);

  return (
    <BallEntryClient
      initialMatches={initialMatches}
      initialPlayers={initialPlayers}
      initialTeams={initialTeams}
      initialStadiums={initialStadiums}
    />
  );
}
