'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, Route, Stage, Ticket, Trip } from '@/lib/api';
import MpesaModal from '@/components/MpesaModal';
import SmartSearchSelect, { SearchOption } from '@/components/SmartSearchSelect';

export default function PassengerPage() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [stages, setStages] = useState<Stage[]>([]);

  // Travel Direction Toggle: 'inbound' (Towards Nairobi CBD) vs 'outbound' (Towards Thika Town / Corridor End)
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('inbound');
  
  const [boardingStageId, setBoardingStageId] = useState<string>('');
  const [alightingStageId, setAlightingStageId] = useState<string>('');
  const [passengerPhone, setPassengerPhone] = useState<string>('+254712345678');
  const [ticketCount, setTicketCount] = useState<number>(1);
  
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');

  const [fareQuote, setFareQuote] = useState<{
    base_fare: number;
    surge_multiplier: number;
    final_fare: number;
    direction: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [bookingTicket, setBookingTicket] = useState<Ticket | null>(null);
  const [showMpesaModal, setShowMpesaModal] = useState<boolean>(false);
  const [stkCheckoutId, setStkCheckoutId] = useState<string>('');

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const data = await api.getRoutes();
      setRoutes(data);
      if (data.length > 0) {
        setSelectedRouteId(data[0].id);
        const sortedStages = [...data[0].stages].sort((a, b) => a.sequence_order - b.sequence_order);
        setStages(sortedStages);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to connect to backend server. Make sure FastAPI backend is running.');
    }
  };

  // Reset alighting stage if invalid when direction or boarding stage changes
  useEffect(() => {
    if (!boardingStageId) return;
    const bStage = stages.find((s) => s.id === boardingStageId);
    if (!bStage) return;

    if (alightingStageId) {
      const aStage = stages.find((s) => s.id === alightingStageId);
      if (aStage) {
        if (direction === 'inbound' && aStage.sequence_order >= bStage.sequence_order) {
          setAlightingStageId('');
        } else if (direction === 'outbound' && aStage.sequence_order <= bStage.sequence_order) {
          setAlightingStageId('');
        }
      }
    }
  }, [direction, boardingStageId, stages]);

  const loadTripsForBoardingStage = async (routeId: string, bStageId: string, dir: string) => {
    try {
      const data = await api.getTrips(routeId, bStageId);
      const matchingTrips = dir
        ? data.filter((t) => !t.direction || t.direction === dir)
        : data;

      const finalTrips = matchingTrips.length > 0 ? matchingTrips : data;
      setTrips(finalTrips);
      if (finalTrips.length > 0) {
        setSelectedTripId(finalTrips[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setErrorMsg('');
    if (selectedRouteId && boardingStageId && alightingStageId) {
      calculateFareAndLoadBuses();
    } else {
      setFareQuote(null);
      setTrips([]);
    }
  }, [selectedRouteId, boardingStageId, alightingStageId, direction]);

  const calculateFareAndLoadBuses = async () => {
    setErrorMsg('');
    const bStage = stages.find((s) => s.id === boardingStageId);
    const aStage = stages.find((s) => s.id === alightingStageId);

    if (bStage && aStage && bStage.id === aStage.id) {
      setErrorMsg('Boarding stage and alighting stage cannot be identical.');
      setFareQuote(null);
      setTrips([]);
      return;
    }

    try {
      const quote = await api.quoteFare(selectedRouteId, boardingStageId, alightingStageId);
      setFareQuote({
        base_fare: quote.base_fare,
        surge_multiplier: quote.surge_multiplier,
        final_fare: quote.final_fare,
        direction: direction,
      });

      loadTripsForBoardingStage(selectedRouteId, boardingStageId, direction);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error calculating fare');
    }
  };

  const suggestNearestStage = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          let closest = stages[0];
          let minDistance = Infinity;
          stages.forEach((s) => {
            const dist = Math.hypot(s.lat - pos.coords.latitude, s.long - pos.coords.longitude);
            if (dist < minDistance) {
              minDistance = dist;
              closest = s;
            }
          });
          if (closest) {
            setBoardingStageId(closest.id);
          }
        },
        () => {
          if (stages.length > 0) setBoardingStageId(stages[0].id);
        }
      );
    }
  };

  const handleStartBooking = async () => {
    if (!selectedTripId) {
      setErrorMsg('Please select an available Supermetro bus from the list.');
      return;
    }
    if (!fareQuote) {
      setErrorMsg('Please select valid boarding & alighting stages first.');
      return;
    }

    try {
      const ticket = await api.bookTicket({
        trip_id: selectedTripId,
        boarding_stage_id: boardingStageId,
        alighting_stage_id: alightingStageId,
        passenger_phone: passengerPhone,
        ticket_count: ticketCount,
        payment_method: 'mpesa',
      });
      setBookingTicket(ticket);
      setStkCheckoutId(ticket.checkout_request_id || '');
      setShowMpesaModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Booking failed');
    }
  };

  const handleAuthorizePin = async (): Promise<Ticket | null> => {
    if (!stkCheckoutId) return bookingTicket;
    try {
      const confirmed = await api.simulateMpesaCallback(stkCheckoutId, 'SUCCESS');
      setBookingTicket(confirmed);

      // Save confirmed ticket locally so My Tickets dashboard displays it immediately
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('uberbasi_my_tickets');
        const list: Ticket[] = stored ? JSON.parse(stored) : [];
        list.unshift(confirmed);
        localStorage.setItem('uberbasi_my_tickets', JSON.stringify(list));
        localStorage.setItem('uberbasi_active_phone', passengerPhone);
      }
      return confirmed;
    } catch (err) {
      console.error(err);
      return bookingTicket;
    }
  };

  const handleCloseModalAndRedirect = () => {
    setShowMpesaModal(false);
    router.push('/tickets');
  };

  const routeOptions: SearchOption[] = routes.map((r) => ({
    id: r.id,
    label: r.name,
    sublabel: r.description,
    badge: r.code,
  }));

  // SMART FILTER 1: Boarding Stage options based on direction
  const filteredBoardingStages = stages.filter((s) => {
    if (direction === 'inbound') {
      // Inbound to CBD: Boarding point must be stage 2 or higher (cannot board at CBD to go to CBD)
      return s.sequence_order > 1;
    } else {
      // Outbound to Thika: Boarding point must be before last stage (cannot board at Thika Town to go further)
      return s.sequence_order < stages.length;
    }
  });

  const boardingStageOptions: SearchOption[] = filteredBoardingStages.map((s) => ({
    id: s.id,
    label: `${s.sequence_order}. ${s.name}`,
    sublabel: `Stage #${s.sequence_order} on Corridor`,
  }));

  // SMART FILTER 2: Alighting Stage options MUST ONLY show downstream stops!
  const selectedBoardingStage = stages.find((s) => s.id === boardingStageId);
  
  const filteredAlightingStages = stages.filter((s) => {
    if (!selectedBoardingStage) return true;

    if (direction === 'inbound') {
      // Heading to Nairobi CBD: Only show stops BEFORE boarding stage (downstream to CBD)
      return s.sequence_order < selectedBoardingStage.sequence_order;
    } else {
      // Heading to Thika Town / Outbound: Only show stops AFTER boarding stage (downstream to Thika)
      return s.sequence_order > selectedBoardingStage.sequence_order;
    }
  });

  const alightingStageOptions: SearchOption[] = filteredAlightingStages.map((s) => ({
    id: s.id,
    label: `${s.sequence_order}. ${s.name}`,
    sublabel: `Stage #${s.sequence_order} on Corridor`,
  }));

  const totalCalculatedFare = fareQuote ? roundTwo(fareQuote.final_fare * ticketCount) : 0;

  function roundTwo(val: number) {
    return Math.round(val * 100) / 100;
  }

  return (
    <div className="pb-24 max-w-lg mx-auto space-y-4 px-1 sm:px-2">
      {/* Compact Mobile Banner Header */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 rounded-2xl p-4 text-slate-950 shadow-xl flex justify-between items-center">
        <div>
          <span className="bg-slate-950/20 text-slate-950 font-black px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider block w-fit">
            Supermetro Corridor
          </span>
          <h1 className="text-xl font-black tracking-tight mt-0.5">Passenger Dashboard</h1>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-900 block">Route 237</span>
          <span className="text-xs font-black text-slate-950">Express Corridor</span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-2xl text-xs font-semibold flex items-center space-x-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Single-Screen Booking Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-4">
        
        {/* SMART DIRECTION TOGGLE: Inbound to CBD vs Outbound to Thika */}
        <div className="space-y-1 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block px-1">
            🛣️ Select Corridor Direction:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setDirection('inbound');
                setBoardingStageId('');
                setAlightingStageId('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                direction === 'inbound'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🏢 To Nairobi CBD (Inbound)
            </button>

            <button
              type="button"
              onClick={() => {
                setDirection('outbound');
                setBoardingStageId('');
                setAlightingStageId('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                direction === 'outbound'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🚌 To Thika / Juja (Outbound)
            </button>
          </div>
        </div>

        {/* STEP 1: SMART STAGE SEARCH & DOWNSTREAM FILTERING */}
        <div className="space-y-3">
          <SmartSearchSelect
            label="Route Corridor"
            options={routeOptions}
            value={selectedRouteId}
            onChange={(id) => {
              setSelectedRouteId(id);
              const r = routes.find((rt) => rt.id === id);
              if (r) {
                const sorted = [...r.stages].sort((a, b) => a.sequence_order - b.sequence_order);
                setStages(sorted);
                setBoardingStageId('');
                setAlightingStageId('');
              }
            }}
            placeholder="Search route..."
            icon="🛣️"
          />

          <SmartSearchSelect
            label="Boarding Stage (Board Point)"
            options={boardingStageOptions}
            value={boardingStageId}
            onChange={(id) => {
              setBoardingStageId(id);
              setAlightingStageId('');
            }}
            placeholder={`Search boarding stage (${direction === 'inbound' ? 'e.g. Juja, Ruiru, Roysambu' : 'e.g. Nairobi CBD, Pangani, Allsops'})...`}
            icon="🚏"
            onDetectLocation={suggestNearestStage}
          />

          <SmartSearchSelect
            label="Alighting Stage (Bus Stop)"
            options={alightingStageOptions}
            value={alightingStageId}
            onChange={setAlightingStageId}
            placeholder={
              boardingStageId
                ? `Showing downstream stops towards ${direction === 'inbound' ? 'Nairobi CBD' : 'Thika / Makongeni'}...`
                : 'Select boarding stage first to reveal downstream stops...'
            }
            icon="🏁"
          />
        </div>

        {/* MULTIPLE TICKETS / SEAT COUNT SELECTOR */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
          <div>
            <span className="text-xs font-bold text-slate-200 block">Number of Passengers / Seats</span>
            <span className="text-[10px] text-slate-400">Book multiple seats in one M-Pesa transaction</span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-base flex items-center justify-center touch-manipulation"
            >
              -
            </button>
            <span className="w-6 text-center font-black text-amber-400 text-sm">{ticketCount}</span>
            <button
              type="button"
              onClick={() => setTicketCount(Math.min(5, ticketCount + 1))}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-base flex items-center justify-center touch-manipulation"
            >
              +
            </button>
          </div>
        </div>

        {/* STEP 2: CLOSEST BUSES LIST */}
        {boardingStageId && alightingStageId && fareQuote ? (
          <div className="space-y-3 pt-2 border-t border-slate-800 animate-fadeIn">
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold text-white flex items-center space-x-1">
                <span>🚌 Closest Approaching Buses</span>
              </span>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                {direction === 'inbound' ? 'To CBD' : 'To Thika'}
              </span>
            </div>

            {/* Compact Bus Cards */}
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-0.5">
              {trips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTripId(t.id)}
                  className={`p-3 rounded-2xl border text-left transition-all touch-manipulation flex justify-between items-center ${
                    selectedTripId === t.id
                      ? 'border-amber-500 bg-amber-500/10 text-white shadow-md'
                      : 'border-slate-800 bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-amber-400 text-sm">{t.vehicle?.registration_plate || 'KCE 849X'}</span>
                      {t.surge_multiplier > 1.0 && (
                        <span className="bg-rose-500/20 text-rose-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          ⚡ Surge
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400 block mt-0.5">
                      ⚡ ETA ~ {t.eta_minutes || 4} mins ({t.distance_km || 1.2} km away)
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-emerald-400 font-bold block">{t.remaining_seats} seats free</span>
                    <span className="text-[10px] text-slate-400">33-Seater</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Commuter Phone Number Input */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Commuter M-Pesa Phone Number
              </label>
              <input
                type="text"
                value={passengerPhone}
                onChange={(e) => setPassengerPhone(e.target.value)}
                placeholder="+2547..."
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold min-h-[44px] focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Card Action Button */}
            <button
              type="button"
              onClick={handleStartBooking}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-3 rounded-2xl shadow-xl shadow-emerald-500/20 text-xs sm:text-sm uppercase tracking-wider transition-all min-h-[48px]"
            >
              Pay KES {totalCalculatedFare.toFixed(2)} via M-Pesa ({ticketCount} {ticketCount === 1 ? 'Seat' : 'Seats'})
            </button>
          </div>
        ) : (
          <div className="p-4 text-center text-slate-400 text-xs font-semibold bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
            Search boarding & alighting stages above to reveal approaching buses & exact fares.
          </div>
        )}
      </div>

      {/* FIXED SINGLE-THUMB BOTTOM BAR FOR MOBILE PAYMENTS */}
      {boardingStageId && alightingStageId && fareQuote && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-amber-500/40 p-3 z-40 shadow-2xl">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">TOTAL ({ticketCount} {ticketCount === 1 ? 'SEAT' : 'SEATS'})</span>
              <span className="text-xl font-black text-amber-400">KES {totalCalculatedFare.toFixed(2)}</span>
            </div>

            <button
              type="button"
              onClick={handleStartBooking}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-3.5 px-4 rounded-2xl shadow-xl shadow-emerald-500/20 text-xs sm:text-sm uppercase tracking-wider touch-manipulation min-h-[48px]"
            >
              Pay via M-Pesa
            </button>
          </div>
        </div>
      )}

      {/* M-Pesa STK Push Simulation Modal */}
      {showMpesaModal && (
        <MpesaModal
          phone={passengerPhone}
          amount={totalCalculatedFare}
          ticket={bookingTicket}
          onConfirmPin={handleAuthorizePin}
          onClose={handleCloseModalAndRedirect}
        />
      )}
    </div>
  );
}
