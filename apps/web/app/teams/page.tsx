"use client";

import { useEffect, useState } from "react";

interface Team {
  id: number;
  name: string;
}

type ColorScheme = {
  linear: string;
  hoverlinear: string;
  bg: string;
  border: string;
  text: string;
};

const teamColors: ColorScheme[] = [
  {
    linear: "from-purple-500 to-purple-600",
    hoverlinear: "hover:from-purple-500 hover:to-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-600",
  },
  {
    linear: "from-orange-500 to-orange-600",
    hoverlinear: "hover:from-orange-500 hover:to-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-600",
  },
  {
    linear: "from-blue-500 to-blue-600",
    hoverlinear: "hover:from-blue-500 hover:to-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-600",
  },
  {
    linear: "from-green-500 to-green-600",
    hoverlinear: "hover:from-green-500 hover:to-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-600",
  },
  {
    linear: "from-red-500 to-red-600",
    hoverlinear: "hover:from-red-500 hover:to-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-600",
  },
  {
    linear: "from-pink-500 to-pink-600",
    hoverlinear: "hover:from-pink-500 hover:to-pink-600",
    bg: "bg-pink-50",
    border: "border-pink-200",
    text: "text-pink-600",
  },
  {
    linear: "from-indigo-500 to-indigo-600",
    hoverlinear: "hover:from-indigo-500 hover:to-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-600",
  },
  {
    linear: "from-teal-500 to-teal-600",
    hoverlinear: "hover:from-teal-500 hover:to-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-600",
  },
];

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchTeams() {
      try {
        const apiUrl =
          (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000") +
          "/api/teams";

        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: Team[] = await response.json();
        setTeams(data);
      } catch (error) {
        console.error("Error fetching teams:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="mb-8 sm:mb-12">
          <div className="inline-block mb-3 sm:mb-4">
            <span className="px-3 sm:px-4 py-2 bg-slate-900 text-lime-400 rounded-full text-xs sm:text-sm font-medium border border-lime-500">
              Team Directory
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2 sm:mb-4">
            Cricket Teams
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-400">
            Explore all registered teams and their information
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 sm:py-32">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-lime-500 border-t-transparent mb-4" />
            <p className="text-gray-400 font-medium text-sm sm:text-base">Loading teams...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-slate-900 rounded-xl sm:rounded-2xl shadow-lg border-2 border-slate-800 p-8 sm:p-16 text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              No Teams Available
            </h3>
            <p className="text-gray-400 text-sm sm:text-base">
              Teams will appear here once they are registered
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {teams.map((team, index) => {
              const colorScheme: ColorScheme =
                teamColors[index % teamColors.length]!;

              return (
                <div
                  key={team.id}
                  className={`group bg-slate-900 rounded-lg sm:rounded-2xl border-2 border-slate-800 hover:border-lime-500 hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-2`}
                >
                  <div
                    className={`h-2 bg-linear-to-r ${colorScheme.linear}`}
                  />

                  <div className="p-4 sm:p-6">
                    <div
                      className={`w-12 h-12 sm:w-16 sm:h-16 bg-linear-to-br ${colorScheme.linear} rounded-lg sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                    >
                      <span className="text-lg sm:text-2xl font-bold text-white">
                        {team.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>

                    <h2
                      className={`text-lg sm:text-2xl font-bold ${colorScheme.text} mb-2 group-hover:text-gray-900 transition-colors`}
                    >
                      {team.name}
                    </h2>

                    <div
                      className={`flex items-center gap-2 text-xs sm:text-sm ${colorScheme.text} mb-4`}
                    >
                      <svg
                        className="w-3 h-3 sm:w-4 sm:h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      <span className="font-medium">ID: {team.id}</span>
                    </div>

                    <button
                      className={`
                        w-full
                        ${colorScheme.bg} ${colorScheme.text}
                        py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm
                        border-2 ${colorScheme.border}
                        hover:bg-linear-to-r ${colorScheme.hoverlinear}
                        hover:text-white hover:border-transparent
                        transition-all duration-200
                      `}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
