"""
Shared pytest fixtures for all tests
"""
import pytest
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models.base import Base
from app.models.user import User, StudentProfile
from app.core.security import get_password_hash

# Use test database with same credentials as dev
# If DATABASE_URL env var exists, use it; otherwise use default test config
test_db_url = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://tuscoach:tuscoach123@localhost:5433/tuscoach_test"
)
engine = create_engine(test_db_url, echo=False)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """
    Create fresh database session for each test.
    Creates all tables before test and drops them after.
    """
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    # Ensure the unique constraint exists for plan_tasks
    try:
        session.execute(text("""
            ALTER TABLE plan_tasks
            ADD CONSTRAINT uq_plan_task
            UNIQUE (plan_id, date, topic_id, task_type)
        """))
        session.commit()
    except Exception:
        # Constraint might already exist
        session.rollback()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(db):
    """
    Create a test user for tests that need authentication.
    """
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("testpass123"),
        role="student",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_student_profile(db, test_user):
    """
    Create a student profile for the test user.
    """
    profile = StudentProfile(user_id=test_user.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile
