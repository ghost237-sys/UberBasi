from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    user_id: str

class UserBase(BaseModel):
    username: str
    phone: Optional[str] = None
    role: str

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: str
    class Config:
        from_attributes = True

class StageOut(BaseModel):
    id: str
    route_id: str
    name: str
    lat: float
    long: float
    sequence_order: int
    class Config:
        from_attributes = True

class FareRuleBase(BaseModel):
    route_id: str
    min_stage_sequence: int
    max_stage_sequence: int
    fare_amount: float

class FareRuleCreate(FareRuleBase):
    pass

class FareRuleOut(FareRuleBase):
    id: str
    class Config:
        from_attributes = True

class RouteOut(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    default_fare: float
    stages: List[StageOut] = []
    fare_rules: List[FareRuleOut] = []
    class Config:
        from_attributes = True

class VehicleOut(BaseModel):
    id: str
    registration_plate: str
    capacity: int
    owner_id: Optional[str] = None
    route_id: str
    class Config:
        from_attributes = True

class TripOut(BaseModel):
    id: str
    vehicle_id: str
    route_id: str
    departure_time: datetime
    status: str
    surge_multiplier: float
    direction: str = "outbound"
    current_stage_sequence: int = 1
    eta_minutes: Optional[int] = 5
    distance_km: Optional[float] = 1.8
    vehicle: Optional[VehicleOut] = None
    confirmed_count: Optional[int] = 0
    paid_count: Optional[int] = 0
    remaining_seats: Optional[int] = 33
    class Config:
        from_attributes = True

class FareQuoteRequest(BaseModel):
    route_id: str
    boarding_stage_id: str
    alighting_stage_id: str

class FareQuoteResponse(BaseModel):
    route_id: str
    boarding_stage_name: str
    alighting_stage_name: str
    direction: str
    base_fare: float
    surge_multiplier: float
    final_fare: float

class TicketCreateRequest(BaseModel):
    trip_id: str
    boarding_stage_id: str
    alighting_stage_id: str
    passenger_phone: str
    ticket_count: int = 1 # Allow multiple tickets booking (e.g. 1 to 5 seats)
    payment_method: str = "mpesa"

class StagePushRequest(BaseModel):
    trip_id: str
    boarding_stage_id: str
    alighting_stage_id: str
    passenger_phone: str

class MpesaCallbackSimulate(BaseModel):
    checkout_request_id: str
    status: str = "SUCCESS"

class TicketConfirmRequest(BaseModel):
    code_or_phone: str
    trip_id: Optional[str] = None

class CashPassengerCreate(BaseModel):
    trip_id: str
    boarding_stage_id: str
    alighting_stage_id: str
    fare_amount: Optional[float] = None

class TicketOut(BaseModel):
    id: str
    trip_id: str
    boarding_stage_id: str
    alighting_stage_id: str
    fare: float
    payment_method: str
    status: str
    code: str
    qr_code_base64: Optional[str] = None
    passenger_phone: Optional[str] = None
    checkout_request_id: Optional[str] = None
    mpesa_receipt_number: Optional[str] = None
    created_at: datetime
    boarding_stage: Optional[StageOut] = None
    alighting_stage: Optional[StageOut] = None
    class Config:
        from_attributes = True

class SubscriptionCreate(BaseModel):
    rider_name: str
    rider_phone: str
    route_id: str
    days: int = 30

class SubscriptionOut(BaseModel):
    id: str
    rider_name: str
    rider_phone: str
    route_id: str
    valid_from: datetime
    valid_until: datetime
    status: str
    class Config:
        from_attributes = True

class TripExpenseCreate(BaseModel):
    trip_id: str
    category: str
    amount: float

class TripExpenseOut(BaseModel):
    id: str
    trip_id: str
    category: str
    amount: float
    logged_at: datetime
    class Config:
        from_attributes = True

class BillingLedgerOut(BaseModel):
    id: str
    sacco_id: Optional[str]
    vehicle_id: str
    trip_id: str
    ticket_id: str
    fare_amount: float
    platform_fee_amount: float
    fee_type: str
    billing_status: str
    created_at: datetime
    class Config:
        from_attributes = True

class SaccoInvoiceOut(BaseModel):
    id: str
    sacco_name: str
    billing_period_start: datetime
    billing_period_end: datetime
    total_bookings_count: int
    total_fare_processed: float
    total_platform_fees_due: float
    payment_status: str
    generated_at: datetime
    class Config:
        from_attributes = True
