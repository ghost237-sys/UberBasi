import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    SACCO_MANAGER = "sacco_manager"
    VEHICLE_OWNER = "vehicle_owner"
    CONDUCTOR = "conductor"

class TicketStatus(str, enum.Enum):
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"               # Pending boarding in UI
    CONFIRMED = "confirmed"       # Boarded in UI
    NO_SHOW = "no_show"
    REFUNDED = "refunded"
    FAILED = "failed"

class TripStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class TripDirection(str, enum.Enum):
    OUTBOUND = "outbound" # CBD -> Thika
    INBOUND = "inbound"   # Thika -> CBD

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default=UserRole.CONDUCTOR.value)
    
    vehicles = relationship("Vehicle", back_populates="owner")

class Sacco(Base):
    __tablename__ = "saccos"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    
    routes = relationship("Route", back_populates="sacco")

class Route(Base):
    __tablename__ = "routes"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sacco_id: Mapped[str] = mapped_column(String(36), ForeignKey("saccos.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    default_fare: Mapped[float] = mapped_column(Float, default=100.0)
    
    sacco = relationship("Sacco", back_populates="routes")
    stages = relationship("Stage", back_populates="route", order_by="Stage.sequence_order")
    fare_rules = relationship("FareRule", back_populates="route")
    vehicles = relationship("Vehicle", back_populates="route")

class Stage(Base):
    __tablename__ = "stages"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    route_id: Mapped[str] = mapped_column(String(36), ForeignKey("routes.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    long: Mapped[float] = mapped_column(Float, nullable=False)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)
    
    route = relationship("Route", back_populates="stages")

class Vehicle(Base):
    __tablename__ = "vehicles"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    registration_plate: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=33)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    route_id: Mapped[str] = mapped_column(String(36), ForeignKey("routes.id"), nullable=False)
    
    owner = relationship("User", back_populates="vehicles")
    route = relationship("Route", back_populates="vehicles")
    trips = relationship("Trip", back_populates="vehicle")

class Trip(Base):
    __tablename__ = "trips"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False)
    route_id: Mapped[str] = mapped_column(String(36), ForeignKey("routes.id"), nullable=False)
    departure_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(20), default=TripStatus.SCHEDULED.value)
    surge_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
    direction: Mapped[str] = mapped_column(String(20), default=TripDirection.OUTBOUND.value)
    current_stage_sequence: Mapped[int] = mapped_column(Integer, default=1)
    
    vehicle = relationship("Vehicle", back_populates="trips")
    route = relationship("Route")
    tickets = relationship("Ticket", back_populates="trip")
    expenses = relationship("TripExpense", back_populates="trip")

class TripExpense(Base):
    __tablename__ = "trip_expenses"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trip_id: Mapped[str] = mapped_column(String(36), ForeignKey("trips.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    logged_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    trip = relationship("Trip", back_populates="expenses")

class FareRule(Base):
    __tablename__ = "fare_rules"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    route_id: Mapped[str] = mapped_column(String(36), ForeignKey("routes.id"), nullable=False)
    min_stage_sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    max_stage_sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    fare_amount: Mapped[float] = mapped_column(Float, nullable=False)
    
    route = relationship("Route", back_populates="fare_rules")

class Ticket(Base):
    __tablename__ = "tickets"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trip_id: Mapped[str] = mapped_column(String(36), ForeignKey("trips.id"), nullable=False)
    boarding_stage_id: Mapped[str] = mapped_column(String(36), ForeignKey("stages.id"), nullable=False)
    alighting_stage_id: Mapped[str] = mapped_column(String(36), ForeignKey("stages.id"), nullable=False)
    fare: Mapped[float] = mapped_column(Float, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), default="mpesa")
    status: Mapped[str] = mapped_column(String(20), default=TicketStatus.PENDING_PAYMENT.value)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    qr_code_base64: Mapped[str] = mapped_column(Text, nullable=True)
    passenger_phone: Mapped[str] = mapped_column(String(20), nullable=True)
    checkout_request_id: Mapped[str] = mapped_column(String(100), nullable=True, unique=True)
    mpesa_receipt_number: Mapped[str] = mapped_column(String(50), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    trip = relationship("Trip", back_populates="tickets")
    boarding_stage = relationship("Stage", foreign_keys=[boarding_stage_id])
    alighting_stage = relationship("Stage", foreign_keys=[alighting_stage_id])
    billing_ledger = relationship("PlatformBillingLedger", back_populates="ticket", uselist=False)

class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rider_name: Mapped[str] = mapped_column(String(100), nullable=False)
    rider_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    route_id: Mapped[str] = mapped_column(String(36), ForeignKey("routes.id"), nullable=False)
    valid_from: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    valid_until: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")

class PlatformBillingLedger(Base):
    __tablename__ = "platform_billing_ledgers"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sacco_id: Mapped[str] = mapped_column(String(36), nullable=True)
    vehicle_id: Mapped[str] = mapped_column(String(36), ForeignKey("vehicles.id"), nullable=False)
    trip_id: Mapped[str] = mapped_column(String(36), ForeignKey("trips.id"), nullable=False)
    ticket_id: Mapped[str] = mapped_column(String(36), ForeignKey("tickets.id"), unique=True, nullable=False)
    fare_amount: Mapped[float] = mapped_column(Float, nullable=False)
    platform_fee_amount: Mapped[float] = mapped_column(Float, default=3.00)
    fee_type: Mapped[str] = mapped_column(String(20), default="flat_per_booking")
    billing_status: Mapped[str] = mapped_column(String(20), default="unbilled")
    invoice_id: Mapped[str] = mapped_column(String(36), ForeignKey("sacco_invoices.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    ticket = relationship("Ticket", back_populates="billing_ledger")

class TicketAuditLog(Base):
    __tablename__ = "ticket_audit_logs"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id: Mapped[str] = mapped_column(String(36), ForeignKey("tickets.id"), nullable=False)
    previous_status: Mapped[str] = mapped_column(String(30), nullable=True)
    new_status: Mapped[str] = mapped_column(String(30), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(36), nullable=True)
    actor_role: Mapped[str] = mapped_column(String(20), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class SaccoInvoice(Base):
    __tablename__ = "sacco_invoices"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sacco_name: Mapped[str] = mapped_column(String(100), default="Supermetro SACCO")
    billing_period_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    billing_period_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    total_bookings_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_fare_processed: Mapped[float] = mapped_column(Float, nullable=False)
    total_platform_fees_due: Mapped[float] = mapped_column(Float, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(20), default="pending")
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
