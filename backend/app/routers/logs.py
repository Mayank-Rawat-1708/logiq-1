import uuid
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import rate_limiter
from app.models.user import User
from app.models.log_session import LogSession, SessionSource, SessionStatus
from app.models.log_entry import LogEntry, LogLevel
from app.schemas.log import (
    SessionCreate, LogPaste, LogSessionResponse, LogEntryResponse,
    PaginatedEntries, SessionStats, LevelCount, TimelineBucket
)
from app.config import settings

router = APIRouter(prefix="/logs", tags=["logs"])


@router.post("/sessions", response_model=LogSessionResponse)
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    session = LogSession(
        user_id=current_user.id,
        name=data.name,
        source=data.source,
        status=SessionStatus.PENDING,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return LogSessionResponse.model_validate(session)


@router.post("/sessions/{session_id}/upload", response_model=LogSessionResponse)
async def upload_file(
    session_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    try:
        raw_text = content.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode file as text")

    session.source = SessionSource.UPLOAD
    session.status = SessionStatus.PENDING
    await db.flush()

    # Trigger Celery task
    from app.workers.tasks import process_log_session
    process_log_session.delay(str(session_id), raw_text)

    await db.refresh(session)
    return LogSessionResponse.model_validate(session)


@router.post("/sessions/{session_id}/paste", response_model=LogSessionResponse)
async def paste_logs(
    session_id: uuid.UUID,
    data: LogPaste,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.source = SessionSource.PASTE
    session.status = SessionStatus.PENDING
    await db.flush()

    from app.workers.tasks import process_log_session
    process_log_session.delay(str(session_id), data.raw_text)

    await db.refresh(session)
    return LogSessionResponse.model_validate(session)


@router.get("/sessions", response_model=List[LogSessionResponse])
async def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    offset = (page - 1) * page_size
    result = await db.execute(
        select(LogSession)
        .where(LogSession.user_id == current_user.id)
        .order_by(desc(LogSession.created_at))
        .offset(offset)
        .limit(page_size)
    )
    sessions = result.scalars().all()
    return [LogSessionResponse.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=LogSessionResponse)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return LogSessionResponse.model_validate(session)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    return {"message": "Session deleted"}


@router.get("/sessions/{session_id}/entries", response_model=PaginatedEntries)
async def get_entries(
    session_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    level: Optional[str] = Query(None),
    anomaly_only: bool = Query(False),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    # Verify session ownership
    sess_result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    filters = [LogEntry.session_id == session_id]
    if level:
        levels = [LogLevel(l.strip().upper()) for l in level.split(",") if l.strip()]
        filters.append(LogEntry.level.in_(levels))
    if anomaly_only:
        filters.append(LogEntry.is_anomaly == True)
    if search:
        filters.append(LogEntry.message.ilike(f"%{search}%"))

    count_result = await db.execute(
        select(func.count()).select_from(LogEntry).where(and_(*filters))
    )
    total = count_result.scalar()

    offset = (page - 1) * page_size
    entries_result = await db.execute(
        select(LogEntry)
        .where(and_(*filters))
        .order_by(LogEntry.line_number)
        .offset(offset)
        .limit(page_size)
    )
    entries = entries_result.scalars().all()

    return PaginatedEntries(
        items=[LogEntryResponse.model_validate(e) for e in entries],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


@router.get("/sessions/{session_id}/stats", response_model=SessionStats)
async def get_session_stats(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    sess_result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Level counts
    level_result = await db.execute(
        select(LogEntry.level, func.count().label("count"))
        .where(LogEntry.session_id == session_id)
        .group_by(LogEntry.level)
    )
    level_counts = [LevelCount(level=row.level.value, count=row.count) for row in level_result]

    # Anomaly stats
    anomaly_count = session.anomaly_count or 0
    total_lines = session.total_lines or 0
    anomaly_rate = anomaly_count / total_lines if total_lines > 0 else 0.0

    # Timeline: group by hour if timestamps exist, otherwise by line buckets
    timeline_result = await db.execute(
        select(
            func.date_trunc("hour", LogEntry.timestamp).label("bucket"),
            func.count().label("count"),
            func.sum(func.cast(LogEntry.level.in_([LogLevel.ERROR, LogLevel.CRITICAL]), db.dialect.name == 'postgresql' and 'integer' or 'integer')).label("error_count"),
        )
        .where(LogEntry.session_id == session_id, LogEntry.timestamp.isnot(None))
        .group_by("bucket")
        .order_by("bucket")
    )
    timeline = []
    for row in timeline_result:
        if row.bucket:
            timeline.append(TimelineBucket(
                bucket=row.bucket.isoformat() if hasattr(row.bucket, 'isoformat') else str(row.bucket),
                count=row.count,
                error_count=row.error_count or 0,
            ))

    # Top services
    svc_result = await db.execute(
        select(LogEntry.service, func.count().label("count"))
        .where(LogEntry.session_id == session_id, LogEntry.service.isnot(None))
        .group_by(LogEntry.service)
        .order_by(desc("count"))
        .limit(10)
    )
    top_services = [{"service": row.service, "count": row.count} for row in svc_result]

    # Top errors
    err_result = await db.execute(
        select(LogEntry.message, func.count().label("count"))
        .where(
            LogEntry.session_id == session_id,
            LogEntry.level.in_([LogLevel.ERROR, LogLevel.CRITICAL]),
        )
        .group_by(LogEntry.message)
        .order_by(desc("count"))
        .limit(10)
    )
    top_errors = [{"message": row.message[:200], "count": row.count} for row in err_result]

    return SessionStats(
        session_id=session_id,
        total_lines=total_lines,
        level_counts=level_counts,
        anomaly_count=anomaly_count,
        anomaly_rate=anomaly_rate,
        timeline=timeline,
        top_services=top_services,
        top_errors=top_errors,
    )
