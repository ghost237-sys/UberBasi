'use client';

import React from 'react';
import { Ticket } from '@/lib/api';

interface TicketCardProps {
  ticket: Ticket;
}

export default function TicketCard({ ticket }: TicketCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Paid — Pending Boarding</span>;
      case 'confirmed':
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">✓ Boarded / Confirmed</span>;
      case 'pending_payment':
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Payment Pending</span>;
      default:
        return <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden text-white max-w-md mx-auto">
      {/* Decorative Top Accent */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600"></div>

      <div className="flex justify-between items-start mb-4 pt-1">
        <div>
          <span className="text-slate-400 text-xs font-medium uppercase tracking-widest block">SUPERMETRO ROUTE 237</span>
          <h3 className="text-3xl font-black tracking-tight text-amber-400 font-mono">{ticket.code}</h3>
        </div>
        {getStatusBadge(ticket.status)}
      </div>

      {/* QR Code Section */}
      {ticket.qr_code_base64 && (
        <div className="bg-white p-3 rounded-xl w-48 h-48 mx-auto my-4 flex items-center justify-center shadow-lg border-2 border-amber-400/30">
          <img src={ticket.qr_code_base64} alt={`QR Code ${ticket.code}`} className="w-full h-full object-contain" />
        </div>
      )}

      {/* Journey Detail */}
      <div className="bg-slate-800/80 rounded-xl p-4 my-4 border border-slate-700/60 space-y-3">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">BOARDING STAGE</span>
            <span className="text-sm font-bold text-slate-100">{ticket.boarding_stage?.name || 'Nairobi CBD (Odeon)'}</span>
          </div>
        </div>

        <div className="ml-1.5 pl-3 border-l-2 border-dashed border-slate-600 h-4"></div>

        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-amber-400"></div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">ALIGHTING STAGE</span>
            <span className="text-sm font-bold text-slate-100">{ticket.alighting_stage?.name || 'Thika Town'}</span>
          </div>
        </div>
      </div>

      {/* Meta Footer */}
      <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800">
        <div>
          <span className="block text-[10px] font-semibold text-slate-500 uppercase">FARE PAID</span>
          <span className="text-base font-bold text-emerald-400">KES {ticket.fare.toFixed(2)}</span>
        </div>
        <div className="text-right">
          <span className="block text-[10px] font-semibold text-slate-500 uppercase">PAYMENT METHOD</span>
          <span className="font-semibold text-slate-200 uppercase">{ticket.payment_method}</span>
        </div>
      </div>
    </div>
  );
}
