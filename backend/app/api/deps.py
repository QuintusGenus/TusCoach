from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.models.user import User

settings = get_settings()

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl="/v1/auth/login"
)

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str, Depends(reusable_oauth2)],
) -> User:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALG],
            options={"require_exp": True, "require_sub": True},
        )
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise _CREDENTIALS_EXC

    sub = payload.get("sub")
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise _CREDENTIALS_EXC

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return user
