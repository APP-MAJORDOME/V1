from dataclasses import dataclass
from typing import Any


@dataclass
class ConnectorResult:
    ok: bool
    payload: dict[str, Any]
    message: str = ""


class BaseConnector:
    provider_name: str = "base"

    def sync(self) -> ConnectorResult:
        return ConnectorResult(ok=True, payload={"provider": self.provider_name, "status": "stub_sync"})
