from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
from app.models.log_session import SessionSource, SessionStatus
from app.models.log_entry import LogLevel


class SessionCreate(BaseModel):
    name: str
    source: SessionSource = SessionSource.PASTE


class LogPaste(BaseModel):
    raw_text: str


class LogEntryResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    line_number: int
    raw_text: str
    timestamp: Optional[datetime]
    level: LogLevel
    service: Optional[str]
    message: str
    is_anomaly: bool
    anomaly_score: Optional[float]
    cluster_id: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class LogSessionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    source: SessionSource
    status: SessionStatus
    total_lines: Optional[int]
    anomaly_count: Optional[int]
    created_at: datetime
    processed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class LevelCount(BaseModel):
    level: str
    count: int


class TimelineBucket(BaseModel):
    bucket: str
    count: int
    error_count: int


class SessionStats(BaseModel):
    session_id: uuid.UUID
    total_lines: int
    level_counts: List[LevelCount]
    anomaly_count: int
    anomaly_rate: float
    timeline: List[TimelineBucket]
    top_services: List[dict]
    top_errors: List[dict]


class PaginatedEntries(BaseModel):
    items: List[LogEntryResponse]
    total: int
    page: int
    page_size: int
    pages: int
