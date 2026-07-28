from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List

from app.database import get_db
from app.models import Vehicle, Trip, Ticket, TicketStatus, TripExpense, FareRule, Route, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/owner", tags=["owner"])

@router.get("/dashboard")
async def get_owner_dashboard(
    owner_id: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Determine scoping: vehicle_owner sees only their vehicles
    target_owner_id = None
    if current_user and current_user.role == "vehicle_owner":
        target_owner_id = current_user.id
    elif owner_id:
        target_owner_id = owner_id

    v_query = select(Vehicle).options(selectinload(Vehicle.owner), selectinload(Vehicle.route))
    if target_owner_id:
        v_query = v_query.where(Vehicle.owner_id == target_owner_id)
        
    vehicles_res = await db.execute(v_query)
    vehicles = vehicles_res.scalars().all()
    vehicle_ids = [v.id for v in vehicles]

    # Fetch trips for these vehicles
    trips_res = await db.execute(
        select(Trip)
        .where(Trip.vehicle_id.in_(vehicle_ids))
        .options(
            selectinload(Trip.tickets),
            selectinload(Trip.expenses),
            selectinload(Trip.vehicle)
        )
    )
    trips = trips_res.scalars().all()

    total_capacity = sum(v.capacity for v in vehicles)
    total_mpesa_revenue = 0.0
    total_cash_revenue = 0.0
    total_expenses = 0.0
    total_confirmed_boarded = 0
    total_paid_pending = 0
    
    vehicle_summaries = []
    
    for v in vehicles:
        v_trips = [t for t in trips if t.vehicle_id == v.id]
        v_mpesa = 0.0
        v_cash = 0.0
        v_exp = 0.0
        v_boarded = 0
        v_pending = 0
        
        for t in v_trips:
            for exp in t.expenses:
                v_exp += exp.amount
            for ticket in t.tickets:
                if ticket.status == TicketStatus.CONFIRMED.value:
                    v_boarded += 1
                    if ticket.payment_method == "mpesa":
                        v_mpesa += ticket.fare
                    else:
                        v_cash += ticket.fare
                elif ticket.status == TicketStatus.PAID.value:
                    v_pending += 1
                    if ticket.payment_method == "mpesa":
                        v_mpesa += ticket.fare
                        
        total_mpesa_revenue += v_mpesa
        total_cash_revenue += v_cash
        total_expenses += v_exp
        total_confirmed_boarded += v_boarded
        total_paid_pending += v_pending
        
        gross = v_mpesa + v_cash
        net_handover = gross - v_exp
        occ_rate = round((v_boarded / v.capacity) * 100, 1) if v.capacity else 0
        
        vehicle_summaries.append({
            "vehicle_id": v.id,
            "registration_plate": v.registration_plate,
            "owner_name": v.owner.username if v.owner else "SACCO",
            "capacity": v.capacity,
            "confirmed_boarded": v_boarded,
            "paid_pending": v_pending,
            "occupancy_rate": occ_rate,
            "mpesa_revenue": v_mpesa,
            "cash_revenue": v_cash,
            "gross_revenue": gross,
            "expenses": v_exp,
            "net_handover": net_handover
        })
        
    gross_total = total_mpesa_revenue + total_cash_revenue
    net_total_handover = gross_total - total_expenses
    leakage_gap = total_paid_pending # Tickets paid digitally but not yet checked in by conductor
    
    # Read-only fare rules overview
    routes_res = await db.execute(select(Route).options(selectinload(Route.fare_rules)))
    routes = routes_res.scalars().all()
    fare_overview = [
        {
            "route_name": r.name,
            "default_fare": r.default_fare,
            "rules": [
                {
                    "min_stage": rule.min_stage_sequence,
                    "max_stage": rule.max_stage_sequence,
                    "fare_amount": rule.fare_amount
                } for rule in r.fare_rules
            ]
        } for r in routes
    ]

    return {
        "is_sacco_wide": target_owner_id is None,
        "scoped_owner_id": target_owner_id,
        "total_vehicles": len(vehicles),
        "total_capacity": total_capacity,
        "total_confirmed_boarded": total_confirmed_boarded,
        "total_paid_pending": total_paid_pending,
        "leakage_gap_pending_tickets": leakage_gap,
        "total_mpesa_revenue": total_mpesa_revenue,
        "total_cash_revenue": total_cash_revenue,
        "gross_revenue": gross_total,
        "total_expenses": total_expenses,
        "net_handover": net_total_handover,
        "vehicles": vehicle_summaries,
        "fare_rules_readonly": fare_overview
    }
