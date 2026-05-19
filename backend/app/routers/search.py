import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_

from app.database import get_db
from app.dependencies import rate_limiter
from app.models.user import User
from app.models.log_session import LogSession
from app.models.log_entry import LogEntry, LogLevel
from app.schemas.chat import SemanticSearchRequest
from app.schemas.log import LogEntryResponse
from app.config import settings

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/sessions/{session_id}/semantic", response_model=List[LogEntryResponse])
async def semantic_search(
    session_id: uuid.UUID,
    data: SemanticSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    sess_result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    top_k = min(data.top_k, 50)
    openai_available = bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.startswith("sk-"))

    # Try vector search first
    if openai_available:
        try:
            from app.services.embedder import embed_query
            query_embedding = await embed_query(data.query)
            embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

            result = await db.execute(
                select(LogEntry)
                .where(LogEntry.session_id == session_id, LogEntry.embedding.isnot(None))
                .order_by(LogEntry.embedding.op("<=>")(embedding_str))
                .limit(top_k)
            )
            entries = result.scalars().all()
            if entries:
                return [LogEntryResponse.model_validate(e) for e in entries]
        except Exception:
            pass  # Fall through to keyword search

    # Keyword fallback
    words = [w for w in data.query.lower().split() if len(w) > 2]
    filters = [LogEntry.session_id == session_id]
    if words:
        filters.append(or_(*[LogEntry.message.ilike(f"%{w}%") for w in words]))

    result = await db.execute(
        select(LogEntry)
        .where(*filters)
        .order_by(desc(LogEntry.is_anomaly), desc(LogEntry.anomaly_score))
        .limit(top_k)
    )
    entries = result.scalars().all()
    return [LogEntryResponse.model_validate(e) for e in entries]