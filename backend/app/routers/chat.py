import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import rate_limiter
from app.models.user import User
from app.models.log_session import LogSession
from app.schemas.chat import ChatRequest
from app.services.chat_service import chat_stream, get_chat_history

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/sessions/{session_id}/message")
async def send_message(
    session_id: uuid.UUID,
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    sess_result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    history = [{"role": h.role, "content": h.content} for h in data.history]

    return StreamingResponse(
        chat_stream(session_id, data.message, history, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions/{session_id}/chat-history")
async def get_history(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(rate_limiter),
):
    sess_result = await db.execute(
        select(LogSession).where(LogSession.id == session_id, LogSession.user_id == current_user.id)
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    history = await get_chat_history(session_id)
    return {"history": history}
