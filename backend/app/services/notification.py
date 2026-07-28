from abc import ABC, abstractmethod

class NotificationProvider(ABC):
    @abstractmethod
    async def send_sms(self, phone: str, message: str) -> bool:
        pass

class MockSMSNotificationProvider(NotificationProvider):
    async def send_sms(self, phone: str, message: str) -> bool:
        print(f"[MOCK SMS TO {phone}]: {message}")
        return True

notification_provider = MockSMSNotificationProvider()
