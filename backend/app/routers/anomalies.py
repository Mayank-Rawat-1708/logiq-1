import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.dependencies import rate_limiter
from app.models.user import User
from app.models.log_session import LogSession
from app.models.log_entry import LogEntry, LogLevel
from app.models.anomaly import Anomaly, AnomalySeverity
from app.schemas.anomaly import AnomalyResponse, ClusterResponse, ClusterEntry
from app.services.clustering import get_cluster_representatives

router = APIRouter(prefix="/anomalies", tags=["anomalies"])


@router.get("/sessions/{session_id}/anomalies", response_model=List[AnomalyResponse])
async def list_anomalies(
    session_id: uuid.UUID,
    severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    # Verify ownership
    sess_result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    query = (
        select(Anomaly, LogEntry)
        .join(LogEntry, Anomaly.entry_id == LogEntry.id)
        .where(Anomaly.session_id == session_id)
    )

    if severity:
        severities = [AnomalySeverity(s.strip().upper()) for s in severity.split(",") if s.strip()]
        query = query.where(Anomaly.severity.in_(severities))

    query = query.order_by(desc(LogEntry.anomaly_score))
    result = await db.execute(query)
    rows = result.all()

    responses = []
    for anomaly, entry in rows:
        resp = AnomalyResponse(
            id=anomaly.id,
            session_id=anomaly.session_id,
            entry_id=anomaly.entry_id,
            severity=anomaly.severity,
            detection_method=anomaly.detection_method,
            context_lines=anomaly.context_lines,
            created_at=anomaly.created_at,
            entry_line_number=entry.line_number,
            entry_message=entry.message,
            entry_level=entry.level,
            entry_timestamp=entry.timestamp,
            anomaly_score=entry.anomaly_score,
        )
        responses.append(resp)

    return responses


@router.get("/sessions/{session_id}/clusters", response_model=List[ClusterResponse])
async def list_clusters(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    sess_result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    # Get entries with cluster IDs
    result = await db.execute(
        select(LogEntry)
        .where(LogEntry.session_id == session_id, LogEntry.cluster_id.isnot(None))
        .order_by(LogEntry.line_number)
    )
    entries = result.scalars().all()

    # Group by cluster
    clusters: dict[int, list] = {}
    for entry in entries:
        clusters.setdefault(entry.cluster_id, []).append(entry)

    responses = []
    for cluster_id, cluster_entries in sorted(clusters.items()):
        # Pick representative entries: shortest messages
        sorted_entries = sorted(cluster_entries, key=lambda e: len(e.message))
        representatives = [
            ClusterEntry(
                line_number=e.line_number,
                message=e.message[:300],
                level=e.level,
                anomaly_score=e.anomaly_score,
            )
            for e in sorted_entries[:3]
        ]
        responses.append(ClusterResponse(
            cluster_id=cluster_id,
            size=len(cluster_entries),
            representative_entries=representatives,
        ))

    return responses
