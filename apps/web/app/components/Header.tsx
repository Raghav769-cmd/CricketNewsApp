"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  
  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/matches', label: 'Matches' },
    { href: '/teams', label: 'Teams' },
    { href: '/ball-entry', label: 'Live Scoring' },
  ];

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

          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 bg-lime-500 px-3 py-1.5 rounded-full shadow-sm">
              <span className="w-2 h-2 bg-black rounded-full animate-pulse"></span>
              <span className="text-black text-xs font-semibold tracking-wide">LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
