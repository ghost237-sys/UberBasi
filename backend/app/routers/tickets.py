from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.models import Ticket, TicketStatus, Trip, Stage, FareRule
from app.schemas import TicketOut, TicketCreateRequest, MpesaCallbackSimulate
from app.services.payment import payment_provider
from app.services.qr import generate_short_code, generate_qr_base64

router = APIRouter(prefix="/api/tickets", tags=["tickets"])

@router.get("/by-phone/{phone}", response_model=List[TicketOut])
async def get_tickets_by_phone(phone: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Ticket)
        .where(Ticket.passenger_phone == phone)
        .options(
            selectinload(Ticket.boarding_stage),
            selectinload(Ticket.alighting_stage)
        )
    )
    tickets = result.scalars().all()
    return tickets

@router.post("/book", response_model=TicketOut)
async def book_ticket(req: TicketCreateRequest, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        trip_result = await db.execute(
            select(Trip).where(Trip.id == req.trip_id).options(selectinload(Trip.route)).with_for_update()
        )
        trip = trip_result.scalar_one_or_none()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        stages_result = await db.execute(
            select(Stage).where(Stage.route_id == trip.route_id)
        )
        stages = stages_result.scalars().all()
        stage_b = next((s for s in stages if s.id == req.boarding_stage_id), None)
        stage_a = next((s for s in stages if s.id == req.alighting_stage_id), None)
        if not stage_b or not stage_a:
            raise HTTPException(status_code=400, detail="Invalid boarding or alighting stage")

        rules_result = await db.execute(
            select(FareRule).where(FareRule.route_id == trip.route_id)
        )
        rules = rules_result.scalars().all()
        b_seq, a_seq = stage_b.sequence_order, stage_a.sequence_order
        min_seq, max_seq = min(b_seq, a_seq), max(b_seq, a_seq)
        
        matching_rules = [
            r for r in rules
            if (r.min_stage_sequence <= min_seq and max_seq <= r.max_stage_sequence) or
               (r.min_stage_sequence <= min_seq and min_seq <= r.max_stage_sequence) or
               (r.min_stage_sequence <= max_seq and max_seq <= r.max_stage_sequence)
        ]
        base_fare = max((r.fare_amount for r in matching_rules), default=trip.route.default_fare)
        single_fare = round(base_fare * trip.surge_multiplier, 2)

        ticket_qty = max(1, req.ticket_count or 1)
        total_fare = round(single_fare * ticket_qty, 2)

        code = generate_short_code()
        qr_b64 = generate_qr_base64(f"TICKET:{code}:TRIP:{trip.id}")

        stk_res = await payment_provider.initiate_stk_push(
            phone=req.passenger_phone,
            amount=total_fare,
            reference=code
        )
        checkout_id = stk_res["checkout_request_id"]

        master_ticket = Ticket(
            trip_id=trip.id,
            boarding_stage_id=stage_b.id,
            alighting_stage_id=stage_a.id,
            fare=total_fare,
            payment_method=req.payment_method,
            status=TicketStatus.PENDING_PAYMENT.value,
            code=f"{code}-x{ticket_qty}" if ticket_qty > 1 else code,
            qr_code_base64=qr_b64,
            passenger_phone=req.passenger_phone,
            checkout_request_id=checkout_id
        )
        db.add(master_ticket)
        await db.flush()

        for s_idx in range(2, ticket_qty + 1):
            sub_ticket = Ticket(
                trip_id=trip.id,
                boarding_stage_id=stage_b.id,
                alighting_stage_id=stage_a.id,
                fare=single_fare,
                payment_method=req.payment_method,
                status=TicketStatus.PENDING_PAYMENT.value,
                code=f"{code}-S{s_idx}",
                qr_code_base64=qr_b64,
                passenger_phone=req.passenger_phone,
                checkout_request_id=f"{checkout_id}_{s_idx}"
            )
            db.add(sub_ticket)

    result = await db.execute(
        select(Ticket)
        .where(Ticket.id == master_ticket.id)
        .options(
            selectinload(Ticket.boarding_stage),
            selectinload(Ticket.alighting_stage)
        )
    )
    return result.scalar_one()

@router.post("/simulate-mpesa-callback", response_model=TicketOut)
async def simulate_mpesa_callback(cb: MpesaCallbackSimulate, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        result = await db.execute(
            select(Ticket)
            .where(Ticket.checkout_request_id == cb.checkout_request_id)
            .with_for_update()
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            raise HTTPException(status_code=404, detail="Checkout request ID not found")
            
        if ticket.status == TicketStatus.PAID.value:
            pass
        elif ticket.status == TicketStatus.PENDING_PAYMENT.value:
            if cb.status == "SUCCESS":
                ticket.status = TicketStatus.PAID.value
                ticket.mpesa_receipt_number = f"R{generate_short_code()[3:]}01"
                
                sub_res = await db.execute(
                    select(Ticket).where(Ticket.checkout_request_id.like(f"{cb.checkout_request_id}_%"))
                )
                sub_tickets = sub_res.scalars().all()
                for idx, st in enumerate(sub_tickets, start=2):
                    st.status = TicketStatus.PAID.value
                    st.mpesa_receipt_number = f"R{generate_short_code()[3:]}{idx:02d}"

    res = await db.execute(
        select(Ticket)
        .where(Ticket.id == ticket.id)
        .options(
            selectinload(Ticket.boarding_stage),
            selectinload(Ticket.alighting_stage)
        )
    )
    return res.scalar_one()

@router.get("/{ticket_id}", response_model=TicketOut)
async def get_ticket(ticket_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            selectinload(Ticket.boarding_stage),
            selectinload(Ticket.alighting_stage)
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket
