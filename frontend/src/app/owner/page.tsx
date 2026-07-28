'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, OwnerDashboardData, UserSession } from '@/lib/api';

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);

  const [data, setData] = useState<OwnerDashboardData | null>(null);

  useEffect(() => {
    const current = api.getCurrentSession();
    setSession(current);
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.getOwnerDashboard();
      setData(res);
    } catch (err) {
      console.error(err);
    }
  };

  // Auth Protection Banner if not logged in
  if (!session) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-3xl mx-auto border border-amber-500/30">
            📊
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Vehicle Owner Portal</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Authentication required for Vehicle Owners to view occupancy, waybills, and net revenue handover powered by UberBasi.
            </p>
          </div>

          <button
            onClick={() => router.push('/login?role=vehicle_owner')}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20"
          >
            Sign In to Owner Portal
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-bold text-slate-400">Loading Fleet & Revenue Reconciliation Engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">
            UBERBASI MANAGED FLEET PORTAL
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Vehicle Revenue & Waybill Reconciliation</h1>
        </div>
        <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-right">
          <span className="text-[10px] font-extrabold text-slate-400 block uppercase">POWERED BY</span>
          <span className="text-xs font-black text-amber-400">UberBasi Tech SaaS</span>
        </div>
      </div>

      {/* METRIC CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">GROSS REVENUE</span>
          <span className="text-3xl font-black text-white mt-1 block">KES {data.gross_revenue.toFixed(2)}</span>
          <div className="flex justify-between text-xs mt-3 pt-2 border-t border-slate-800">
            <span className="text-emerald-400 font-bold">M-Pesa: KES {data.total_mpesa_revenue.toFixed(2)}</span>
            <span className="text-blue-400 font-bold">Cash: KES {data.total_cash_revenue.toFixed(2)}</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">WAYBILL EXPENSES</span>
          <span className="text-3xl font-black text-rose-400 mt-1 block">KES {data.total_expenses.toFixed(2)}</span>
          <span className="text-[11px] font-semibold text-slate-400 mt-3 block pt-2 border-t border-slate-800">
            Fuel + Stage Fees (&quot;Manamba&quot;)
          </span>
        </div>

        {/* Net Cash Handover */}
        <div className="bg-gradient-to-tr from-emerald-600 to-teal-700 rounded-3xl p-6 shadow-2xl text-slate-950">
          <span className="text-xs font-black uppercase tracking-wider block text-emerald-950">NET CASH HANDOVER</span>
          <span className="text-3xl font-black text-white mt-1 block">KES {data.net_handover.toFixed(2)}</span>
          <span className="text-[11px] font-bold text-emerald-950 mt-3 block pt-2 border-t border-emerald-950/20">
            Gross Revenue - Expenses = Net
          </span>
        </div>

        {/* Leakage Gap Card */}
        <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider block">LEAKAGE GAP SIGNAL</span>
          <span className="text-3xl font-black text-amber-300 mt-1 block">{data.total_paid_pending} Pending</span>
          <span className="text-[11px] font-semibold text-slate-300 mt-3 block pt-2 border-t border-slate-800">
            Tickets paid digitally but not yet boarded by conductor
          </span>
        </div>
      </div>

      {/* CASH VS DIGITAL RECONCILIATION CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-black text-white flex items-center space-x-2">
          <span>🔍</span>
          <span>Cash vs. Digital Headcount Reconciliation</span>
        </h2>
        <p className="text-xs text-slate-400">
          Headcount verification prevents crew cash-pocketing. Digital tickets must match total verified onboard headcount.
        </p>

        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">M-PESA DIGITAL BOARDED</span>
            <span className="text-4xl font-black text-white my-1 block">{data.total_confirmed_boarded}</span>
            <span className="text-[10px] text-slate-400">Verified via QR / Ticket Code</span>
          </div>

          <div className="flex items-center justify-center font-black text-2xl text-slate-600">
            +
          </div>

          <div>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">LOGGED CASH BOARDED</span>
            <span className="text-4xl font-black text-white my-1 block">
              {data.vehicles.reduce((acc, v) => acc + Math.round(v.cash_revenue / 80), 0)}
            </span>
            <span className="text-[10px] text-slate-400">Conductor Cash Entries</span>
          </div>
        </div>
      </div>

      {/* DAILY WAYBILL BREAKDOWN BY VEHICLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-black text-white">Daily Vehicle Waybill Table</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">Vehicle Plate</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Capacity</th>
                <th className="p-3">Boarded Count</th>
                <th className="p-3">Occupancy</th>
                <th className="p-3">M-Pesa Revenue</th>
                <th className="p-3">Cash Revenue</th>
                <th className="p-3">Waybill Expenses</th>
                <th className="p-3">Net Handover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.vehicles.map((v) => (
                <tr key={v.vehicle_id} className="hover:bg-slate-800/50">
                  <td className="p-3 font-mono font-bold text-amber-400">{v.registration_plate}</td>
                  <td className="p-3 font-semibold text-slate-200">{v.owner_name}</td>
                  <td className="p-3 text-slate-400">{v.capacity} Seats</td>
                  <td className="p-3 font-bold text-white">{v.confirmed_boarded} Passengers</td>
                  <td className="p-3">
                    <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                      {v.occupancy_rate}%
                    </span>
                  </td>
                  <td className="p-3 font-bold text-emerald-400">KES {v.mpesa_revenue.toFixed(2)}</td>
                  <td className="p-3 font-bold text-blue-400">KES {v.cash_revenue.toFixed(2)}</td>
                  <td className="p-3 font-black text-rose-400">KES {v.expenses.toFixed(2)}</td>
                  <td className="p-3 font-black text-emerald-300">KES {v.net_handover.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
