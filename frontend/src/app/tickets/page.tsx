'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, Ticket } from '@/lib/api';
import TicketCard from '@/components/TicketCard';

export default function MyTicketsPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string>('+254712345678');
  const [otpCode, setOtpCode] = useState<string>('');
  const [sentOtp, setSentOtp] = useState<string | null>('1234');
  const [isVerified, setIsVerified] = useState<boolean>(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchTicketsForPhone = async (targetPhone: string) => {
    setIsLoading(true);
    let matchedTickets: Ticket[] = [];

    // 1. Check local browser storage for tickets matching this phone number
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('uberbasi_my_tickets');
      if (stored) {
        try {
          const list: Ticket[] = JSON.parse(stored);
          matchedTickets = list.filter(
            (t) => t.passenger_phone === targetPhone
          );
        } catch (e) {
          console.error(e);
        }
      }
    }

    // 2. Query FastAPI backend for tickets matching this phone number
    try {
      const backendTickets = await api.getTicketsByPhone(targetPhone);
      if (backendTickets && backendTickets.length > 0) {
        matchedTickets = [...backendTickets, ...matchedTickets];
      }
    } catch (err) {
      console.error(err);
    }

    // 3. Deduplicate tickets by ID/code
    const uniqueMap = new Map<string, Ticket>();
    matchedTickets.forEach((t) => uniqueMap.set(t.code || t.id, t));
    const finalTickets = Array.from(uniqueMap.values());

    // Strictly show only real DB / booked tickets (No random placeholders)
    setTickets(finalTickets);
    setIsLoading(false);
  };

  const handleSendOtp = () => {
    if (!phone.trim() || phone.length < 9) {
      setFeedback({ type: 'error', msg: 'Please enter a valid M-Pesa phone number.' });
      return;
    }

    const generated = Math.floor(1000 + Math.random() * 9000).toString();
    setSentOtp(generated);
    setFeedback({
      type: 'success',
      msg: `📱 OTP sent to ${phone}! Universal Demo OTP: 1234 (or ${generated})`,
    });
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim() !== '1234' && (!sentOtp || otpCode.trim() !== sentOtp)) {
      setFeedback({ type: 'error', msg: 'Invalid OTP Code. Use universal demo code 1234 to verify.' });
      return;
    }

    setIsVerified(true);
    setFeedback({ type: 'success', msg: `✓ Phone ${phone} verified successfully!` });
    fetchTicketsForPhone(phone.trim());
  };

  const handleBookNewTicketForPhone = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('uberbasi_active_phone', phone.trim());
    }
    router.push('/');
  };

  return (
    <div className="max-w-md mx-auto space-y-6 px-2 py-4 pb-24">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-center space-y-2">
        <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-2xl mx-auto">
          🎫
        </div>
        <h1 className="text-2xl font-black text-white">My Tickets</h1>
        <p className="text-xs text-slate-400">
          View your confirmed tickets, scannable QR codes, and ticket details.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold shadow-lg ${
            feedback.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Ticket Recovery Phone & Universal OTP Verification Card */}
      {!isVerified ? (
        <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              🔑 Ticket Recovery & Phone Verification
            </h2>
            <span className="bg-amber-400/10 text-amber-400 border border-amber-400/20 text-[9px] font-bold px-2 py-0.5 rounded-full">
              Demo OTP: 1234
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Enter Mobile Number to Inspect Tickets
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+2547..."
                  className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 rounded-xl text-xs uppercase tracking-wider"
                >
                  Send OTP
                </button>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  Enter 4-Digit OTP Code (Universal Code: 1234)
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 1234"
                  maxLength={4}
                  className="w-full bg-slate-950 border-2 border-emerald-500 text-white font-mono text-center text-xl font-black rounded-xl p-3 uppercase tracking-widest focus:outline-none"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20"
              >
                Verify Phone & Load Tickets
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Verified Ticket Display List */
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-2xl">
            <span className="text-xs font-bold text-slate-300">
              Verified Mobile: <strong className="text-amber-400">{phone}</strong>
            </span>
            <button
              onClick={() => {
                setIsVerified(false);
                setOtpCode('');
              }}
              className="text-[10px] font-bold text-amber-400 hover:underline bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20"
            >
              Switch Mobile Number
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 space-y-2">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-semibold text-slate-400">Fetching tickets for {phone}...</p>
            </div>
          ) : tickets.length > 0 ? (
            <div className="space-y-4">
              {tickets.map((t) => (
                <TicketCard key={t.id} ticket={t} />
              ))}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4">
              <span className="text-3xl block">📭</span>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">No active tickets found for {phone}</p>
                <p className="text-xs text-slate-400">
                  This mobile number has not booked any seats yet. You can book a ticket now using this number.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBookNewTicketForPhone}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-xl shadow-amber-500/20 block"
              >
                🎫 Book a Ticket Now for {phone}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
