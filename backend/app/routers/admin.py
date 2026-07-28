from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models import FareRule, Route, Stage, UserRole
from app.schemas import FareRuleCreate, FareRuleOut
from app.auth import require_role

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_role([UserRole.ADMIN.value]))]
)

@router.post("/fare-rules", response_model=FareRuleOut)
async def create_fare_rule(req: FareRuleCreate, db: AsyncSession = Depends(get_db)):
    if req.min_stage_sequence >= req.max_stage_sequence:
        raise HTTPException(
            status_code=400,
            detail="min_stage_sequence must be strictly less than max_stage_sequence"
        )
    rule = FareRule(
        route_id=req.route_id,
        min_stage_sequence=req.min_stage_sequence,
        max_stage_sequence=req.max_stage_sequence,
        fare_amount=req.fare_amount
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule

@router.put("/fare-rules/{rule_id}", response_model=FareRuleOut)
async def update_fare_rule(rule_id: str, req: FareRuleCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FareRule).where(FareRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Fare rule not found")
        
    rule.min_stage_sequence = req.min_stage_sequence
    rule.max_stage_sequence = req.max_stage_sequence
    rule.fare_amount = req.fare_amount
    await db.commit()
    await db.refresh(rule)
    return rule

@router.delete("/fare-rules/{rule_id}")
async def delete_fare_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FareRule).where(FareRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Fare rule not found")
        
    await db.delete(rule)
    await db.commit()
    return {"status": "success", "message": "Fare rule deleted"}
