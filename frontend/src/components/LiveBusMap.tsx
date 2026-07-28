'use client';

import React, { useState, useEffect } from 'react';

interface StagePoint {
  name: string;
  lat: number;
  long: number;
  sequence_order: number;
}

interface LiveBusMapProps {
  busPlate: string;
  boardingStageName: string;
  alightingStageName: string;
  simMode: 'approaching' | 'onboard';
}

const ROUTE_STAGES: StagePoint[] = [
  { name: "Nairobi CBD", lat: -1.2831, long: 36.8258, sequence_order: 1 },
  { name: "Pangani", lat: -1.2721, long: 36.8375, sequence_order: 2 },
  { name: "Muthaiga", lat: -1.2589, long: 36.8351, sequence_order: 3 },
  { name: "Survey", lat: -1.2415, long: 36.8621, sequence_order: 4 },
  { name: "Allsops", lat: -1.2325, long: 36.8770, sequence_order: 5 },
  { name: "Roysambu", lat: -1.2185, long: 36.8875, sequence_order: 6 },
  { name: "Kasarani", lat: -1.2215, long: 36.8975, sequence_order: 7 },
  { name: "Kahawa", lat: -1.1895, long: 36.9241, sequence_order: 8 },
  { name: "Githurai", lat: -1.1785, long: 36.9325, sequence_order: 9 },
  { name: "KU", lat: -1.1745, long: 36.9385, sequence_order: 10 },
  { name: "Ruiru", lat: -1.1472, long: 36.9584, sequence_order: 11 },
  { name: "Juja", lat: -1.1012, long: 37.0142, sequence_order: 12 },
  { name: "Makongeni", lat: -1.0425, long: 37.0785, sequence_order: 13 },
  { name: "Thika Town", lat: -1.0332, long: 37.0693, sequence_order: 14 },
];

export default function LiveBusMap({
  busPlate,
  boardingStageName,
  alightingStageName,
  simMode,
}: LiveBusMapProps) {
  // Bus position along progress path (0% to 100%)
  const [progressPercent, setProgressPercent] = useState<number>(35);

  useEffect(() => {
    // Smooth simulation loop animating bus location back and forth along the route segment
    const interval = setInterval(() => {
      setProgressPercent((prev) => (prev >= 90 ? 20 : prev + 2.5));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 space-y-3 relative overflow-hidden shadow-2xl">
      {/* Top Map Header */}
      <div className="flex justify-between items-center text-xs">
        <span className="font-extrabold text-amber-400 flex items-center space-x-1">
          <span>🗺️ Route 237 Express Radar</span>
        </span>
        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
          Live GPS 4G
        </span>
      </div>

      {/* Vector Map Canvas / SVG Route Graphic */}
      <div className="w-full h-56 bg-slate-900 rounded-2xl relative border border-slate-800 p-3 overflow-hidden flex flex-col justify-between">
        {/* Decorative Grid Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none"></div>

        {/* Map Polyline Route Container */}
        <div className="relative w-full h-full flex items-center justify-between px-2 z-10">
          {/* Route Connection Line */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-2 bg-slate-800 rounded-full border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500 rounded-full transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          {/* Animated Bus Icon Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -ml-5 transition-all duration-1000 z-30"
            style={{ left: `${Math.max(8, Math.min(88, progressPercent))}%` }}
          >
            <div className="relative flex flex-col items-center">
              <div className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-lg shadow-amber-500/40 whitespace-nowrap mb-1 animate-bounce">
                🚌 {busPlate}
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center shadow-2xl text-slate-950 text-xs font-black">
                🚌
              </div>
            </div>
          </div>

          {/* Stage Markers along the route */}
          <div className="relative w-full flex justify-between items-center z-20">
            {/* Start / Boarding Stage Pin */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center border-2 border-white shadow-lg">
                🚏
              </div>
              <span className="text-[10px] font-bold text-emerald-400 mt-1 text-center truncate max-w-[80px]">
                {boardingStageName || 'Board Point'}
              </span>
            </div>

            {/* Middle Landmark Pin */}
            <div className="flex flex-col items-center">
              <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-[10px] text-slate-400">
                📍
              </div>
              <span className="text-[9px] text-slate-500 font-semibold mt-1">Superhighway</span>
            </div>

            {/* Destination Stage Pin */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-rose-500 text-white font-black text-xs flex items-center justify-center border-2 border-white shadow-lg">
                🏁
              </div>
              <span className="text-[10px] font-bold text-rose-400 mt-1 text-center truncate max-w-[80px]">
                {alightingStageName || 'Destination'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Simulation Status Overlay */}
        <div className="z-10 bg-slate-950/90 border border-slate-800 p-2 rounded-xl flex justify-between items-center text-[10px]">
          <span className="text-slate-300 font-semibold">
            {simMode === 'approaching'
              ? '🚌 Bus is approaching your boarding stage'
              : '🚌 You are onboard! Bus heading to destination'}
          </span>
          <span className="font-mono text-emerald-400 font-bold">GPS ±2m</span>
        </div>
      </div>
    </div>
  );
}
