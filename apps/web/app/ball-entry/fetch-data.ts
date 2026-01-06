// Server-side data fetching for SSR
// This file contains helper functions for fetching initial data on the server

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

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Fetch all matches from the API
 * This is called on the server during SSR
 */
export async function getMatches(): Promise<Match[]> {
  try {
    const response = await fetch(`${apiBase}/api/matches`, {
      headers: {
        "Content-Type": "application/json",
      },
      // No caching - fetch fresh data on every request for real-time updates
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch matches: ${response.statusText}`);
    }

    const data = await response.json();

    const normalized: Match[] = data.map((m: any) => ({
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
      inning1_team_id: m.inning1_team_id ? Number(m.inning1_team_id) : undefined,
      inning1_complete: Boolean(m.inning1_complete),
    }));

    return normalized;
  } catch (error) {
    console.error("Error fetching matches:", error);
    return [];
  }
}

/**
 * Fetch all players from the API
 * This is called on the server during SSR
 */
export async function getPlayers(): Promise<Player[]> {
  try {
    const response = await fetch(`${apiBase}/api/players`, {
      headers: {
        "Content-Type": "application/json",
      },
      // No caching - fetch fresh data on every request
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch players: ${response.statusText}`);
    }

    const data = await response.json();

    const normalized: Player[] = data.map((p: any) => ({
      ...p,
      id: Number(p.id),
      team_id: Number(p.team_id),
    }));

    return normalized;
  } catch (error) {
    console.error("Error fetching players:", error);
    return [];
  }
}

/**
 * Fetch all teams from the API
 * This is called on the server during SSR
 */
export async function getTeams(): Promise<Team[]> {
  try {
    const response = await fetch(`${apiBase}/api/teams`, {
      headers: {
        "Content-Type": "application/json",
      },
      // No caching - fetch fresh data on every request
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.statusText}`);
    }

    const data = await response.json();

    const normalized: Team[] = data.map((t: any) => ({
      ...t,
      id: Number(t.id),
    }));

    return normalized;
  } catch (error) {
    console.error("Error fetching teams:", error);
    return [];
  }
}

/**
 * Fetch a single match by ID
 * Used for polling updates from the client
 */
export async function getMatchById(matchId: number): Promise<Match | null> {
  try {
    const response = await fetch(`${apiBase}/api/matches/${matchId}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch match: ${response.statusText}`);
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
      inning1_team_id: m.inning1_team_id ? Number(m.inning1_team_id) : undefined,
      inning1_complete: Boolean(m.inning1_complete),
    };

    return normalized;
  } catch (error) {
    console.error("Error fetching match:", error);
    return null;
  }
}

export async function getStadiums(): Promise<Stadium[]> {
  try {
    const response = await fetch(`${apiBase}/api/stadiums`, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stadiums: ${response.statusText}`);
    }

    const data = await response.json();

    const normalized: Stadium[] = data.map((s: any) => ({
      ...s,
      id: Number(s.id),
    }));

    return normalized;
  } catch (error) {
    console.error("Error fetching stadiums:", error);
    return [];
  }
}
