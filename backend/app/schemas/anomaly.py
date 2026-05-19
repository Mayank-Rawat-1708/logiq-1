from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
from app.models.anomaly import AnomalySeverity
from app.models.log_entry import LogLevel


class AnomalyResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    entry_id: uuid.UUID
    severity: AnomalySeverity
    detection_method: str
    context_lines: dict
    created_at: datetime
    entry_line_number: Optional[int] = None
    entry_message: Optional[str] = None
    entry_level: Optional[LogLevel] = None
    entry_timestamp: Optional[datetime] = None
    anomaly_score: Optional[float] = None

    model_config = {"from_attributes": True}


class ClusterEntry(BaseModel):
    line_number: int
    message: str
    level: LogLevel
    anomaly_score: Optional[float] = None


class ClusterResponse(BaseModel):
    cluster_id: int
    size: int
    representative_entries: List[ClusterEntry]
