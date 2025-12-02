"use client";

import { useState, useEffect } from 'react';

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
}

export default function BallEntry() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<number>(0);
  const [battingTeamId, setBattingTeamId] = useState<number>(0);
  // Represented as completed overs and balls in current over (so display starts at 0.0)
  const [overNumber, setOverNumber] = useState<number>(0);
  const [ballNumber, setBallNumber] = useState<number>(0);
  const [runs, setRuns] = useState<number>(0);
  const [extras, setExtras] = useState<string>('0');
  const [extraType, setExtraType] = useState<string>('none');
  const [wicket, setWicket] = useState<boolean>(false);
  const [strikerId, setStrikerId] = useState<number>(0);
  const [nonStrikerId, setNonStrikerId] = useState<number>(0);
  const [bowlerId, setBowlerId] = useState<number>(0);
  const [eventText, setEventText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    fetchMatches();
    fetchPlayers();
    fetchTeams();
  }, []);

  const fetchMatches = async () => {
    try {
      const url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + '/api/matches';
      const response = await fetch(url);
      const data = await response.json();
      setMatches(data);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const fetchPlayers = async () => {
    try {
      const url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + '/api/players';
      const response = await fetch(url);
      const data = await response.json();
      console.log(data)
      setPlayers(data);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + '/api/teams';
      const response = await fetch(url);
      const data = await response.json();
      setTeams(data);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const needsBatsman = extraType === 'none';
    if (!selectedMatch || !battingTeamId || !bowlerId || (needsBatsman && !strikerId)) {
      setMessage('Please fill all required fields (striker must be selected)');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const overToSend = overNumber + 1;
      const ballToSend = ballNumber + 1; //

      const url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + `/api/matches/${selectedMatch}/ball`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          overNumber: overToSend,
          ballNumber: ballToSend,
          runs,
          extras,
          extraType,
          wicket,
          is_wicket: wicket,
          event: eventText && eventText.trim().length > 0 ? eventText.trim() : (extraType !== 'none' ? extraType : null),
          batsmanId: strikerId || null,
          nonStrikerId: nonStrikerId || null,
          bowlerId,
          battingTeamId,
        }),
      });

      if (response.ok) {
        setMessage('✅ Ball added successfully!');
        const illegal = /^(wide|wd|no-?ball|nb)$/i.test(extraType);
        const ballToSend = ballNumber + 1;
        const isOddRun = runs === 1 || runs === 3 || runs === 5;

        if (!illegal) {
          if (ballToSend === 6) {
            // last ball of over: apply special rule
            // If single is taken on last ball, do NOT swap batters (per requirement)
            if (runs !== 1) {
              // swap due to end of over
              const tmp = strikerId;
              setStrikerId(nonStrikerId);
              setNonStrikerId(tmp);
            }
            // complete over
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
        setExtras('0');
        setWicket(false);
        setEventText('');
        setExtraType('none');
      } else {
        setMessage('❌ Failed to add ball');
      }
    } catch (error) {
      console.error('Error adding ball:', error);
      setMessage('❌ Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Ball-by-Ball Entry</h1>
        
        {message && (
          <div className={`mb-4 p-3 rounded ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Match</label>
            <select
              value={selectedMatch}
              onChange={(e) => setSelectedMatch(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Batting Team</label>
            <select
              value={battingTeamId}
              onChange={(e) => setBattingTeamId(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value={0}>Select Batting Team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Over Number (completed)</label>
              <input
                type="number"
                value={overNumber}
                onChange={(e) => setOverNumber(Number(e.target.value))}
                min={0}
                max={50}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ball Number</label>
              <input
                type="number"
                value={ballNumber}
                onChange={(e) => setBallNumber(Number(e.target.value))}
                min={0}
                max={5}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Striker and Non-Striker Batsmen */}
          <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-green-800 flex items-center">
                <span className="inline-block w-3 h-3 bg-green-600 rounded-full mr-2"></span>
                Striker (On Strike)
              </label>
              <button
                type="button"
                onClick={() => {
                  const temp = strikerId;
                  setStrikerId(nonStrikerId);
                  setNonStrikerId(temp);
                }}
                className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                ↔ Swap
              </button>
            </div>
            <select
              value={strikerId}
              onChange={(e) => setStrikerId(Number(e.target.value))}
              className="w-full p-2 border-2 border-green-400 rounded focus:ring-2 focus:ring-green-500 bg-white"
              required={extraType === 'none'}
            >
              <option value={0}>Select Striker</option>
              {players
                .filter((p) => battingTeamId === 0 || Number(p.team_id) === battingTeamId)
                .filter((p) => p.id !== nonStrikerId)
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50">
            <label className="text-sm font-bold text-blue-800 flex items-center mb-2">
              <span className="inline-block w-3 h-3 bg-blue-600 rounded-full mr-2"></span>
              Non-Striker
            </label>
            <select
              value={nonStrikerId}
              onChange={(e) => setNonStrikerId(Number(e.target.value))}
              className="w-full p-2 border-2 border-blue-400 rounded focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value={0}>Select Non-Striker</option>
              {players
                .filter((p) => battingTeamId === 0 || Number(p.team_id) === battingTeamId)
                .filter((p) => p.id !== strikerId)
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bowler</label>
            <select
              value={bowlerId}
              onChange={(e) => setBowlerId(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value={0}>Select Bowler</option>
              {players
                .filter((p) => battingTeamId === 0 || Number(p.team_id) !== battingTeamId)
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Runs</label>
              <select
                value={runs}
                onChange={(e) => setRuns(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={6}>6</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Extras</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={extras}
                  onChange={(e) => setExtras(e.target.value)}
                  className="w-2/3 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
                <select
                  value={extraType}
                  onChange={(e) => setExtraType(e.target.value)}
                  className="w-1/3 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">None</option>
                  <option value="wide">Wide</option>
                  <option value="no-ball">No-ball</option>
                  <option value="bye">Bye</option>
                  <option value="leg-bye">Leg-bye</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={wicket}
              onChange={(e) => setWicket(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="ml-2 text-sm font-medium text-gray-700">Wicket</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Description</label>
            <input
              type="text"
              value={eventText}
              onChange={(e) => setEventText(e.target.value)}
              placeholder="e.g. COVER DRIVE! 4 runs — excellent timing"
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Optional: add a short text description stored with this ball.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Adding...' : 'Add Ball'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded">
          <p className="text-sm text-gray-700">
            <strong>Current Ball:</strong> Over {overNumber}.{ballNumber}
          </p>
        </div>
      </div>
    </div>
  );
}
