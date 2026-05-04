from app.connectors.base import BaseConnector, ConnectorResult


class MicrosoftCalendarConnector(BaseConnector):
    provider_name = "microsoft_calendar"

    def sync(self) -> ConnectorResult:
        return ConnectorResult(ok=True, payload={"provider": self.provider_name, "events": []}, message="Microsoft stub sync completed")
