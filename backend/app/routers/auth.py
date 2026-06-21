from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.core.security import verify_password, create_access_token
from backend.app.routers.deps import get_current_user
from backend.app.schemas.auth import Token, UserResponse
from backend.app.models.catalog import Usuario

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate a user and return a JWT access token.
    Supports standard OAuth2 Form data login.
    """
    result = await db.execute(
        select(Usuario).where(Usuario.email == form_data.username, Usuario.activo == True)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
        
    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Usuario = Depends(get_current_user)):
    """
    Get current authenticated user information.
    """
    return current_user
