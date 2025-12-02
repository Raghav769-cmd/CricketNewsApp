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
    <header className="bg-gradient-to-r from-teal-700 to-teal-600 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-2xl">🏏</span>
            </div>
            <span className="text-white font-bold text-xl hidden sm:block">CricketLive</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-teal-700 shadow-md'
                      : 'text-white hover:bg-teal-600'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Live Indicator */}
          <div className="flex items-center space-x-2">
            <div className="hidden md:flex items-center space-x-2 bg-green-500 px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              <span className="text-white text-xs font-semibold">LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
