from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.core.security import decode_access_token
from backend.app.models.catalog import Usuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Usuario:
    """
    Decodes the JWT token to fetch the current authenticated user.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    subject = decode_access_token(token)
    if subject is None:
        raise credentials_exception
        
    try:
        user_id = int(subject)
    except ValueError:
        raise credentials_exception
        
    # Query user from public schema
    result = await db.execute(
        select(Usuario).where(Usuario.id == user_id, Usuario.activo == True)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
        
    return user

async def get_tenant_db(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> AsyncSession:
    """
    Dependency that configures the session's search path to route queries 
    to the correct tenant-specific database schema.
    """
    if current_user.empresa_id:
        # Route to tenant-specific schema and fallback to public
        schema_name = f"empresa_{current_user.empresa_id}"
        await db.execute(text(f"SET search_path TO {schema_name}, public;"))
    else:
        # Admin or system-wide user, fall back to public
        await db.execute(text("SET search_path TO public;"))
        
    return db
