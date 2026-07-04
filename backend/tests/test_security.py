"""
Tests for security hardening: password policy, JWT, rate limiting.
"""
import time
import pytest
from datetime import timedelta, timezone, datetime
from unittest.mock import MagicMock

from pydantic import ValidationError
from jose import jwt
from fastapi import HTTPException

from app.schemas.auth import UserCreate
from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.config import get_settings
from app.core.rate_limit import RateLimiter


# ── Password policy ──

class TestPasswordPolicy:
    def test_short_password_rejected(self):
        """Passwords under 8 chars must be rejected by the schema."""
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(email="a@b.com", password="short")
        assert "at least 8 characters" in str(exc_info.value)

    def test_7_char_password_rejected(self):
        with pytest.raises(ValidationError):
            UserCreate(email="a@b.com", password="1234567")

    def test_8_char_password_accepted(self):
        user = UserCreate(email="a@b.com", password="12345678")
        assert user.password == "12345678"

    def test_long_password_accepted(self):
        user = UserCreate(email="a@b.com", password="a" * 100)
        assert len(user.password) == 100


# ── Password hashing (argon2) ──

class TestPasswordHashing:
    def test_hash_and_verify(self):
        raw = "securepassword123"
        hashed = get_password_hash(raw)
        assert hashed != raw
        assert verify_password(raw, hashed)

    def test_wrong_password_fails(self):
        hashed = get_password_hash("correct-password")
        assert not verify_password("wrong-password", hashed)

    def test_hash_uses_argon2(self):
        hashed = get_password_hash("testpass")
        assert hashed.startswith("$argon2")


# ── JWT ──

class TestJWT:
    def test_token_contains_exp_and_sub(self):
        token = create_access_token(subject=42)
        settings = get_settings()
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        assert "exp" in payload
        assert payload["sub"] == "42"

    def test_custom_expiry(self):
        token = create_access_token(subject=1, expires_delta=timedelta(minutes=5))
        settings = get_settings()
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        # exp should be roughly 5 min from now
        exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        diff = (exp_dt - datetime.now(timezone.utc)).total_seconds()
        assert 200 < diff < 310  # between ~3 and ~5 min (allow clock skew)

    def test_expired_token_raises(self):
        token = create_access_token(subject=1, expires_delta=timedelta(seconds=-1))
        settings = get_settings()
        with pytest.raises(Exception):  # ExpiredSignatureError
            jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALG],
                options={"require_exp": True},
            )


# ── Rate limiter ──

class TestRateLimiter:
    def _make_request(self, ip: str = "127.0.0.1") -> MagicMock:
        req = MagicMock()
        req.client.host = ip
        return req

    def test_allows_under_limit(self):
        limiter = RateLimiter(max_calls=3, window_seconds=60)
        req = self._make_request()
        # Should not raise for first 3 calls
        for _ in range(3):
            limiter(req)

    def test_blocks_over_limit(self):
        limiter = RateLimiter(max_calls=3, window_seconds=60)
        req = self._make_request()
        for _ in range(3):
            limiter(req)
        with pytest.raises(HTTPException) as exc_info:
            limiter(req)
        assert exc_info.value.status_code == 429

    def test_different_ips_independent(self):
        limiter = RateLimiter(max_calls=2, window_seconds=60)
        req_a = self._make_request("1.1.1.1")
        req_b = self._make_request("2.2.2.2")
        limiter(req_a)
        limiter(req_a)
        # IP A exhausted
        with pytest.raises(HTTPException):
            limiter(req_a)
        # IP B still has budget
        limiter(req_b)

    def test_window_resets(self):
        limiter = RateLimiter(max_calls=2, window_seconds=1)
        req = self._make_request()
        limiter(req)
        limiter(req)
        with pytest.raises(HTTPException):
            limiter(req)
        # Wait for window to expire
        time.sleep(1.1)
        limiter(req)  # Should succeed after window reset
