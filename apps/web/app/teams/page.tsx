"use client";

import { useEffect, useState } from 'react';

interface Team {
  id: number;
  name: string;
}

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchTeams() {
      try {
        const response = await fetch('http://localhost:5000/api/teams'); // Replace with your backend URL
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Team[] = await response.json();
        setTeams(data);
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, []);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Teams</h1>
      {loading ? (
        <p className="text-lg text-gray-600">Loading...</p>
      ) : (
        <ul className="space-y-4">
          {teams.map((team) => (
            <li key={team.id} className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition">
              <h2 className="text-xl font-semibold text-blue-600">{team.name}</h2>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}