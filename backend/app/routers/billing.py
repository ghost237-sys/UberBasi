from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models import PlatformBillingLedger, SaccoInvoice, Vehicle, Ticket
from app.schemas import BillingLedgerOut, SaccoInvoiceOut
from app.config import settings

router = APIRouter(prefix="/api/billing", tags=["billing"])

@router.get("/summary")
async def get_billing_summary(db: AsyncSession = Depends(get_db)):
    # Calculate accrued platform fees & billable seats
    result = await db.execute(select(PlatformBillingLedger))
    ledgers = result.scalars().all()
    
    total_billable_seats = len(ledgers)
    total_fare_processed = sum(l.fare_amount for l in ledgers)
    total_platform_fees_due = sum(l.platform_fee_amount for l in ledgers)
    
    # Breakdown by vehicle
    v_res = await db.execute(select(Vehicle))
    vehicles = v_res.scalars().all()
    
    vehicle_breakdown = []
    for v in vehicles:
        v_ledgers = [l for l in ledgers if l.vehicle_id == v.id]
        v_count = len(v_ledgers)
        v_fees = sum(l.platform_fee_amount for l in v_ledgers)
        vehicle_breakdown.append({
            "vehicle_id": v.id,
            "registration_plate": v.registration_plate,
            "billable_seats": v_count,
            "platform_fees_due": v_fees
        })
        
    return {
        "sacco_name": "Supermetro SACCO",
        "total_billable_seats": total_billable_seats,
        "total_fare_processed": total_fare_processed,
        "total_platform_fees_due": total_platform_fees_due,
        "rate_per_booking": settings.PLATFORM_FEE_AMOUNT,
        "vehicle_breakdown": vehicle_breakdown
    }

@router.get("/ledgers", response_model=List[BillingLedgerOut])
async def list_billing_ledgers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlatformBillingLedger).order_by(PlatformBillingLedger.created_at.desc()))
    ledgers = result.scalars().all()
    return ledgers

@router.post("/generate-invoice", response_model=SaccoInvoiceOut)
async def generate_sacco_invoice(db: AsyncSession = Depends(get_db)):
    summary = await get_billing_summary(db)
    
    now = datetime.utcnow()
    start_date = now - timedelta(days=7)
    
    invoice = SaccoInvoice(
        sacco_name="Supermetro SACCO",
        billing_period_start=start_date,
        billing_period_end=now,
        total_bookings_count=summary["total_billable_seats"],
        total_fare_processed=summary["total_fare_processed"],
        total_platform_fees_due=summary["total_platform_fees_due"],
        payment_status="pending"
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice
