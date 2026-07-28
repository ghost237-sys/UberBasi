from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Subscription
from app.schemas import SubscriptionCreate, SubscriptionOut

router = APIRouter(prefix="/api/passes", tags=["passes"])

@router.post("/purchase", response_model=SubscriptionOut)
async def purchase_subscription(req: SubscriptionCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    valid_until = now + timedelta(days=req.days)
    
    sub = Subscription(
        rider_name=req.rider_name,
        rider_phone=req.rider_phone,
        route_id=req.route_id,
        valid_from=now,
        valid_until=valid_until,
        status="active"
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub

@router.get("/lookup/{phone}", response_model=SubscriptionOut)
async def lookup_subscription(phone: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Subscription)
        .where(Subscription.rider_phone == phone)
        .where(Subscription.status == "active")
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail=f"No active pass found for phone {phone}")
    return sub
