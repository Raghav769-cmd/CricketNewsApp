"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout, loading } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  
  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/matches', label: 'Matches' },
    { href: '/teams', label: 'Teams' },
  ];

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
    router.push('/login');
  };

  return (
    <header className="bg-black border-b border-slate-800 sticky top-0 z-50 shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-linear-to-br from-lime-400 to-lime-500 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <span className="text-2xl font-bold text-white">CricketLive</span>
              <div className="text-xs text-gray-500 font-semibold">Real-time Updates</div>
            </div>
          </Link>

          <nav className="flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-md font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-lime-500 text-black'
                      : 'text-gray-400 hover:bg-slate-900 hover:text-lime-400'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 bg-lime-500 px-3 py-1.5 rounded-full shadow-sm">
              <span className="w-2 h-2 bg-black rounded-full animate-pulse"></span>
              <span className="text-black text-xs font-semibold tracking-wide">LIVE</span>
            </div>

            {/* Auth Section */}
            {!loading && (
              <>
                {isAuthenticated && user ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-2 px-3 py-2 group relative overflow-hidden rounded-xl transition-all duration-300 border border-slate-700 hover:border-lime-500/50 bg-linear-to-br from-slate-800/50 to-slate-900/50 hover:from-slate-800 hover:to-slate-800/80 shadow-sm hover:shadow-lg hover:shadow-lime-500/10"
                    >
                      {/* Background linear effect on hover */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-linear-to-r from-lime-500/10 via-transparent to-transparent" />
                      
                      {/* Avatar */}
                      <div className="relative w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm bg-linear-to-br from-lime-400 to-lime-500 text-black shadow-lg shadow-lime-500/30 group-hover:shadow-lime-500/50 transition-all duration-300 shrink-0">
                        {user.email.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* User Info */}
                      <div className="hidden sm:flex flex-col items-start min-w-0 relative z-10">
                        <span className="text-sm font-semibold text-white truncate max-w-[120px]">
                          {user.username || user.email.split('@')[0]}
                        </span>
                        {(user.role === 'admin' || user.role === 'superadmin') && (
                          <span className={`text-xs font-bold ${user.role === 'superadmin' ? 'text-red-400' : 'text-lime-400'}`}>
                            {user.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                          </span>
                        )}
                      </div>
                      
                      {/* Dropdown indicator */}
                      <svg className={`w-4 h-4 text-gray-400 transition-transform duration-300 relative z-10 ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                      <div className="absolute right-0 mt-3 w-64 origin-top-right rounded-xl border border-slate-700/50 bg-slate-900/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* User Card Header */}
                        <div className="p-4 bg-linear-to-b from-slate-800/50 to-transparent border-b border-slate-700/50">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg bg-linear-to-br from-lime-400 to-lime-500 text-black shadow-lg shadow-lime-500/30">
                              {user.username?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold text-sm truncate">{user.username || user.email}</p>
                              <p className={`text-xs font-bold mt-0.5 flex items-center gap-1 ${user.role === 'superadmin' ? 'text-red-400' : user.role === 'admin' ? 'text-amber-400' : 'text-lime-400'}`}>
                                <span className={`w-2 h-2 rounded-full ${user.role === 'superadmin' ? 'bg-red-400' : user.role === 'admin' ? 'bg-amber-400' : 'bg-lime-400'}`} />
                                {user.role === 'superadmin' ? 'Super Administrator' : user.role === 'admin' ? 'Administrator' : 'User'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Menu Items */}
                        {(user.role === 'admin' || user.role === 'superadmin') && (
                          <>
                            <Link
                              href="/admin-requests"
                              onClick={() => setShowDropdown(false)}
                              className="w-full text-left px-4 py-3 text-lime-400 hover:bg-lime-500/10 hover:text-lime-300 transition-all duration-200 border-b border-slate-700/30 font-medium flex items-center gap-3 group"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Approve Admin Requests</span>
                              <svg className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </>
                        )}

                        {/* Logout Button */}
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 font-medium flex items-center gap-3 group"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span>Logout</span>
                          <svg className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Link
                      href="/login"
                      className="px-4 py-2 text-lime-400 hover:text-lime-300 font-semibold transition"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="px-4 py-2 bg-lime-500 hover:bg-lime-600 text-black rounded-lg font-semibold transition"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
