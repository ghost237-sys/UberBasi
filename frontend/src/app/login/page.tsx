'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inferredRole = searchParams.get('role') || 'conductor';

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (activeTab === 'login') {
        const session = await api.login(username, password);
        redirectUser(session.role);
      } else {
        await api.register({
          username,
          phone,
          password,
          role: inferredRole,
        });
        const session = await api.login(username, password);
        redirectUser(session.role);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const redirectUser = (userRole: string) => {
    if (userRole === 'conductor') {
      router.push('/conductor');
    } else if (userRole === 'vehicle_owner') {
      router.push('/owner');
    } else if (userRole === 'admin') {
      router.push('/admin');
    } else {
      router.push('/');
    }
  };

  const getPortalTitle = () => {
    if (inferredRole === 'conductor') return '📱 Conductor Portal Login';
    if (inferredRole === 'vehicle_owner') return '🚌 Vehicle Owner Portal Login';
    if (inferredRole === 'admin') return '⚙️ UberBasi Platform Tech Admin';
    return 'UberBasi Portal Login';
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center font-black text-slate-950 text-2xl mx-auto shadow-lg shadow-amber-500/20">
            UB
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">{getPortalTitle()}</h1>
          <p className="text-xs text-slate-400 font-medium">
            UberBasi Core Transit Engine Access
          </p>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError('');
            }}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'login'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setError('');
            }}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'register'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register Account
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-2xl text-xs font-semibold flex items-center space-x-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-xl p-3 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Phone Input for Registration */}
          {activeTab === 'register' && (
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+2547..."
                required
                className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-xl p-3 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Password Input */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-xl p-3 pr-10 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-semibold"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-xl shadow-amber-500/20 transition-all min-h-[48px] mt-2"
          >
            {isLoading
              ? 'Authenticating...'
              : activeTab === 'login'
              ? 'Sign In'
              : 'Register Account'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <span className="text-[11px] text-slate-500">
            Powered by UberBasi Tech Engine • SSL Encrypted
          </span>
        </div>
      </div>
    </div>
  );
}
