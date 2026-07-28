import sys
from pathlib import Path

# Add parent directory of 'app' to sys.path so 'import app...' works from any directory
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import engine, Base
from app.seed import seed_database
from app.routers import auth, routes, trips, tickets, conductor, owner, admin, billing, passes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables & seed
    await seed_database()
    yield

app = FastAPI(
    title="UberBasi Matatu Booking & Ticketing API (Supermetro)",
    description="Backend API for Supermetro Matatu PWA with M-Pesa STK push, Conductor check-in, SACCO billing ledgers & offline sync.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(routes.router)
app.include_router(trips.router)
app.include_router(tickets.router)
app.include_router(conductor.router)
app.include_router(owner.router)
app.include_router(admin.router)
app.include_router(billing.router)
app.include_router(passes.router)

@app.get("/")
async def root():
    return {
        "app": "UberBasi Matatu Booking & Ticketing API",
        "sacco": "Supermetro SACCO",
        "status": "online",
        "docs": "/docs"
    }
