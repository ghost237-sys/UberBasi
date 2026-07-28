'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface SearchOption {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface SmartSearchSelectProps {
  options: SearchOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  label?: string;
  icon?: string;
  onDetectLocation?: () => void;
}

export default function SmartSearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Search stage or route...',
  label,
  icon = '🔍',
  onDetectLocation,
}: SmartSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            {label}
          </label>
          {onDetectLocation && (
            <button
              type="button"
              onClick={onDetectLocation}
              className="text-[11px] text-amber-400 font-bold hover:underline flex items-center space-x-1"
            >
              <span>📍 Detect Nearest</span>
            </button>
          )}
        </div>
      )}

      {/* Input / Display Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-800 border rounded-2xl p-3 text-xs sm:text-sm font-bold min-h-[48px] cursor-pointer flex items-center justify-between transition-all ${
          isOpen ? 'border-amber-500 ring-2 ring-amber-500/20 bg-slate-900' : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <span className="text-slate-400 text-sm shrink-0">{icon}</span>
          {selectedOption ? (
            <div className="truncate">
              <span className="text-white font-bold block truncate">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-[10px] text-slate-400 block font-normal truncate">
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-500 font-normal">{placeholder}</span>
          )}
        </div>
        <span className="text-slate-400 text-xs shrink-0 ml-2">▼</span>
      </div>

      {/* Smart Search Dropdown Popup */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-72 flex flex-col animate-fadeIn">
          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-950">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter..."
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-amber-500"
              autoFocus
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto divide-y divide-slate-800/60 p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((o) => (
                <div
                  key={o.id}
                  onClick={() => handleSelect(o.id)}
                  className={`p-3 rounded-xl cursor-pointer text-xs transition-all flex items-center justify-between ${
                    o.id === value
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                      : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="font-bold block truncate">{o.label}</span>
                    {o.sublabel && <span className="text-[10px] text-slate-400 block">{o.sublabel}</span>}
                  </div>
                  {o.badge && (
                    <span className="bg-slate-800 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded text-[10px] font-bold shrink-0">
                      {o.badge}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 font-semibold">
                No matching stages or routes found for &quot;{query}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
