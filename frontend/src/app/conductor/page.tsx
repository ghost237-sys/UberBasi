'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, Ticket, Trip, Stage, UserSession } from '@/lib/api';
import { offlineStore, OfflineTicket } from '@/lib/idb';

export default function ConductorPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);

  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string>('');

  const [inputCode, setInputCode] = useState<string>('');
  const [manifest, setManifest] = useState<Ticket[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);

  // Headcount breakdown
  const [confirmedCount, setConfirmedCount] = useState<number>(0);
  const [paidPendingCount, setPaidPendingCount] = useState<number>(0);
  const [capacity, setCapacity] = useState<number>(33);

  // Status feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; msg: string } | null>(null);

  // Offline / Airplane mode simulation toggle
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [syncQueueCount, setSyncQueueCount] = useState<number>(0);

  // Form states
  const [showStagePushModal, setShowStagePushModal] = useState<boolean>(false);
  const [pushPhone, setPushPhone] = useState<string>('+254711223344');
  const [pushBoardingId, setPushBoardingId] = useState<string>('');
  const [pushAlightingId, setPushAlightingId] = useState<string>('');

  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [expenseCat, setExpenseCat] = useState<string>('Fuel');
  const [expenseAmt, setExpenseAmt] = useState<string>('1500');

  useEffect(() => {
    const current = api.getCurrentSession();
    setSession(current);
    loadAssignedTrip();
  }, []);

  const loadAssignedTrip = async () => {
    try {
      const routes = await api.getRoutes();
      if (routes.length > 0) {
        setStages(routes[0].stages);
        if (routes[0].stages.length >= 2) {
          setPushBoardingId(routes[0].stages[0].id);
          setPushAlightingId(routes[0].stages[routes[0].stages.length - 1].id);
        }
      }

      // Automatically fetch conductor's assigned vehicle trip (no dropdown required)
      const assigned = await api.getMyTrip();
      setCurrentTrip(assigned);
      setSelectedTripId(assigned.id);
      setCapacity(assigned.vehicle?.capacity || 33);
      loadManifest(assigned.id);
    } catch (err) {
      console.error('Network offline, switching to IndexedDB cache', err);
      setIsOffline(true);
      loadManifestFromIDB();
    }
  };

  const loadManifest = async (tripId: string) => {
    try {
      const tickets = await api.getTripManifest(tripId);
      setManifest(tickets);
      
      const offlineTickets: OfflineTicket[] = tickets.map((t) => ({
        id: t.id,
        code: t.code,
        trip_id: t.trip_id,
        status: t.status,
        passenger_phone: t.passenger_phone,
        fare: t.fare,
        synced: true,
      }));
      await offlineStore.saveTickets(offlineTickets);
      updateCounters(tickets);
    } catch (err) {
      setIsOffline(true);
      loadManifestFromIDB(tripId);
    }
  };

  const loadManifestFromIDB = async (tripId?: string) => {
    const offlineTickets = await offlineStore.getAllTickets(tripId || selectedTripId);
    const confirmed = offlineTickets.filter((t) => t.status === 'confirmed').length;
    const paid = offlineTickets.filter((t) => t.status === 'paid').length;
    setConfirmedCount(confirmed);
    setPaidPendingCount(paid);

    const queue = await offlineStore.getSyncQueue();
    setSyncQueueCount(queue.length);
  };

  const updateCounters = (tickets: Ticket[]) => {
    const confirmed = tickets.filter((t) => t.status === 'confirmed').length;
    const paid = tickets.filter((t) => t.status === 'paid').length;
    setConfirmedCount(confirmed);
    setPaidPendingCount(paid);
  };

  const handleVerifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputCode.trim()) return;

    const query = inputCode.trim();

    if (isOffline) {
      const match = await offlineStore.findTicket(query, selectedTripId);
      if (!match) {
        setFeedback({ type: 'error', msg: `OFFLINE ERROR: Ticket/Pass '${query}' NOT FOUND in local trip cache.` });
      } else if (match.status === 'confirmed') {
        setFeedback({ type: 'warning', msg: `⚠️ ALREADY BOARDED: Ticket ${match.code} was previously confirmed!` });
      } else {
        await offlineStore.markTicketConfirmedLocally(match.id);
        setFeedback({ type: 'success', msg: `✓ OFFLINE BOARDED SUCCESS! Code ${match.code} verified locally in PWA shell.` });
        loadManifestFromIDB();
      }
      setInputCode('');
      return;
    }

    try {
      const res = await api.confirmTicket(query, selectedTripId);
      if (res.status === 'already_boarded') {
        setFeedback({ type: 'warning', msg: res.message });
      } else {
        setFeedback({ type: 'success', msg: res.message });
        loadManifest(selectedTripId);
      }
      setInputCode('');
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Validation failed' });
    }
  };

  const handleAddCashPassenger = async () => {
    if (!stages || stages.length < 2) return;
    const bId = stages[0].id;
    const aId = stages[stages.length - 1].id;

    if (isOffline) {
      const cashTicket: OfflineTicket = {
        id: `cash_${Date.now()}`,
        code: `CS-${Math.floor(1000 + Math.random() * 9000)}`,
        trip_id: selectedTripId,
        status: 'confirmed',
        fare: 80.0,
        synced: false,
      };
      await offlineStore.addCashTicketLocally(cashTicket);
      setFeedback({ type: 'success', msg: `✓ CASH PASSENGER LOGGED LOCALLY (OFFLINE)!` });
      loadManifestFromIDB();
      return;
    }

    try {
      const t = await api.addCashPassenger({
        trip_id: selectedTripId,
        boarding_stage_id: bId,
        alighting_stage_id: aId,
        fare_amount: 80.0,
      });
      setFeedback({ type: 'success', msg: `✓ CASH PASSENGER LOGGED! Code ${t.code} recorded directly as Confirmed.` });
      loadManifest(selectedTripId);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Failed to add cash passenger' });
    }
  };

  const handleStagePushSubmit = async () => {
    setShowStagePushModal(false);
    try {
      const ticket = await api.stagePush({
        trip_id: selectedTripId,
        boarding_stage_id: pushBoardingId,
        alighting_stage_id: pushAlightingId,
        passenger_phone: pushPhone,
      });
      setFeedback({ type: 'success', msg: `📱 M-PESA STK PUSH SENT to ${pushPhone}! Ticket Code: ${ticket.code}` });
      loadManifest(selectedTripId);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Stage push failed' });
    }
  };

  const handleLogExpenseSubmit = async () => {
    setShowExpenseModal(false);
    try {
      await api.logExpense(selectedTripId, expenseCat, parseFloat(expenseAmt));
      setFeedback({ type: 'success', msg: `✓ Expense of KES ${expenseAmt} logged under ${expenseCat}` });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Expense logging failed' });
    }
  };

  const syncOfflineQueue = async () => {
    const queue = await offlineStore.getSyncQueue();
    let synced = 0;
    for (const item of queue) {
      try {
        if (item.type === 'CONFIRM_TICKET') {
          await api.confirmTicket(item.code, selectedTripId);
          synced++;
        }
      } catch (err) {
        console.error(err);
      }
    }
    await offlineStore.clearSyncQueue();
    setSyncQueueCount(0);
    setFeedback({ type: 'success', msg: `✓ BACKGROUND SYNC COMPLETE: ${synced} offline tickets pushed to backend.` });
    loadManifest(selectedTripId);
  };

  // Auth Protection Banner if not logged in
  if (!session) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-3xl mx-auto border border-amber-500/30">
            📱
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Conductor Portal Access</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Authentication required for Supermetro Conductors to access boarding scanners and cash passenger logging.
            </p>
          </div>

          <button
            onClick={() => router.push('/login?role=conductor')}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20"
          >
            Sign In to Conductor Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-1 sm:px-4">
      {/* Top Mobile Bar & Offline Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">SUPERMETRO CONDUCTOR APP</span>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Boarding & Verification</h1>
        </div>

        {/* Offline Mode Button */}
        <div className="flex items-center space-x-3 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
          <span className="text-xs font-bold text-slate-300">
            {isOffline ? '✈️ Offline Mode' : '🌐 Online'}
          </span>
          <button
            onClick={() => {
              const nextState = !isOffline;
              setIsOffline(nextState);
              if (!nextState) {
                syncOfflineQueue();
              } else {
                loadManifestFromIDB();
              }
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
              isOffline
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
            }`}
          >
            {isOffline ? 'Turn Online' : 'Toggle Offline Mode'}
          </button>
        </div>
      </div>

      {/* Sync Queue Warning Badge */}
      {syncQueueCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-2xl text-xs font-bold flex justify-between items-center">
          <span>⚠️ {syncQueueCount} boarding actions queued in IndexedDB waiting to sync</span>
          <button
            onClick={syncOfflineQueue}
            className="bg-amber-500 text-slate-950 px-3 py-1 rounded-lg text-xs font-black"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* AUTOMATIC ASSIGNED VEHICLE BANNER (NO DROPDOWN) */}
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-xl flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/30 flex items-center justify-center text-2xl font-black">
            🚌
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Assigned Vehicle & Active Trip
            </span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono">
              {currentTrip?.vehicle?.registration_plate || 'KCE 849X'}
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-black uppercase">
            Active Duty
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">
            Departure: {currentTrip ? new Date(currentTrip.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
          </span>
        </div>
      </div>

      {/* LIVE HEADCOUNT COUNTER CARDS */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-4 sm:p-6 text-center text-slate-950 shadow-2xl">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-emerald-950 block">
            CONFIRMED BOARDED
          </span>
          <span className="text-4xl sm:text-6xl font-black block tracking-tight text-white my-1">
            {confirmedCount}
          </span>
          <span className="text-[11px] font-bold text-emerald-950">Logged in DB</span>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-3xl p-4 sm:p-6 text-center text-slate-950 shadow-2xl">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-amber-950 block">
            PAID PENDING
          </span>
          <span className="text-4xl sm:text-6xl font-black block tracking-tight text-slate-950 my-1">
            {paidPendingCount}
          </span>
          <span className="text-[11px] font-bold text-amber-950">Awaiting Boarding</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 text-center shadow-2xl">
          <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-slate-400 block">
            CAPACITY
          </span>
          <span className="text-4xl sm:text-6xl font-black block tracking-tight text-white my-1">
            {capacity}
          </span>
          <span className="text-[11px] font-bold text-slate-400">33-Seater Bus</span>
        </div>
      </div>

      {/* Code Verification Input */}
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
        <h2 className="text-lg font-black text-white flex items-center space-x-2">
          <span>⚡</span>
          <span>Fast Code & Phone Verification</span>
        </h2>

        <form onSubmit={handleVerifyCode} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Enter Code (e.g. SM-8492) or Phone"
              className="flex-1 bg-slate-950 border-2 border-amber-500 text-white font-mono text-2xl font-black rounded-2xl p-4 uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-amber-500/30"
              autoFocus
            />
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-6 sm:px-8 rounded-2xl text-lg uppercase tracking-wider shadow-lg shadow-amber-500/20"
            >
              Verify
            </button>
          </div>
        </form>

        {feedback && (
          <div
            className={`p-4 rounded-2xl text-sm font-bold shadow-lg ${
              feedback.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : feedback.type === 'warning'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            {feedback.msg}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setShowStagePushModal(true)}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/20 flex flex-col items-center justify-center space-y-1 min-h-[56px]"
        >
          <span className="text-xl">📱</span>
          <span>Push M-Pesa from Stage</span>
        </button>

        <button
          onClick={handleAddCashPassenger}
          className="bg-blue-500 hover:bg-blue-400 text-slate-950 font-black py-4 rounded-2xl text-sm uppercase tracking-wider shadow-xl shadow-blue-500/20 flex flex-col items-center justify-center space-y-1 min-h-[56px]"
        >
          <span className="text-xl">💵</span>
          <span>Add Cash Passenger</span>
        </button>

        <button
          onClick={() => setShowExpenseModal(true)}
          className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl text-sm uppercase tracking-wider border border-slate-700 flex flex-col items-center justify-center space-y-1 min-h-[56px]"
        >
          <span className="text-xl">⛽</span>
          <span>Log Trip Expense</span>
        </button>
      </div>

      {/* Active Passenger Manifest Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white uppercase tracking-wider">
          Trip Ticket Manifest ({manifest.length} Total Booked)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">Ticket Code</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Method</th>
                <th className="p-3">Fare</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {manifest.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/50">
                  <td className="p-3 font-mono font-bold text-amber-400">{t.code}</td>
                  <td className="p-3 font-medium text-slate-200">{t.passenger_phone || 'Cash Rider'}</td>
                  <td className="p-3 font-semibold uppercase">{t.payment_method}</td>
                  <td className="p-3 font-bold text-white">KES {t.fare.toFixed(2)}</td>
                  <td className="p-3">
                    {t.status === 'confirmed' ? (
                      <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        ✓ Boarded
                      </span>
                    ) : (
                      <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {t.status === 'paid' && (
                      <button
                        onClick={() => {
                          setInputCode(t.code);
                          handleVerifyCode();
                        }}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded text-[10px] font-bold"
                      >
                        Board
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Door-side M-Pesa Push Modal */}
      {showStagePushModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-white">📱 Door-Side M-Pesa STK Push</h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Commuter Phone</label>
              <input
                type="text"
                value={pushPhone}
                onChange={(e) => setPushPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Boarding Stage</label>
              <select
                value={pushBoardingId}
                onChange={(e) => setPushBoardingId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-semibold"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Alighting Stage</label>
              <select
                value={pushAlightingId}
                onChange={(e) => setPushAlightingId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-semibold"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleStagePushSubmit}
                className="flex-1 bg-emerald-500 text-slate-950 font-black py-2.5 rounded-xl text-xs uppercase"
              >
                Send STK Push
              </button>
              <button
                onClick={() => setShowStagePushModal(false)}
                className="bg-slate-800 text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-white">⛽ Log Trip Expense</h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Category</label>
              <select
                value={expenseCat}
                onChange={(e) => setExpenseCat(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-semibold"
              >
                <option value="Fuel">Fuel</option>
                <option value="Stage Fee (Manamba)">Stage Fee (Manamba)</option>
                <option value="Police / Inspection">Police / Inspection</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Amount (KES)</label>
              <input
                type="number"
                value={expenseAmt}
                onChange={(e) => setExpenseAmt(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-semibold"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleLogExpenseSubmit}
                className="flex-1 bg-amber-500 text-slate-950 font-black py-2.5 rounded-xl text-xs uppercase"
              >
                Log Expense
              </button>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="bg-slate-800 text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
