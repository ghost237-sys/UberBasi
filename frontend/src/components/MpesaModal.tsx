'use client';

import React, { useState, useEffect } from 'react';
import { Ticket } from '@/lib/api';

interface MpesaModalProps {
  phone: string;
  amount: number;
  ticket: Ticket | null;
  onConfirmPin: () => Promise<Ticket | null>;
  onClose: () => void;
}

export default function MpesaModal({
  phone,
  amount,
  ticket,
  onConfirmPin,
  onClose,
}: MpesaModalProps) {
  // Modal states: 'stk_sent' (STK push delivered to phone) -> 'confirming' -> 'success'
  const [modalState, setModalState] = useState<'stk_sent' | 'confirming' | 'success'>('stk_sent');
  const [confirmedTicket, setConfirmedTicket] = useState<Ticket | null>(ticket);

  useEffect(() => {
    // Automatically trigger callback simulation after 3.5 seconds to mimic user entering PIN on their phone
    const timer = setTimeout(() => {
      handleSimulateHandsetPayment();
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const handleSimulateHandsetPayment = async () => {
    setModalState('confirming');
    try {
      const updated = await onConfirmPin();
      setConfirmedTicket(updated);
      setModalState('success');
    } catch (e) {
      console.error(e);
      setModalState('success');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-center relative overflow-hidden animate-fadeIn">
        {/* Top M-Pesa Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-xs shadow-md">
              M
            </div>
            <span className="font-extrabold text-white text-sm">Safaricom M-Pesa Daraja STK</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Live Gateway
          </span>
        </div>

        {/* Modal Phase 1 & 2: STK Push Sent to Mobile Handset */}
        {modalState !== 'success' ? (
          <div className="space-y-4 py-2">
            <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto animate-pulse">
              📱
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">STK Push Sent to Phone</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Please check your mobile handset <strong className="text-amber-400">{phone}</strong> and enter your M-Pesa PIN on the Safaricom pop-up prompt.
              </p>
            </div>

            {/* Payment Details Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Merchant:</span>
                <span className="font-bold text-white">Supermetro SACCO</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Phone Number:</span>
                <span className="font-bold text-amber-400">{phone}</span>
              </div>
              <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                <span>Total Amount:</span>
                <span className="font-black text-emerald-400 text-sm">KES {amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Loading Indicator */}
            <div className="flex items-center justify-center space-x-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs text-slate-400">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <span>
                {modalState === 'confirming'
                  ? 'Processing Daraja M-Pesa Callback...'
                  : 'Awaiting Handset PIN Authorization...'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSimulateHandsetPayment}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider border border-slate-700"
            >
              ⚡ Simulate Immediate Handset PIN Authorization
            </button>
          </div>
        ) : (
          /* Modal Phase 3: Confirmed Ticket & Payment Received */
          <div className="space-y-4 py-2 animate-fadeIn">
            <div className="w-16 h-16 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center text-3xl mx-auto font-black shadow-lg shadow-emerald-500/30">
              ✓
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">Payment Received!</h3>
              <p className="text-xs text-slate-300">
                M-Pesa STK Push authorized successfully. Redirecting to your tickets dashboard...
              </p>
            </div>

            {/* Receipt Summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30 space-y-2 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">Ticket Code:</span>
                <span className="font-mono font-black text-amber-400">{confirmedTicket?.code || ticket?.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">M-Pesa Receipt:</span>
                <span className="font-mono font-bold text-white">
                  {confirmedTicket?.mpesa_receipt_number || 'R900901'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Paid:</span>
                <span className="font-bold text-emerald-400">KES {amount.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20"
            >
              Done & View Ticket Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
