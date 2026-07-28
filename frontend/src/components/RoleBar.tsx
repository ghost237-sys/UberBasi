'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, UserSession } from '@/lib/api';

export default function RoleBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    setSession(api.getCurrentSession());
  }, [pathname]);

  const handleLogout = () => {
    const userRole = session?.role;
    api.logout();
    setSession(null);
    
    // Commuters/passengers are redirected to home page (/) upon logging out
    if (!userRole || userRole === 'passenger') {
      router.push('/');
    } else {
      router.push('/login');
    }
  };

  const isPassengerView = pathname === '/' || pathname === '/passes' || pathname === '/tickets' || pathname === '/track';

  return (
    <>
      {/* Top Header */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-md shadow-amber-500/20">
                UB
              </div>
              <div>
                <span className="font-extrabold text-white text-base sm:text-lg tracking-tight">Supermetro</span>
                <span className="text-amber-400 font-bold ml-1.5 text-xs bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                  UberBasi
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Items */}
            <div className="hidden sm:flex items-center space-x-2">
              {isPassengerView ? (
                // Pure Commuter Navigation (No Staff Toggles)
                <div className="flex items-center space-x-2">
                  <Link
                    href="/"
                    className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                      pathname === '/'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-300 hover:text-white bg-slate-800/40'
                    }`}
                  >
                    🎫 Book Ticket
                  </Link>
                  <Link
                    href="/passes"
                    className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                      pathname === '/passes'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-300 hover:text-white bg-slate-800/40'
                    }`}
                  >
                    💳 Monthly Pass
                  </Link>
                  <Link
                    href="/tickets"
                    className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                      pathname === '/tickets'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-300 hover:text-white bg-slate-800/40'
                    }`}
                  >
                    📱 My Tickets
                  </Link>
                  <Link
                    href="/track"
                    className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                      pathname === '/track'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-300 hover:text-white bg-slate-800/40'
                    }`}
                  >
                    📍 Track Bus
                  </Link>
                </div>
              ) : (
                // Staff Active View Header
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-xl border border-amber-400/20 uppercase tracking-wider">
                    {pathname === '/conductor'
                      ? '📱 Conductor Workspace'
                      : pathname === '/owner'
                      ? '📊 SACCO / Owner Dashboard'
                      : '⚙️ Platform Administration'}
                  </span>
                </div>
              )}

              {session && (
                <div className="flex items-center space-x-2 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs ml-2">
                  <span className="font-bold text-amber-400">{session.username}</span>
                  <button
                    onClick={handleLogout}
                    className="bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE THUMB-FRIENDLY BOTTOM NAVIGATION BAR (COMMUTER VIEWS ONLY) */}
      {isPassengerView && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 z-50 px-2 py-2">
          <div className="grid grid-cols-4 gap-1 text-center">
            <Link
              href="/"
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center transition-all ${
                pathname === '/' ? 'text-amber-400 font-black' : 'text-slate-400 font-semibold'
              }`}
            >
              <span className="text-base">🎫</span>
              <span className="text-[9px]">Book</span>
            </Link>

            <Link
              href="/passes"
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center transition-all ${
                pathname === '/passes' ? 'text-amber-400 font-black' : 'text-slate-400 font-semibold'
              }`}
            >
              <span className="text-base">💳</span>
              <span className="text-[9px]">Passes</span>
            </Link>

            <Link
              href="/tickets"
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center transition-all ${
                pathname === '/tickets' ? 'text-amber-400 font-black' : 'text-slate-400 font-semibold'
              }`}
            >
              <span className="text-base">📱</span>
              <span className="text-[9px]">Tickets</span>
            </Link>

            <Link
              href="/track"
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center transition-all ${
                pathname === '/track' ? 'text-amber-400 font-black' : 'text-slate-400 font-semibold'
              }`}
            >
              <span className="text-base">📍</span>
              <span className="text-[9px]">Track</span>
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}
