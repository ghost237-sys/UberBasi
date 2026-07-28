from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db
from app.models import Ticket, TicketStatus, Trip, Stage, FareRule, User, UserRole, PlatformBillingLedger, TicketAuditLog, Sacco
from app.schemas import TicketOut, StagePushRequest, TicketConfirmRequest, CashPassengerCreate, TripExpenseCreate, TripExpenseOut, TripOut
from app.services.payment import payment_provider
from app.services.qr import generate_short_code, generate_qr_base64
from app.services.notification import notification_provider
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/api/conductor", tags=["conductor"])

@router.get("/my-trip", response_model=TripOut)
async def get_my_assigned_trip(
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch active trip automatically assigned to this conductor's vehicle
    query = select(Trip).options(selectinload(Trip.vehicle), selectinload(Trip.route))
    result = await db.execute(query)
    trips = result.scalars().all()

    if not trips:
        raise HTTPException(status_code=404, detail="No active vehicle trip assigned.")

    assigned_trip = trips[0] # Assigned vehicle trip (e.g. KCE 849X)
    
    # Calculate ticket counts
    t_res = await db.execute(
        select(Ticket.status, func.count(Ticket.id))
        .where(Ticket.trip_id == assigned_trip.id)
        .group_by(Ticket.status)
    )
    counts = dict(t_res.all())
    confirmed_c = counts.get(TicketStatus.CONFIRMED.value, 0)
    paid_c = counts.get(TicketStatus.PAID.value, 0)
    cap = assigned_trip.vehicle.capacity if assigned_trip.vehicle else 33
    rem = max(0, cap - (confirmed_c + paid_c))

    return TripOut(
        id=assigned_trip.id,
        vehicle_id=assigned_trip.vehicle_id,
        route_id=assigned_trip.route_id,
        departure_time=assigned_trip.departure_time,
        status=assigned_trip.status,
        surge_multiplier=assigned_trip.surge_multiplier,
        direction=assigned_trip.direction,
        current_stage_sequence=assigned_trip.current_stage_sequence,
        vehicle=assigned_trip.vehicle,
        confirmed_count=confirmed_c,
        paid_count=paid_c,
        remaining_seats=rem
    )

@router.get("/trip-manifest/{trip_id}", response_model=List[TicketOut])
async def get_trip_manifest(
    trip_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Ticket)
        .where(Ticket.trip_id == trip_id)
        .options(
            selectinload(Ticket.boarding_stage),
            selectinload(Ticket.alighting_stage)
        )
    )
    tickets = result.scalars().all()
    return tickets

@router.post("/confirm-ticket")
async def confirm_ticket(
    req: TicketConfirmRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    actor_id = current_user.id if current_user else "conductor_demo_id"
    actor_role = current_user.role if current_user else UserRole.CONDUCTOR.value

    async with db.begin():
        query = select(Ticket).where(
            or_(
                Ticket.code == req.code_or_phone,
                Ticket.passenger_phone == req.code_or_phone,
                Ticket.checkout_request_id == req.code_or_phone
            )
        ).with_for_update()

        if req.trip_id:
            query = query.where(Ticket.trip_id == req.trip_id)

        result = await db.execute(query)
        ticket = result.scalar_one_or_none()

        if not ticket:
            return {
                "status": "not_found",
                "message": f"Ticket code or phone '{req.code_or_phone}' not found."
            }

        if ticket.status == TicketStatus.CONFIRMED.value:
            return {
                "status": "already_boarded",
                "message": f"⚠️ ALREADY BOARDED: Ticket {ticket.code} was previously verified!",
                "ticket": ticket
            }

        prev_status = ticket.status
        ticket.status = TicketStatus.CONFIRMED.value

        audit = TicketAuditLog(
            ticket_id=ticket.id,
            previous_status=prev_status,
            new_status=TicketStatus.CONFIRMED.value,
            actor_id=actor_id,
            actor_role=actor_role
        )
        db.add(audit)

        ledger_check = await db.execute(
            select(PlatformBillingLedger).where(PlatformBillingLedger.ticket_id == ticket.id)
        )
        existing_ledger = ledger_check.scalar_one_or_none()

        if not existing_ledger:
            trip_res = await db.execute(
                select(Trip).where(Trip.id == ticket.trip_id).options(selectinload(Trip.vehicle))
            )
            trip = trip_res.scalar_one_or_none()
            
            sacco_id = None
            if trip and trip.vehicle and trip.vehicle.route_id:
                route_res = await db.execute(select(Route).where(Route.id == trip.vehicle.route_id))
                rt = route_res.scalar_one_or_none()
                if rt:
                    sacco_id = rt.sacco_id

            billing = PlatformBillingLedger(
                sacco_id=sacco_id,
                vehicle_id=trip.vehicle_id if trip else "unknown_vehicle",
                trip_id=ticket.trip_id,
                ticket_id=ticket.id,
                fare_amount=ticket.fare,
                platform_fee_amount=3.00,
                fee_type="flat_per_booking",
                billing_status="unbilled"
            )
            db.add(billing)

    return {
        "status": "success",
        "message": f"✓ VERIFIED & BOARDED SUCCESS! Code: {ticket.code} (Fare: KES {ticket.fare})",
        "ticket": ticket
    }

@router.post("/stage-push", response_model=TicketOut)
async def stage_push(
    req: StagePushRequest,
    db: AsyncSession = Depends(get_db)
):
    async with db.begin():
        trip_res = await db.execute(select(Trip).where(Trip.id == req.trip_id).options(selectinload(Trip.route)))
        trip = trip_res.scalar_one_or_none()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        stages_res = await db.execute(select(Stage).where(Stage.route_id == trip.route_id))
        stages = stages_res.scalars().all()
        stage_b = next((s for s in stages if s.id == req.boarding_stage_id), None)
        stage_a = next((s for s in stages if s.id == req.alighting_stage_id), None)
        if not stage_b or not stage_a:
            raise HTTPException(status_code=400, detail="Invalid stages")

        rules_res = await db.execute(select(FareRule).where(FareRule.route_id == trip.route_id))
        rules = rules_res.scalars().all()
        b_seq, a_seq = stage_b.sequence_order, stage_a.sequence_order
        min_seq, max_seq = min(b_seq, a_seq), max(b_seq, a_seq)
        
        matching_rules = [
            r for r in rules
            if (r.min_stage_sequence <= min_seq and max_seq <= r.max_stage_sequence) or
               (r.min_stage_sequence <= min_seq and min_seq <= r.max_stage_sequence) or
               (r.min_stage_sequence <= max_seq and max_seq <= r.max_stage_sequence)
        ]
        base_fare = max((r.fare_amount for r in matching_rules), default=trip.route.default_fare)
        final_fare = round(base_fare * trip.surge_multiplier, 2)

        code = generate_short_code()
        qr_b64 = generate_qr_base64(f"TICKET:{code}:TRIP:{trip.id}")

        stk_res = await payment_provider.initiate_stk_push(
            phone=req.passenger_phone,
            amount=final_fare,
            reference=code
        )
        checkout_id = stk_res["checkout_request_id"]

        ticket = Ticket(
            trip_id=trip.id,
            boarding_stage_id=stage_b.id,
            alighting_stage_id=stage_a.id,
            fare=final_fare,
            payment_method="mpesa",
            status=TicketStatus.PENDING_PAYMENT.value,
            code=code,
            qr_code_base64=qr_b64,
            passenger_phone=req.passenger_phone,
            checkout_request_id=checkout_id
        )
        db.add(ticket)

    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket.id).options(
            selectinload(Ticket.boarding_stage),
            selectinload(Ticket.alighting_stage)
        )
    )
    return result.scalar_one()

@router.post("/add-cash-passenger", response_model=TicketOut)
async def add_cash_passenger(
    req: CashPassengerCreate,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    actor_id = current_user.id if current_user else "conductor_demo_id"
    actor_role = current_user.role if current_user else UserRole.CONDUCTOR.value

    async with db.begin():
        trip_res = await db.execute(select(Trip).where(Trip.id == req.trip_id).options(selectinload(Trip.route)))
        trip = trip_res.scalar_one_or_none()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        stages_res = await db.execute(select(Stage).where(Stage.route_id == trip.route_id))
        stages = stages_res.scalars().all()
        stage_b = next((s for s in stages if s.id == req.boarding_stage_id), None)
        stage_a = next((s for s in stages if s.id == req.alighting_stage_id), None)
        if not stage_b or not stage_a:
            raise HTTPException(status_code=400, detail="Invalid stages")

        fare = req.fare_amount or 80.0

        code = generate_short_code()
        qr_b64 = generate_qr_base64(f"TICKET:{code}:TRIP:{trip.id}")

        ticket = Ticket(
            trip_id=trip.id,
            boarding_stage_id=stage_b.id,
            alighting_stage_id=stage_a.id,
            fare=fare,
            payment_method="cash",
            status=TicketStatus.CONFIRMED.value,
            code=code,
            qr_code_base64=qr_b64,
            passenger_phone="+254700000000"
        )
        db.add(ticket)
        await db.flush()

        audit = TicketAuditLog(
            ticket_id=ticket.id,
            previous_status=None,
            new_status=TicketStatus.CONFIRMED.value,
            actor_id=actor_id,
            actor_role=actor_role
        )
        billing = PlatformBillingLedger(
            sacco_id=trip.route.sacco_id if trip.route else None,
            vehicle_id=trip.vehicle_id,
            trip_id=trip.id,
            ticket_id=ticket.id,
            fare_amount=fare,
            platform_fee_amount=3.00,
            fee_type="flat_per_booking",
            billing_status="unbilled"
        )
        db.add_all([audit, billing])

    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket.id).options(
            selectinload(Ticket.boarding_stage),
            selectinload(Ticket.alighting_stage)
        )
    )
    return result.scalar_one()

@router.post("/log-expense", response_model=TripExpenseOut)
async def log_expense(
    req: TripExpenseCreate,
    db: AsyncSession = Depends(get_db)
):
    expense = TripExpense(
        trip_id=req.trip_id,
        category=req.category,
        amount=req.amount
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense
