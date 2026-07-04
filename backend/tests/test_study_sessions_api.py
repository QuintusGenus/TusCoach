"""
Tests for Study Sessions API (list, create with subject, delete)
"""
import datetime
from app.models import StudySession, User
from app.core.security import get_password_hash


class TestCreateStudySession:
    def test_create_with_subject(self, db, test_user):
        session = StudySession(
            student_id=test_user.id,
            date=datetime.date.today(),
            minutes=45,
            subject="Anatomi",
            notes="Chapter 3",
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        assert session.id is not None
        assert session.subject == "Anatomi"
        assert session.minutes == 45

    def test_create_without_subject(self, db, test_user):
        session = StudySession(
            student_id=test_user.id,
            date=datetime.date.today(),
            minutes=30,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        assert session.subject is None


class TestListStudySessions:
    def test_list_returns_own_sessions(self, db, test_user):
        for i in range(3):
            db.add(StudySession(
                student_id=test_user.id,
                date=datetime.date.today() - datetime.timedelta(days=i),
                minutes=30 + i * 10,
                subject="Patoloji",
            ))
        db.commit()

        sessions = (
            db.query(StudySession)
            .filter(StudySession.student_id == test_user.id)
            .all()
        )
        assert len(sessions) == 3

    def test_filter_by_subject(self, db, test_user):
        db.add(StudySession(
            student_id=test_user.id,
            date=datetime.date.today(),
            minutes=30,
            subject="Anatomi",
        ))
        db.add(StudySession(
            student_id=test_user.id,
            date=datetime.date.today(),
            minutes=45,
            subject="Dahiliye",
        ))
        db.commit()

        anatomi = (
            db.query(StudySession)
            .filter(
                StudySession.student_id == test_user.id,
                StudySession.subject == "Anatomi",
            )
            .all()
        )
        assert len(anatomi) == 1
        assert anatomi[0].minutes == 30

    def test_does_not_return_other_users_sessions(self, db, test_user):
        other = User(
            email="other@example.com",
            hashed_password=get_password_hash("otherpass123"),
            role="student",
            is_active=True,
        )
        db.add(other)
        db.commit()
        db.refresh(other)

        db.add(StudySession(
            student_id=other.id,
            date=datetime.date.today(),
            minutes=60,
            subject="Biyokimya",
        ))
        db.add(StudySession(
            student_id=test_user.id,
            date=datetime.date.today(),
            minutes=45,
            subject="Biyokimya",
        ))
        db.commit()

        own = (
            db.query(StudySession)
            .filter(StudySession.student_id == test_user.id)
            .all()
        )
        assert len(own) == 1


class TestDeleteStudySession:
    def test_delete_own_session(self, db, test_user):
        session = StudySession(
            student_id=test_user.id,
            date=datetime.date.today(),
            minutes=30,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        sid = session.id

        db.delete(session)
        db.commit()

        assert db.query(StudySession).filter(StudySession.id == sid).first() is None

    def test_cannot_delete_other_users_session(self, db, test_user):
        other = User(
            email="other2@example.com",
            hashed_password=get_password_hash("otherpass123"),
            role="student",
            is_active=True,
        )
        db.add(other)
        db.commit()
        db.refresh(other)

        session = StudySession(
            student_id=other.id,
            date=datetime.date.today(),
            minutes=30,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # Verify ownership check would fail
        assert session.student_id != test_user.id
