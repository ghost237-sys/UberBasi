import uuid
import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any

class PaymentProvider(ABC):
    @abstractmethod
    async def initiate_stk_push(self, phone: str, amount: float, reference: str) -> Dict[str, Any]:
        pass

class MockMpesaPaymentProvider(PaymentProvider):
    async def initiate_stk_push(self, phone: str, amount: float, reference: str) -> Dict[str, Any]:
        checkout_id = f"ws_CO_{uuid.uuid4().hex[:12].upper()}"
        # In a real system, this communicates with Safaricom Daraja API
        # Here we simulate immediate response with pending checkout_request_id
        return {
            "status": "pending",
            "checkout_request_id": checkout_id,
            "merchant_request_id": f"MR_{uuid.uuid4().hex[:8].upper()}",
            "response_code": "0",
            "response_description": "Success. Request accepted for processing",
            "customer_message": f"STK push sent to {phone}. Enter PIN to pay KES {amount:.2f} to Supermetro."
        }

payment_provider = MockMpesaPaymentProvider()
