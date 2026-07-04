#!/usr/bin/env python3
"""Create a test user for mobile testing"""
from app.core.db import SessionLocal
from app.models.user import User, StudentProfile
from app.core.security import get_password_hash

def create_test_user(email: str, password: str):
    db = SessionLocal()
    try:
        # Check if user exists
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"User {email} already exists")
            return

        # Create user
        user = User(
            email=email,
            hashed_password=get_password_hash(password),
            is_active=True,
            role="student"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create student profile
        profile = StudentProfile(user_id=user.id)
        db.add(profile)
        db.commit()

        print(f"✅ Created user: {email}")
        print(f"   Password: {password}")
        print(f"   User ID: {user.id}")
        print(f"   Profile ID: {profile.id}")

    finally:
        db.close()

if __name__ == "__main__":
    create_test_user("mobile@test.com", "test123")
