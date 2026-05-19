import asyncio
import json
import uuid
from datetime import datetime
from celery import Celery
from app.config import settings

celery_app = Celery(
    "logiq",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


def run_async(coro):
    """Run an async coroutine in a sync context."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _process_session_async(session_id: str, raw_text: str):
    """Full async processing pipeline."""
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select, update
    import redis.asyncio as aioredis

    from app.models.log_session import LogSession, SessionStatus
    from app.models.log_entry import LogEntry
    from app.models.anomaly import Anomaly
    from app.services.log_parser import parse_log_text
    from app.services.anomaly_detector import detect_anomalies, get_context_lines
    from app.services.clustering import cluster_entries

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    session_uuid = uuid.UUID(session_id)
    pub_channel = f"session_progress:{session_id}"

    # Check if OpenAI is available
    openai_available = bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.startswith("sk-"))

    async def publish(event: dict):
        await redis_client.publish(pub_channel, json.dumps(event))

    async with SessionLocal() as db:
        try:
            # Update status to PROCESSING
            await db.execute(
                update(LogSession)
                .where(LogSession.id == session_uuid)
                .values(status=SessionStatus.PROCESSING)
            )
            await db.commit()
            await publish({"phase": "parsing", "lines_processed": 0, "anomalies_found": 0})

            # Phase 1: Parse
            parsed_lines = parse_log_text(raw_text)
            total_lines = len(parsed_lines)

            await publish({"phase": "inserting", "lines_processed": total_lines, "anomalies_found": 0})

            # Phase 2: Bulk insert log entries
            entries_data = []
            for p in parsed_lines:
                entries_data.append(LogEntry(
                    session_id=session_uuid,
                    line_number=p["line_number"],
                    raw_text=p["raw_text"],
                    timestamp=p["timestamp"],
                    level=p["level"],
                    service=p["service"],
                    message=p["message"],
                ))

            db.add_all(entries_data)
            await db.flush()

            # Retrieve inserted entries with IDs
            result = await db.execute(
                select(LogEntry)
                .where(LogEntry.session_id == session_uuid)
                .order_by(LogEntry.line_number)
            )
            entries = result.scalars().all()

            await publish({"phase": "detecting_anomalies", "lines_processed": total_lines, "anomalies_found": 0})

            # Phase 3: Anomaly detection (no OpenAI needed)
            anomaly_results = detect_anomalies(entries)
            anomaly_records = []

            for entry_idx, score, severity in anomaly_results:
                entry = entries[entry_idx]
                entry.is_anomaly = True
                entry.anomaly_score = score
                context = get_context_lines(entries, entry_idx)
                anomaly_records.append(Anomaly(
                    session_id=session_uuid,
                    entry_id=entry.id,
                    severity=severity,
                    detection_method="IsolationForest",
                    context_lines=context,
                ))

            if anomaly_records:
                db.add_all(anomaly_records)

            # Phase 4: Embeddings (optional - skip if no OpenAI key/quota)
            embeddings = [None] * len(entries)
            if openai_available:
                try:
                    await publish({
                        "phase": "embedding",
                        "lines_processed": total_lines,
                        "anomalies_found": len(anomaly_results),
                    })
                    from app.services.embedder import embed_texts
                    messages = [e.message for e in entries]
                    embeddings = await embed_texts(messages, batch_size=100)
                    for entry, embedding in zip(entries, embeddings):
                        entry.embedding = embedding
                except Exception as emb_err:
                    print(f"[WARNING] Embedding skipped: {emb_err}")
                    embeddings = [None] * len(entries)
            else:
                await publish({
                    "phase": "embedding",
                    "lines_processed": total_lines,
                    "anomalies_found": len(anomaly_results),
                })

            # Phase 5: Clustering
            await publish({
                "phase": "clustering",
                "lines_processed": total_lines,
                "anomalies_found": len(anomaly_results),
            })

            has_embeddings = any(e is not None for e in embeddings)
            if has_embeddings:
                cluster_assignments = cluster_entries(entries, embeddings)
                for entry, cluster_id in zip(entries, cluster_assignments):
                    entry.cluster_id = cluster_id if cluster_id >= 0 else None
            else:
                # Fallback: cluster by level + service
                cluster_map = {}
                cluster_counter = 0
                for entry in entries:
                    key = f"{entry.level.value}:{entry.service or 'unknown'}"
                    if key not in cluster_map:
                        cluster_map[key] = cluster_counter
                        cluster_counter += 1
                    entry.cluster_id = cluster_map[key]

            # Phase 6: Finalize
            await db.execute(
                update(LogSession)
                .where(LogSession.id == session_uuid)
                .values(
                    status=SessionStatus.READY,
                    total_lines=total_lines,
                    anomaly_count=len(anomaly_results),
                    processed_at=datetime.utcnow(),
                )
            )
            await db.commit()

            await publish({
                "phase": "complete",
                "lines_processed": total_lines,
                "anomalies_found": len(anomaly_results),
                "status": "READY",
            })

        except Exception as e:
            await db.rollback()
            await db.execute(
                update(LogSession)
                .where(LogSession.id == session_uuid)
                .values(status=SessionStatus.FAILED)
            )
            await db.commit()
            await publish({"phase": "failed", "error": str(e)})
            raise
        finally:
            await redis_client.close()

    await engine.dispose()


@celery_app.task(name="app.workers.tasks.process_log_session", bind=True, max_retries=2)
def process_log_session(self, session_id: str, raw_text: str):
    """Celery task: process a full log session."""
    try:
        run_async(_process_session_async(session_id, raw_text))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)