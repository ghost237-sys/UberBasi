import sys
import os
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select
from app.database import engine, AsyncSessionLocal, Base
from app.models import (
    User, UserRole, Sacco, Route, Stage, Vehicle, Trip, TripStatus, TripDirection,
    FareRule, Ticket, TicketStatus, Subscription, TripExpense,
    PlatformBillingLedger, TicketAuditLog
)
from app.auth import get_password_hash
from app.services.qr import generate_short_code, generate_qr_base64

STAGES_DATA = [
    {"name": "Nairobi CBD (Munyu Rd / Odeon)", "lat": -1.2831, "long": 36.8258, "sequence_order": 1},
    {"name": "Pangani Roundabout", "lat": -1.2721, "long": 36.8375, "sequence_order": 2},
    {"name": "Muthaiga", "lat": -1.2589, "long": 36.8351, "sequence_order": 3},
    {"name": "Survey", "lat": -1.2415, "long": 36.8621, "sequence_order": 4},
    {"name": "Allsops (Exit 7)", "lat": -1.2325, "long": 36.8770, "sequence_order": 5},
    {"name": "Roysambu (TRM)", "lat": -1.2185, "long": 36.8875, "sequence_order": 6},
    {"name": "Kasarani", "lat": -1.2215, "long": 36.8975, "sequence_order": 7},
    {"name": "Kahawa / Kahawa Sukari", "lat": -1.1895, "long": 36.9241, "sequence_order": 8},
    {"name": "Githurai 45", "lat": -1.1785, "long": 36.9325, "sequence_order": 9},
    {"name": "Kenyatta University (KU)", "lat": -1.1745, "long": 36.9385, "sequence_order": 10},
    {"name": "Ruiru (Kimbo, Exit 12/13)", "lat": -1.1472, "long": 36.9584, "sequence_order": 11},
    {"name": "Juja", "lat": -1.1012, "long": 37.0142, "sequence_order": 12},
    {"name": "Makongeni", "lat": -1.0425, "long": 37.0785, "sequence_order": 13},
    {"name": "Thika Town", "lat": -1.0332, "long": 37.0693, "sequence_order": 14},
]

async def seed_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding Supermetro database with distributed corridor fleet...")
        
        # 1. Users
        admin_user = User(
            username="admin",
            phone="+254711000000",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.ADMIN.value
        )
        sacco_mgr = User(
            username="sacco_executive",
            phone="+254722000000",
            hashed_password=get_password_hash("sacco123"),
            role=UserRole.SACCO_MANAGER.value
        )
        owner_kamau = User(
            username="kamau_motors",
            phone="+254733111222",
            hashed_password=get_password_hash("owner123"),
            role=UserRole.VEHICLE_OWNER.value
        )
        owner_njoroge = User(
            username="njoroge_transporters",
            phone="+254733333444",
            hashed_password=get_password_hash("owner123"),
            role=UserRole.VEHICLE_OWNER.value
        )
        conductor_1 = User(
            username="conductor_maina",
            phone="+254788111222",
            hashed_password=get_password_hash("conductor123"),
            role=UserRole.CONDUCTOR.value
        )
        db.add_all([admin_user, sacco_mgr, owner_kamau, owner_njoroge, conductor_1])
        await db.flush()
        
        # 2. Sacco & Route
        supermetro_sacco = Sacco(name="Supermetro SACCO", code="SM-SACCO")
        db.add(supermetro_sacco)
        await db.flush()
        
        route_237 = Route(
            sacco_id=supermetro_sacco.id,
            name="Route 237: Nairobi CBD - Thika Superhighway - Thika Town",
            code="R237",
            description="Superhighway Express Corridor serving CBD, Roysambu, Ruiru, Juja & Thika Town",
            default_fare=100.0
        )
        db.add(route_237)
        await db.flush()
        
        # 3. Stages
        stages_dict = {}
        for s in STAGES_DATA:
            stage_obj = Stage(
                route_id=route_237.id,
                name=s["name"],
                lat=s["lat"],
                long=s["long"],
                sequence_order=s["sequence_order"]
            )
            db.add(stage_obj)
            stages_dict[s["sequence_order"]] = stage_obj
        await db.flush()
        
        # 4. Fare Rules
        fare_rule_1 = FareRule(route_id=route_237.id, min_stage_sequence=1, max_stage_sequence=11, fare_amount=80.0)
        fare_rule_2 = FareRule(route_id=route_237.id, min_stage_sequence=12, max_stage_sequence=14, fare_amount=120.0)
        db.add_all([fare_rule_1, fare_rule_2])
        
        # 5. Vehicles (10 Supermetro buses distributed along the corridor)
        v1 = Vehicle(registration_plate="KCE 849X", capacity=33, owner_id=owner_kamau.id, route_id=route_237.id)
        v2 = Vehicle(registration_plate="KDF 102Y", capacity=33, owner_id=owner_kamau.id, route_id=route_237.id)
        v3 = Vehicle(registration_plate="KDB 998Z", capacity=33, owner_id=owner_njoroge.id, route_id=route_237.id)
        v4 = Vehicle(registration_plate="KDA 441A", capacity=33, owner_id=sacco_mgr.id, route_id=route_237.id)
        v5 = Vehicle(registration_plate="KCG 301B", capacity=33, owner_id=owner_kamau.id, route_id=route_237.id)
        v6 = Vehicle(registration_plate="KCH 712C", capacity=33, owner_id=owner_njoroge.id, route_id=route_237.id)
        v7 = Vehicle(registration_plate="KCJ 554D", capacity=33, owner_id=sacco_mgr.id, route_id=route_237.id)
        v8 = Vehicle(registration_plate="KCK 883E", capacity=33, owner_id=owner_kamau.id, route_id=route_237.id)
        v9 = Vehicle(registration_plate="KCL 190F", capacity=33, owner_id=owner_njoroge.id, route_id=route_237.id)
        v10 = Vehicle(registration_plate="KCM 444G", capacity=33, owner_id=sacco_mgr.id, route_id=route_237.id)
        db.add_all([v1, v2, v3, v4, v5, v6, v7, v8, v9, v10])
        await db.flush()
        
        # 6. Trips (Distributed along sequence orders so ETA is ALWAYS ~3-8 mins!)
        now = datetime.utcnow()
        trips_list = [
            # Outbound buses (CBD -> Thika)
            Trip(vehicle_id=v1.id, route_id=route_237.id, departure_time=now + timedelta(minutes=5), status=TripStatus.SCHEDULED.value, surge_multiplier=1.0, direction=TripDirection.OUTBOUND.value, current_stage_sequence=1),
            Trip(vehicle_id=v3.id, route_id=route_237.id, departure_time=now + timedelta(minutes=8), status=TripStatus.SCHEDULED.value, surge_multiplier=1.0, direction=TripDirection.OUTBOUND.value, current_stage_sequence=4),
            Trip(vehicle_id=v5.id, route_id=route_237.id, departure_time=now + timedelta(minutes=10), status=TripStatus.SCHEDULED.value, surge_multiplier=1.25, direction=TripDirection.OUTBOUND.value, current_stage_sequence=7),
            Trip(vehicle_id=v7.id, route_id=route_237.id, departure_time=now + timedelta(minutes=12), status=TripStatus.SCHEDULED.value, surge_multiplier=1.0, direction=TripDirection.OUTBOUND.value, current_stage_sequence=10),
            Trip(vehicle_id=v9.id, route_id=route_237.id, departure_time=now + timedelta(minutes=6), status=TripStatus.SCHEDULED.value, surge_multiplier=1.0, direction=TripDirection.OUTBOUND.value, current_stage_sequence=2),

            # Inbound buses (Thika -> CBD)
            Trip(vehicle_id=v2.id, route_id=route_237.id, departure_time=now + timedelta(minutes=5), status=TripStatus.SCHEDULED.value, surge_multiplier=1.0, direction=TripDirection.INBOUND.value, current_stage_sequence=13),
            Trip(vehicle_id=v4.id, route_id=route_237.id, departure_time=now + timedelta(minutes=7), status=TripStatus.SCHEDULED.value, surge_multiplier=1.0, direction=TripDirection.INBOUND.value, current_stage_sequence=11),
            Trip(vehicle_id=v6.id, route_id=route_237.id, departure_time=now + timedelta(minutes=9), status=TripStatus.SCHEDULED.value, surge_multiplier=1.0, direction=TripDirection.INBOUND.value, current_stage_sequence=8),
            Trip(vehicle_id=v8.id, route_id=route_237.id, departure_time=now + timedelta(minutes=4), status=TripStatus.SCHEDULED.value, surge_multiplier=1.0, direction=TripDirection.INBOUND.value, current_stage_sequence=5),
            Trip(vehicle_id=v10.id, route_id=route_237.id, departure_time=now + timedelta(minutes=11), status=TripStatus.SCHEDULED.value, surge_multiplier=1.0, direction=TripDirection.INBOUND.value, current_stage_sequence=14),
        ]
        db.add_all(trips_list)
        await db.flush()
        
        # 7. Seed Tickets for Outbound & Inbound
        for i in range(1, 6):
            code = generate_short_code()
            qr_b64 = generate_qr_base64(f"TICKET:{code}:TRIP:{trips_list[0].id}")
            t = Ticket(
                trip_id=trips_list[0].id,
                boarding_stage_id=stages_dict[1].id,
                alighting_stage_id=stages_dict[6].id,
                fare=80.0,
                payment_method="mpesa",
                status=TicketStatus.CONFIRMED.value,
                code=code,
                qr_code_base64=qr_b64,
                passenger_phone=f"+2547123456{i:02d}",
                checkout_request_id=f"ws_CO_MOCK_MPESA_{i}"
            )
            db.add(t)

        # Expenses & Subscriptions
        e1 = TripExpense(trip_id=trips_list[0].id, category="Fuel", amount=1500.0)
        e2 = TripExpense(trip_id=trips_list[0].id, category="Stage Fee (Manamba)", amount=200.0)
        db.add_all([e1, e2])

        sub1 = Subscription(
            rider_name="Wanjiru Mwangi",
            rider_phone="+254722998877",
            route_id=route_237.id,
            valid_from=now - timedelta(days=5),
            valid_until=now + timedelta(days=25),
            status="active"
        )
        db.add(sub1)

        await db.commit()
        print("✅ Supermetro seed data created with 10 distributed buses (5-10 min ETA at all stops)!")

if __name__ == "__main__":
    asyncio.run(seed_database())
