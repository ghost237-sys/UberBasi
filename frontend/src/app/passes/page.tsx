'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, Route, Subscription, UserSession } from '@/lib/api';

export default function PassesPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);

  // Registration & Login Form State for unauthenticated users
  const [isRegistering, setIsRegistering] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [phone, setPhone] = useState<string>('+254712345678');
  const [password, setPassword] = useState<string>('');

  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [riderName, setRiderName] = useState<string>('Wanjiru Mwangi');

  const [activeSub, setActiveSub] = useState<Subscription | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const current = api.getCurrentSession();
    setSession(current);
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const data = await api.getRoutes();
      setRoutes(data);
      if (data.length > 0) setSelectedRouteId(data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegisterOrLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback(null);

    try {
      if (isRegistering) {
        await api.register({
          username,
          phone,
          password,
          role: 'passenger',
        });
        const loginData = await api.login(username, password);
        setSession(loginData);
        setFeedback({ type: 'success', msg: '✓ Account created successfully! You can now book your monthly pass.' });
      } else {
        const loginData = await api.login(username, password);
        setSession(loginData);
        setFeedback({ type: 'success', msg: '✓ Logged in successfully!' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Authentication failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchasePass = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const sub = await api.purchasePass({
        rider_name: riderName || (session ? session.username : 'Pass Rider'),
        rider_phone: phone,
        route_id: selectedRouteId,
        days: 30,
      });
      setActiveSub(sub);
      setFeedback({ type: 'success', msg: `🎉 Monthly Pass Activated! Valid for 30 Days on Route 237.` });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Pass purchase failed' });
    } finally {
      setIsLoading(false);
    }
  };

  // If user is not logged in, prompt for Account Registration to book pass
  if (!session) {
    return (
      <div className="max-w-md mx-auto py-6 px-2 space-y-6 pb-24">
        <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center text-3xl mx-auto border border-amber-500/30">
            💳
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-white">Monthly Subscription Pass</h1>
            <p className="text-xs text-slate-400">
              Register a passenger account to unlock 30-day unlimited corridor travel on Supermetro Route 237.
            </p>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold ${
                feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {feedback.msg}
            </div>
          )}

          {/* Account Registration / Login Form */}
          <form onSubmit={handleRegisterOrLogin} className="space-y-3 text-left">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. wanjiru_commuter"
                required
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {isRegistering && (
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  M-Pesa Mobile Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+2547..."
                  required
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20"
            >
              {isLoading
                ? 'Processing...'
                : isRegistering
                ? 'Register Account & Book Pass'
                : 'Log In & Book Pass'}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-xs text-amber-400 font-bold hover:underline"
            >
              {isRegistering
                ? 'Already have an account? Log In'
                : "Don't have an account? Register Now"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Monthly Pass View
  return (
    <div className="max-w-md mx-auto py-6 px-2 space-y-6 pb-24">
      <div className="bg-gradient-to-r from-amber-500 to-yellow-500 rounded-3xl p-6 text-slate-950 shadow-2xl space-y-2">
        <span className="bg-slate-950/20 text-slate-950 font-extrabold px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
          Unlimited Corridor Pass
        </span>
        <h1 className="text-2xl font-black tracking-tight">Supermetro Monthly Pass</h1>
        <p className="text-slate-900 text-xs font-semibold">
          Enjoy 30 days of unlimited rides across all Route 237 stages for a flat KES 3,000.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-bold shadow-lg ${
            feedback.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Pass Subscription Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
        <h2 className="text-sm font-black text-white uppercase tracking-wider">
          💳 Activate 30-Day Commuter Pass
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              Commuter Full Name
            </label>
            <input
              type="text"
              value={riderName}
              onChange={(e) => setRiderName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              Select Corridor Route
            </label>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-amber-500"
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Validity Period</span>
              <span className="font-bold text-white">30 Days Unlimited</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pass Subscription Price</span>
              <span className="font-black text-amber-400 text-sm">KES 3,000.00</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePurchasePass}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 text-xs uppercase tracking-wider"
          >
            {isLoading ? 'Activating Pass...' : 'Pay KES 3,000 via M-Pesa'}
          </button>
        </div>
      </div>

      {activeSub && (
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-5 text-slate-950 shadow-2xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-950">
              ✓ ACTIVE SUPERMETRO PASS
            </span>
            <span className="bg-emerald-950 text-emerald-300 text-[9px] font-bold px-2 py-0.5 rounded-full">
              30 Days Valid
            </span>
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-950 block">Pass Holder:</span>
            <span className="text-lg font-black text-white">{activeSub.rider_name}</span>
          </div>

          <div className="text-xs font-mono text-emerald-950 pt-2 border-t border-emerald-950/20 flex justify-between">
            <span>Valid Until:</span>
            <span className="font-bold text-white">{new Date(activeSub.valid_until).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
