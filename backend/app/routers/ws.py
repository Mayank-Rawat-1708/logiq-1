import uuid
import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
import redis.asyncio as aioredis

from app.config import settings
from app.utils.security import decode_token
from app.models.log_session import LogSession

router = APIRouter(tags=["websocket"])


@router.websocket("/sessions/{session_id}/stream")
async def stream_session_progress(
    websocket: WebSocket,
    session_id: uuid.UUID,
    token: str = Query(...),
):
    # Validate JWT
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001)
        return

    await websocket.accept()

    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = f"session_progress:{session_id}"

    try:
        await pubsub.subscribe(channel)
        await websocket.send_json({"type": "connected", "session_id": str(session_id)})

        # Listen for messages with timeout
        timeout = 300  # 5 minutes max
        elapsed = 0
        interval = 0.1

        while elapsed < timeout:
            try:
                message = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=0.5)
            except asyncio.TimeoutError:
                message = None

            if message and message.get("data"):
                data = json.loads(message["data"])
                await websocket.send_json(data)
                if data.get("phase") in ("complete", "failed"):
                    break

            # Heartbeat every 5 seconds
            elapsed += interval
            if elapsed % 5 < interval:
                await websocket.send_json({"type": "heartbeat"})

            await asyncio.sleep(interval)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await redis_client.close()
        try:
            await websocket.close()
        except Exception:
            pass
