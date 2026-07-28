from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db
from app.models import Trip, Ticket, TicketStatus, Vehicle, Stage
from app.schemas import TripOut
from app.auth import get_current_user, require_role, UserRole

router = APIRouter(prefix="/api/trips", tags=["trips"])

@router.get("", response_model=List[TripOut])
async def list_trips(
    route_id: Optional[str] = None,
    boarding_stage_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Trip).options(selectinload(Trip.vehicle))
    if route_id:
        query = query.where(Trip.route_id == route_id)
    
    result = await db.execute(query)
    trips = result.scalars().all()

    # Get target boarding stage sequence if provided
    target_seq = 1
    if boarding_stage_id:
        st_res = await db.execute(select(Stage).where(Stage.id == boarding_stage_id))
        st = st_res.scalar_one_or_none()
        if st:
            target_seq = st.sequence_order
    
    out = []
    for trip in trips:
        t_res = await db.execute(
            select(Ticket.status, func.count(Ticket.id))
            .where(Ticket.trip_id == trip.id)
            .group_by(Ticket.status)
        )
        counts = dict(t_res.all())
        
        confirmed_c = counts.get(TicketStatus.CONFIRMED.value, 0)
        paid_c = counts.get(TicketStatus.PAID.value, 0)
        cap = trip.vehicle.capacity if trip.vehicle else 33
        rem = max(0, cap - (confirmed_c + paid_c))
        
        # Calculate dynamic ETA and distance from bus's current location to boarding stage
        seq_diff = abs(target_seq - trip.current_stage_sequence)
        dist_km = round(seq_diff * 1.6 + 0.4, 1) # ~1.6km per corridor stage gap
        eta_mins = max(2, int(seq_diff * 3.5 + 2)) # ~3.5 mins per stage gap + 2 min buffer

        t_out = TripOut(
            id=trip.id,
            vehicle_id=trip.vehicle_id,
            route_id=trip.route_id,
            departure_time=trip.departure_time,
            status=trip.status,
            surge_multiplier=trip.surge_multiplier,
            direction=trip.direction,
            current_stage_sequence=trip.current_stage_sequence,
            eta_minutes=eta_mins,
            distance_km=dist_km,
            vehicle=trip.vehicle,
            confirmed_count=confirmed_c,
            paid_count=paid_c,
            remaining_seats=rem
        )
        out.append(t_out)

    # Sort buses by closest ETA to passenger
    out.sort(key=lambda x: (x.eta_minutes or 99))
    return out

@router.post("/{trip_id}/toggle-surge", response_model=TripOut)
async def toggle_surge(
    trip_id: str,
    multiplier: float = 1.25,
    user=Depends(require_role([UserRole.ADMIN.value, UserRole.SACCO_MANAGER.value, UserRole.VEHICLE_OWNER.value])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Trip).where(Trip.id == trip_id).options(selectinload(Trip.vehicle)))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    trip.surge_multiplier = multiplier
    await db.commit()
    await db.refresh(trip)
    return trip
