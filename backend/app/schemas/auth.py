from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

from typing import Optional

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    student_id: Optional[int] = None
    display_name: Optional[str] = None

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) < 1 or len(v) > 50:
                raise ValueError("İsim 1-50 karakter arasında olmalıdır")
        return v
