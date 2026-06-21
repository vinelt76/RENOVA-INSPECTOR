from pydantic import BaseModel, EmailStr
from typing import Optional

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: int
    email: str
    rol: str
    empresa_id: Optional[int] = None

class UserResponse(BaseModel):
    id: int
    nombre: str
    email: EmailStr
    rol: str
    empresa_id: Optional[int] = None

    class Config:
        from_attributes = True
