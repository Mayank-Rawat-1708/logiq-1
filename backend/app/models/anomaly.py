import uuid
from datetime import datetime
import enum
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class AnomalySeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("log_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    entry_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("log_entries.id", ondelete="CASCADE"), nullable=False)
    severity: Mapped[AnomalySeverity] = mapped_column(SAEnum(AnomalySeverity), nullable=False)
    detection_method: Mapped[str] = mapped_column(String(100), nullable=False, default="IsolationForest")
    context_lines: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    session: Mapped["LogSession"] = relationship("LogSession", back_populates="anomalies")
    entry: Mapped["LogEntry"] = relationship("LogEntry", back_populates="anomaly_record")
