from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.database import get_db
from app.schemas.auth import UserRegister, UserLogin, TokenRefresh, TokenResponse, UserResponse, AuthResponse
from app.services.auth_service import register_user, login_user, refresh_access_token, logout_user
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


@router.post("/register", response_model=AuthResponse)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    user, access_token, refresh_token = await register_user(data, db)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=AuthResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user, access_token, refresh_token = await login_user(data, db)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    new_access_token = await refresh_access_token(data.refresh_token, db)
    return TokenResponse(access_token=new_access_token, refresh_token=data.refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(
    data: dict = Body(default={}),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: User = Depends(get_current_user),
):
    refresh_token = data.get("refresh_token", "")
    await logout_user(credentials.credentials, refresh_token, str(current_user.id))
    return {"message": "Logged out successfully"}
