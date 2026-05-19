from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
import uuid

from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.utils.redis_client import get_redis
from app.config import settings


async def register_user(data: UserRegister, db: AsyncSession) -> tuple[User, str, str]:
    result = await db.execute(select(User).where(User.email == data.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    redis = await get_redis()
    await redis.setex(
        f"refresh:{str(user.id)}:{refresh_token[:20]}",
        settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        refresh_token,
    )

    return user, access_token, refresh_token


async def login_user(data: UserLogin, db: AsyncSession) -> tuple[User, str, str]:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    redis = await get_redis()
    await redis.setex(
        f"refresh:{str(user.id)}:{refresh_token[:20]}",
        settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        refresh_token,
    )

    return user, access_token, refresh_token


async def refresh_access_token(refresh_token: str, db: AsyncSession) -> str:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    redis = await get_redis()
    stored = await redis.get(f"refresh:{user_id}:{refresh_token[:20]}")
    if not stored or stored != refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not recognized or expired")

    new_access_token = create_access_token({"sub": user_id})
    return new_access_token


async def logout_user(access_token: str, refresh_token: str, user_id: str):
    redis = await get_redis()
    payload = decode_token(access_token)
    if payload:
        ttl = max(int(payload.get("exp", 0) - __import__("time").time()), 1)
        await redis.setex(f"blacklist:{access_token}", ttl, "1")

    refresh_payload = decode_token(refresh_token) if refresh_token else None
    if refresh_payload:
        await redis.delete(f"refresh:{user_id}:{refresh_token[:20]}")
