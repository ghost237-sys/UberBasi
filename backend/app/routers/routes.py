from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.models import Route, Stage, FareRule, Trip
from app.schemas import RouteOut, FareQuoteRequest, FareQuoteResponse

router = APIRouter(prefix="/api/routes", tags=["routes"])

@router.get("", response_model=List[RouteOut])
async def list_routes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Route).options(
            selectinload(Route.stages),
            selectinload(Route.fare_rules)
        )
    )
    routes = result.scalars().all()
    return routes

@router.get("/{route_id}", response_model=RouteOut)
async def get_route(route_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Route)
        .where(Route.id == route_id)
        .options(
            selectinload(Route.stages),
            selectinload(Route.fare_rules)
        )
    )
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route

@router.post("/quote-fare", response_model=FareQuoteResponse)
async def quote_fare(req: FareQuoteRequest, db: AsyncSession = Depends(get_db)):
    route_res = await db.execute(
        select(Route).where(Route.id == req.route_id).options(
            selectinload(Route.stages),
            selectinload(Route.fare_rules)
        )
    )
    route = route_res.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
        
    stage_b = next((s for s in route.stages if s.id == req.boarding_stage_id), None)
    stage_a = next((s for s in route.stages if s.id == req.alighting_stage_id), None)
    
    if not stage_b or not stage_a:
        raise HTTPException(status_code=400, detail="Invalid boarding or alighting stage")
        
    if stage_b.id == stage_a.id:
        raise HTTPException(
            status_code=400,
            detail="Boarding stage and alighting stage cannot be identical."
        )
        
    b_seq = stage_b.sequence_order
    a_seq = stage_a.sequence_order

    # Determine corridor direction
    direction = "outbound" if b_seq < a_seq else "inbound"

    # Normalize range for symmetric fare rule lookup
    min_seq = min(b_seq, a_seq)
    max_seq = max(b_seq, a_seq)
    
    matching_rules = [
        rule for rule in route.fare_rules
        if (rule.min_stage_sequence <= min_seq and max_seq <= rule.max_stage_sequence) or
           (rule.min_stage_sequence <= min_seq and min_seq <= rule.max_stage_sequence) or
           (rule.min_stage_sequence <= max_seq and max_seq <= rule.max_stage_sequence)
    ]
    
    if matching_rules:
        base_fare = max(r.fare_amount for r in matching_rules)
    else:
        base_fare = route.default_fare
        
    surge_multiplier = 1.0
    final_fare = base_fare * surge_multiplier
    
    return {
        "route_id": route.id,
        "boarding_stage_name": stage_b.name,
        "alighting_stage_name": stage_a.name,
        "direction": direction,
        "base_fare": base_fare,
        "surge_multiplier": surge_multiplier,
        "final_fare": round(final_fare, 2)
    }
