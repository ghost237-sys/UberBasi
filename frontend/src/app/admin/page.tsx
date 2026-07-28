'use client';

import React, { useState, useEffect } from 'react';
import { api, Route, FareRule, Trip, BillingSummary } from '@/lib/api';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'fare_rules' | 'surge' | 'sacco_billing'>('sacco_billing');

  const [routes, setRoutes] = useState<Route[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);

  // New Fare Rule Form State
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [minSeq, setMinSeq] = useState<number>(1);
  const [maxSeq, setMaxSeq] = useState<number>(11);
  const [fareAmt, setFareAmt] = useState<number>(80);

  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const rList = await api.getRoutes();
      setRoutes(rList);
      if (rList.length > 0) {
        setSelectedRouteId(rList[0].id);
      }
      const tList = await api.getTrips();
      setTrips(tList);
      const bSummary = await api.getBillingSummary();
      setBillingSummary(bSummary);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFareRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (minSeq >= maxSeq) {
      setFeedback('Error: Minimum Stage Sequence must be strictly less than Maximum Stage Sequence');
      return;
    }

    try {
      await api.createFareRule({
        route_id: selectedRouteId,
        min_stage_sequence: minSeq,
        max_stage_sequence: maxSeq,
        fare_amount: fareAmt
      });
      setFeedback('✓ Fare Rule Created Successfully!');
      loadData();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    }
  };

  const handleDeleteFareRule = async (ruleId: string) => {
    try {
      await api.deleteFareRule(ruleId);
      setFeedback('✓ Fare Rule Deleted!');
      loadData();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    }
  };

  const handleToggleSurge = async (tripId: string, currentSurge: number) => {
    const nextSurge = currentSurge > 1.0 ? 1.0 : 1.25;
    try {
      await api.toggleSurge(tripId, nextSurge);
      setFeedback(`✓ Surge multiplier updated to ${nextSurge}x for trip ${tripId}`);
      loadData();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      const inv = await api.generateInvoice();
      setFeedback(`✓ SACCO Invoice Generated! ID: ${inv.id}. Total Due: KES ${inv.total_platform_fees_due}`);
      loadData();
    } catch (err: any) {
      setFeedback(`Error generating invoice: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">PLATFORM OPERATOR PANEL</span>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Admin, Fare Rules & Usage Billing Engine</h1>
        </div>

        <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-amber-500/30 text-xs font-bold text-amber-400">
          Role: Admin (Exclusive Permission)
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl text-xs font-bold">
          {feedback}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('sacco_billing')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'sacco_billing'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900/50'
          }`}
        >
          📈 Platform Usage & SACCO Billing Ledger
        </button>
        <button
          onClick={() => setActiveTab('fare_rules')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'fare_rules'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900/50'
          }`}
        >
          ⚙️ Editable Fare Rules Table
        </button>
        <button
          onClick={() => setActiveTab('surge')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'surge'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900/50'
          }`}
        >
          ⚡ Dynamic Corridor Surge Pricing
        </button>
      </div>

      {/* TAB 1: SACCO BILLING LEDGER (Pitch Core Requirement 5) */}
      {activeTab === 'sacco_billing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Live Billable Seats Counter */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                LIVE BILLABLE SEATS BOOKED TODAY
              </span>
              <span className="text-4xl font-black text-white mt-1 block">
                {billingSummary?.total_billable_seats || 0} Seats
              </span>
              <span className="text-[11px] text-slate-400 block mt-2">
                Logged 1:1 in Immutable Billing Ledger
              </span>
            </div>

            {/* Accrued Platform Revenue */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl">
              <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider block">
                ACCRUED PLATFORM COMMISSION
              </span>
              <span className="text-4xl font-black text-amber-300 mt-1 block">
                KES {billingSummary?.total_platform_fees_due.toFixed(2) || '0.00'}
              </span>
              <span className="text-[11px] text-slate-300 block mt-2">
                Rate: KES {billingSummary?.rate_per_booking.toFixed(2)} per confirmed seat
              </span>
            </div>

            {/* Total Fare Processed */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                TOTAL FARE PROCESSED
              </span>
              <span className="text-4xl font-black text-emerald-400 mt-1 block">
                KES {billingSummary?.total_fare_processed.toFixed(2) || '0.00'}
              </span>
              <span className="text-[11px] text-slate-400 block mt-2">
                Pass & Single Ride Gross Volume
              </span>
            </div>
          </div>

          {/* Automated Weekly Statement Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-white">Itemized Usage Statement by Vehicle Plate</h2>
                <p className="text-xs text-slate-400">Auditable platform ledger breaking down KES 3.00 seat fees per bus</p>
              </div>
              <button
                onClick={handleGenerateInvoice}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase shadow-lg"
              >
                Generate SACCO Weekly Statement
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Vehicle Plate</th>
                    <th className="p-3">Confirmed Seats Booked</th>
                    <th className="p-3">Fee Rate</th>
                    <th className="p-3">Platform Fees Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {billingSummary?.vehicle_breakdown.map((v) => (
                    <tr key={v.vehicle_id} className="hover:bg-slate-800/50">
                      <td className="p-3 font-mono font-bold text-amber-400">{v.registration_plate}</td>
                      <td className="p-3 font-bold text-white">{v.billable_seats} Bookings</td>
                      <td className="p-3 text-slate-400">KES 3.00 / booking</td>
                      <td className="p-3 font-black text-emerald-400">KES {v.platform_fees_due.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EDITABLE FARE RULES TABLE */}
      {activeTab === 'fare_rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Create Rule Form */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-black text-white">Create New Stage-Range Fare Rule</h2>
            <form onSubmit={handleCreateFareRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Route</label>
                <select
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-semibold"
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Min Stage Seq</label>
                  <input
                    type="number"
                    value={minSeq}
                    onChange={(e) => setMinSeq(parseInt(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Max Stage Seq</label>
                  <input
                    type="number"
                    value={maxSeq}
                    onChange={(e) => setMaxSeq(parseInt(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Fare Amount (KES)</label>
                <input
                  type="number"
                  value={fareAmt}
                  onChange={(e) => setFareAmt(parseFloat(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl text-xs uppercase"
              >
                Save Fare Rule
              </button>
            </form>
          </div>

          {/* List Existing Rules */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-black text-white">Active Corridor Fare Rules</h2>
            <div className="space-y-3">
              {routes.map((r) => (
                <div key={r.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <span className="font-bold text-amber-400 text-sm">{r.name}</span>
                  <div className="space-y-2">
                    {r.fare_rules.map((rule) => (
                      <div key={rule.id} className="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs">
                        <div>
                          <span className="font-bold text-white">Stages {rule.min_stage_sequence} ➔ {rule.max_stage_sequence}</span>
                          <span className="text-slate-400 ml-2">Flat Rate</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-black text-emerald-400 text-sm">KES {rule.fare_amount.toFixed(2)}</span>
                          <button
                            onClick={() => handleDeleteFareRule(rule.id)}
                            className="bg-rose-500/20 text-rose-300 px-2 py-1 rounded hover:bg-rose-500/30 text-[10px] font-bold"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DYNAMIC SURGE PRICING */}
      {activeTab === 'surge' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-black text-white">Dynamic Corridor Surge Toggle</h2>
          <p className="text-xs text-slate-400">
            Override fares dynamically during rain, CBD rush hour, or heavy traffic jams at Survey/Ruiru.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((t) => (
              <div key={t.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-black text-amber-400">{t.vehicle?.registration_plate}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    t.surge_multiplier > 1.0 ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {t.surge_multiplier}x Surge
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Departure: {new Date(t.departure_time).toLocaleTimeString()}
                </div>
                <button
                  onClick={() => handleToggleSurge(t.id, t.surge_multiplier)}
                  className={`w-full py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    t.surge_multiplier > 1.0
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-400'
                  }`}
                >
                  {t.surge_multiplier > 1.0 ? 'Disable Peak Surge' : 'Activate Peak Surge (+25%)'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
