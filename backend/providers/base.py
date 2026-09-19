from abc import ABC, abstractmethod
from dataclasses import dataclass, field

@dataclass(frozen=True)
class ProviderConfig:
    provider: str
    base_url: str
    model: str
    api_key: str = field(default="", repr=False)

@dataclass(frozen=True)
class Message:
    role: str
    content: str

class AIProvider(ABC):
    @abstractmethod
    async def generate(self, messages: list[Message]) -> str:
        """Generate a response. Network implementation is deferred to phase 2."""
        raise NotImplementedError
