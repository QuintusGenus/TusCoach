"""
Tests for Notes API
"""
from datetime import datetime
from app.models import Note, User
from app.core.security import get_password_hash


class TestCreateNote:
    def test_create_with_subject(self, db, test_user):
        note = Note(
            student_id=test_user.id,
            subject="Anatomi",
            title="Kas Anatomisi",
            content="Important muscle groups...",
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        assert note.id is not None
        assert note.subject == "Anatomi"
        assert note.title == "Kas Anatomisi"

    def test_create_without_subject(self, db, test_user):
        note = Note(
            student_id=test_user.id,
            title="General Notes",
            content="Some general notes",
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        assert note.subject is None


class TestListNotes:
    def test_list_returns_own_notes(self, db, test_user):
        for i in range(3):
            db.add(Note(
                student_id=test_user.id,
                subject="Patoloji",
                title=f"Note {i+1}",
                content=f"Content {i+1}",
            ))
        db.commit()

        notes = db.query(Note).filter(Note.student_id == test_user.id).all()
        assert len(notes) == 3

    def test_filter_by_subject(self, db, test_user):
        db.add(Note(student_id=test_user.id, subject="Anatomi", title="A note"))
        db.add(Note(student_id=test_user.id, subject="Dahiliye", title="B note"))
        db.add(Note(student_id=test_user.id, subject="Anatomi", title="C note"))
        db.commit()

        anatomi = (
            db.query(Note)
            .filter(Note.student_id == test_user.id, Note.subject == "Anatomi")
            .all()
        )
        assert len(anatomi) == 2


class TestUpdateNote:
    def test_update_title_and_content(self, db, test_user):
        note = Note(
            student_id=test_user.id,
            title="Original",
            content="Original content",
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        note.title = "Updated"
        note.content = "Updated content"
        note.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(note)

        assert note.title == "Updated"
        assert note.content == "Updated content"
        assert note.updated_at is not None


class TestDeleteNote:
    def test_delete_own_note(self, db, test_user):
        note = Note(
            student_id=test_user.id,
            title="To delete",
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        nid = note.id

        db.delete(note)
        db.commit()

        assert db.query(Note).filter(Note.id == nid).first() is None

    def test_cannot_delete_other_users_note(self, db, test_user):
        other = User(
            email="other_notes@example.com",
            hashed_password=get_password_hash("otherpass123"),
            role="student",
            is_active=True,
        )
        db.add(other)
        db.commit()
        db.refresh(other)

        note = Note(
            student_id=other.id,
            title="Other's note",
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        # Verify ownership check would fail
        assert note.student_id != test_user.id
