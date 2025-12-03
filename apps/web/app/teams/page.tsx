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
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + '/api/teams';
        const response = await fetch(apiUrl);
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

  const teamColors = [
    'from-purple-500 to-purple-600',
    'from-orange-500 to-orange-600',
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600',
    'from-red-500 to-red-600',
    'from-pink-500 to-pink-600',
    'from-indigo-500 to-indigo-600',
    'from-teal-500 to-teal-600',
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Cricket Teams</h1>
          <p className="text-gray-600">Browse all registered cricket teams</p>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-xl text-gray-600">No teams found</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team, index) => (
              <div
                key={team.id}
                className="group bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-2"
              >
                {/* Team Header with Gradient */}
                <div className={`h-32 bg-linear-to-br ${teamColors[index % teamColors.length]} flex items-center justify-center relative`}>
                  <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  <div className="relative z-10 text-center">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-2 mx-auto">
                      <span className="text-3xl font-bold text-gray-700">
                        {team.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Team Content */}
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-gray-800 text-center mb-4 group-hover:text-teal-600 transition-colors">
                    {team.name}
                  </h2>
                  
                  <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <span className="text-lg">👥</span>
                      <span>Team ID: {team.id}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button className="mt-6 w-full bg-linear-to-r from-teal-600 to-teal-700 text-white py-2 px-4 rounded-lg font-semibold hover:from-teal-700 hover:to-teal-800 transition-all duration-200 transform group-hover:scale-105 cursor-pointer">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}