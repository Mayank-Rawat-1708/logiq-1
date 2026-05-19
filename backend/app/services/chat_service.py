import json
from typing import List, AsyncIterator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import uuid

from app.models.log_entry import LogEntry, LogLevel
from app.models.log_session import LogSession
from app.models.anomaly import Anomaly
from app.utils.redis_client import get_redis
from app.config import settings


async def semantic_search(
    session_id: uuid.UUID,
    query_embedding: List[float],
    top_k: int,
    db: AsyncSession,
) -> List[LogEntry]:
    """Find top_k most similar log entries using pgvector cosine similarity."""
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
    result = await db.execute(
        select(LogEntry)
        .where(LogEntry.session_id == session_id, LogEntry.embedding.isnot(None))
        .order_by(LogEntry.embedding.op("<=>")(embedding_str))
        .limit(top_k)
    )
    return result.scalars().all()


async def keyword_search(
    session_id: uuid.UUID,
    query: str,
    top_k: int,
    db: AsyncSession,
) -> List[LogEntry]:
    """Fallback keyword search when embeddings not available."""
    words = query.lower().split()
    from sqlalchemy import or_, and_
    filters = [LogEntry.session_id == session_id]
    keyword_filters = [LogEntry.message.ilike(f"%{w}%") for w in words if len(w) > 2]
    if keyword_filters:
        filters.append(or_(*keyword_filters))
    result = await db.execute(
        select(LogEntry)
        .where(*filters)
        .order_by(desc(LogEntry.is_anomaly), desc(LogEntry.anomaly_score))
        .limit(top_k)
    )
    return result.scalars().all()


async def get_top_anomalies(session_id: uuid.UUID, db: AsyncSession, limit: int = 5) -> List[LogEntry]:
    """Get top anomalous entries for context."""
    result = await db.execute(
        select(LogEntry)
        .where(LogEntry.session_id == session_id, LogEntry.is_anomaly == True)
        .order_by(desc(LogEntry.anomaly_score))
        .limit(limit)
    )
    return result.scalars().all()


async def get_error_entries(session_id: uuid.UUID, db: AsyncSession, limit: int = 20) -> List[LogEntry]:
    """Get recent error entries as context fallback."""
    result = await db.execute(
        select(LogEntry)
        .where(
            LogEntry.session_id == session_id,
            LogEntry.level.in_([LogLevel.ERROR, LogLevel.CRITICAL]),
        )
        .order_by(LogEntry.line_number)
        .limit(limit)
    )
    return result.scalars().all()


def _build_system_prompt(
    session: LogSession,
    context_entries: List[LogEntry],
    anomaly_entries: List[LogEntry],
) -> str:
    anomaly_rate = 0.0
    if session.total_lines and session.total_lines > 0:
        anomaly_rate = (session.anomaly_count or 0) / session.total_lines * 100

    prompt = f"""You are LogIQ, an expert AI log analyst. You help developers understand their application logs.

SESSION CONTEXT:
- Session: {session.name}
- Total log lines: {session.total_lines or 'unknown'}
- Anomalies detected: {session.anomaly_count or 0} ({anomaly_rate:.1f}% anomaly rate)

RELEVANT LOG ENTRIES:
"""
    for entry in context_entries:
        ts = entry.timestamp.isoformat() if entry.timestamp else "no-timestamp"
        prompt += f"[Line {entry.line_number}] [{ts}] [{entry.level.value}]"
        if entry.service:
            prompt += f" [{entry.service}]"
        prompt += f" {entry.message}\n"

    if anomaly_entries:
        prompt += "\nTOP ANOMALIES IN SESSION:\n"
        for entry in anomaly_entries:
            ts = entry.timestamp.isoformat() if entry.timestamp else "no-timestamp"
            score = f" (score: {entry.anomaly_score:.2f})" if entry.anomaly_score else ""
            prompt += f"[Line {entry.line_number}] [{ts}] [{entry.level.value}]{score} {entry.message}\n"

    prompt += """
INSTRUCTIONS:
- Answer based on the log data provided above
- When referencing specific log lines, cite them as "Line X" (e.g., "Line 42")
- Be concise but thorough
- Identify root causes when possible
- If the relevant log data doesn't fully answer the question, say so
- Format your response with markdown for readability
"""
    return prompt


async def chat_stream(
    session_id: uuid.UUID,
    message: str,
    history: List[dict],
    db: AsyncSession,
) -> AsyncIterator[str]:
    """Stream chat response via SSE. Uses OpenAI RAG if available, falls back to keyword search."""
    result = await db.execute(select(LogSession).where(LogSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
        return

    openai_available = bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.startswith("sk-"))
    anomaly_entries = await get_top_anomalies(session_id, db, limit=5)

    # Try OpenAI path first
    if openai_available:
        try:
            from app.services.embedder import embed_query, get_openai_client

            query_embedding = await embed_query(message)
            context_entries = await semantic_search(session_id, query_embedding, top_k=20, db=db)

            # Fall back to keyword if no embeddings stored
            if not context_entries:
                context_entries = await keyword_search(session_id, message, top_k=20, db=db)
            if not context_entries:
                context_entries = await get_error_entries(session_id, db, limit=20)

            system_prompt = _build_system_prompt(session, context_entries, anomaly_entries)
            messages = [{"role": "system", "content": system_prompt}]
            for h in history[-10:]:
                messages.append({"role": h["role"], "content": h["content"]})
            messages.append({"role": "user", "content": message})

            client = get_openai_client()
            full_response = ""

            async with client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                stream=True,
                max_tokens=2000,
                temperature=0.3,
            ) as stream:
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content if chunk.choices[0].delta.content else ""
                    if delta:
                        full_response += delta
                        yield f"data: {json.dumps({'token': delta})}\n\n"

            await _persist_chat(session_id, message, full_response)
            context_data = [
                {"line_number": e.line_number, "level": e.level.value, "message": e.message[:200]}
                for e in context_entries
            ]
            yield f"data: {json.dumps({'done': True, 'context_entries': context_data})}\n\n"
            return

        except Exception as e:
            err_str = str(e)
            is_quota = "insufficient_quota" in err_str or "429" in err_str
            is_auth = "401" in err_str or "invalid_api_key" in err_str

            if is_quota or is_auth:
                # Fall through to rule-based mode with a notice
                notice = (
                    "> ⚠️ **OpenAI quota exceeded** — switching to rule-based analysis mode. "
                    "Semantic search and GPT responses are unavailable until credits are restored.\n\n"
                )
                yield f"data: {json.dumps({'token': notice})}\n\n"
            else:
                yield f"data: {json.dumps({'error': f'OpenAI error: {err_str}'})}\n\n"
                return

    # Rule-based fallback — no OpenAI needed
    context_entries = await keyword_search(session_id, message, top_k=20, db=db)
    if not context_entries:
        context_entries = await get_error_entries(session_id, db, limit=20)

    response = _rule_based_response(message, session, context_entries, anomaly_entries)

    for token in _stream_text(response):
        yield f"data: {json.dumps({'token': token})}\n\n"

    await _persist_chat(session_id, message, response)
    context_data = [
        {"line_number": e.line_number, "level": e.level.value, "message": e.message[:200]}
        for e in context_entries
    ]
    yield f"data: {json.dumps({'done': True, 'context_entries': context_data})}\n\n"


def _stream_text(text: str, chunk_size: int = 8):
    """Yield text in small chunks to simulate streaming."""
    for i in range(0, len(text), chunk_size):
        yield text[i:i + chunk_size]


def _rule_based_response(
    message: str,
    session: LogSession,
    context_entries: List[LogEntry],
    anomaly_entries: List[LogEntry],
) -> str:
    """Generate a structured response without OpenAI using log analysis rules."""
    msg_lower = message.lower()
    anomaly_count = session.anomaly_count or 0
    total_lines = session.total_lines or 0
    anomaly_rate = (anomaly_count / total_lines * 100) if total_lines > 0 else 0

    lines = []

    # Summarise what we found
    lines.append(f"## Analysis of `{session.name}`\n")
    lines.append(f"**Session stats:** {total_lines} lines · {anomaly_count} anomalies ({anomaly_rate:.1f}% rate)\n")

    # Crash / error question
    if any(w in msg_lower for w in ["crash", "down", "fail", "error", "exception", "why"]):
        errors = [e for e in context_entries if e.level.value in ("ERROR", "CRITICAL")]
        if errors:
            lines.append(f"\n### Error entries found ({len(errors)})\n")
            for e in errors[:10]:
                ts = e.timestamp.isoformat() if e.timestamp else "no-timestamp"
                lines.append(f"- **Line {e.line_number}** `[{ts}]` `[{e.level.value}]` {e.message}")
        else:
            lines.append("\nNo ERROR or CRITICAL entries matched your query in this session.")

    # Anomaly question
    elif any(w in msg_lower for w in ["anomal", "unusual", "weird", "strange", "spike"]):
        if anomaly_entries:
            lines.append(f"\n### Top anomalies detected\n")
            for e in anomaly_entries:
                score = f"{e.anomaly_score:.3f}" if e.anomaly_score else "n/a"
                lines.append(f"- **Line {e.line_number}** (score: {score}) `[{e.level.value}]` {e.message}")
        else:
            lines.append("\nNo anomalies were detected in this session.")

    # Summary question
    elif any(w in msg_lower for w in ["summar", "overview", "tell me", "what happen"]):
        lines.append(f"\n### Session summary\n")
        level_groups: dict = {}
        for e in context_entries:
            level_groups.setdefault(e.level.value, []).append(e)
        for level, entries in sorted(level_groups.items()):
            lines.append(f"- **{level}**: {len(entries)} entries")
        if anomaly_entries:
            lines.append(f"\n**Notable anomalies:**")
            for e in anomaly_entries[:5]:
                lines.append(f"- Line {e.line_number}: {e.message[:100]}")

    # Database question
    elif any(w in msg_lower for w in ["database", "db", "sql", "query", "connection"]):
        db_entries = [e for e in context_entries if e.service and "db" in e.service.lower()]
        if not db_entries:
            db_entries = [e for e in context_entries if any(w in e.message.lower() for w in ["db", "sql", "query", "connection", "pool"])]
        if db_entries:
            lines.append(f"\n### Database-related entries ({len(db_entries)})\n")
            for e in db_entries[:10]:
                lines.append(f"- **Line {e.line_number}** `[{e.level.value}]` {e.message}")
        else:
            lines.append("\nNo database-related entries found matching your query.")

    # Generic fallback
    else:
        if context_entries:
            lines.append(f"\n### Matching log entries ({len(context_entries)})\n")
            for e in context_entries[:15]:
                ts = e.timestamp.isoformat() if e.timestamp else "no-timestamp"
                lines.append(f"- **Line {e.line_number}** `[{ts}]` `[{e.level.value}]` {e.message}")
        else:
            lines.append("\nNo matching entries found. Try the **Explorer** tab to browse all logs.")

    lines.append(
        "\n\n---\n*Rule-based analysis mode — add OpenAI credits to enable GPT-4o mini responses.*"
    )
    return "\n".join(lines)


async def _persist_chat(session_id: uuid.UUID, message: str, response: str):
    """Save conversation to Redis with 24h TTL."""
    redis = await get_redis()
    chat_key = f"chat:{session_id}"
    existing_raw = await redis.get(chat_key)
    existing = json.loads(existing_raw) if existing_raw else []
    existing.append({"role": "user", "content": message})
    existing.append({"role": "assistant", "content": response})
    await redis.setex(chat_key, 86400, json.dumps(existing))


async def get_chat_history(session_id: uuid.UUID) -> List[dict]:
    """Retrieve persisted chat history from Redis."""
    redis = await get_redis()
    raw = await redis.get(f"chat:{session_id}")
    if not raw:
        return []
    return json.loads(raw)