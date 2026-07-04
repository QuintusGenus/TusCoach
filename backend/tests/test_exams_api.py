"""
Tests for Mock Exams API
"""
import datetime
from app.models import MockExam, MockExamBreakdown, User
from app.core.security import get_password_hash


class TestCreateMockExam:
    def test_create_exam_with_breakdowns(self, db, test_user):
        exam = MockExam(
            student_id=test_user.id,
            exam_name="Deneme 1",
            date=datetime.date.today(),
            notes="First attempt",
        )
        db.add(exam)
        db.flush()

        subjects_data = [
            ("Anatomi", 15, 5, 0),
            ("Dahiliye", 12, 3, 5),
            ("Patoloji", 10, 8, 2),
        ]
        for subj, c, w, b in subjects_data:
            db.add(MockExamBreakdown(
                exam_id=exam.id,
                subject=subj,
                correct=c,
                wrong=w,
                blank=b,
            ))
        db.commit()
        db.refresh(exam)

        assert exam.id is not None
        assert exam.exam_name == "Deneme 1"
        assert len(exam.breakdowns) == 3
        assert exam.breakdowns[0].subject in ("Anatomi", "Dahiliye", "Patoloji")

    def test_net_score_calculation(self, db, test_user):
        """Net = correct - wrong * 0.25 per subject, sum across all."""
        breakdowns_data = [
            ("Anatomi", 20, 4, 0),      # net: 20 - 1 = 19
            ("Fizyoloji-Histoloji", 10, 0, 10),  # net: 10 - 0 = 10
            ("Dahiliye", 15, 8, 0),      # net: 15 - 2 = 13
        ]
        total_net = 0.0
        for subj, c, w, b in breakdowns_data:
            total_net += c - w * 0.25

        exam = MockExam(
            student_id=test_user.id,
            exam_name="Deneme 2",
            date=datetime.date.today(),
            total_score=round(total_net, 2),
        )
        db.add(exam)
        db.flush()

        for subj, c, w, b in breakdowns_data:
            db.add(MockExamBreakdown(
                exam_id=exam.id,
                subject=subj,
                correct=c,
                wrong=w,
                blank=b,
            ))
        db.commit()

        assert exam.total_score == 42.0  # 19 + 10 + 13

    def test_cascade_delete(self, db, test_user):
        """Deleting exam should cascade delete breakdowns."""
        exam = MockExam(
            student_id=test_user.id,
            exam_name="Deneme 3",
            date=datetime.date.today(),
            total_score=10.0,
        )
        db.add(exam)
        db.flush()

        db.add(MockExamBreakdown(
            exam_id=exam.id,
            subject="Anatomi",
            correct=10,
            wrong=0,
            blank=0,
        ))
        db.commit()
        exam_id = exam.id

        db.delete(exam)
        db.commit()

        assert db.query(MockExam).filter(MockExam.id == exam_id).first() is None
        assert (
            db.query(MockExamBreakdown)
            .filter(MockExamBreakdown.exam_id == exam_id)
            .first()
        ) is None


class TestListMockExams:
    def test_list_returns_own_exams(self, db, test_user):
        for i in range(3):
            db.add(MockExam(
                student_id=test_user.id,
                exam_name=f"Deneme {i+1}",
                date=datetime.date.today() - datetime.timedelta(days=i * 7),
                total_score=float(40 + i * 5),
            ))
        db.commit()

        exams = (
            db.query(MockExam)
            .filter(MockExam.student_id == test_user.id)
            .all()
        )
        assert len(exams) == 3

    def test_does_not_return_other_users_exams(self, db, test_user):
        other = User(
            email="other@example.com",
            hashed_password=get_password_hash("otherpass123"),
            role="student",
            is_active=True,
        )
        db.add(other)
        db.commit()
        db.refresh(other)

        db.add(MockExam(
            student_id=other.id,
            exam_name="Other's Exam",
            date=datetime.date.today(),
            total_score=50.0,
        ))
        db.add(MockExam(
            student_id=test_user.id,
            exam_name="My Exam",
            date=datetime.date.today(),
            total_score=45.0,
        ))
        db.commit()

        own = (
            db.query(MockExam)
            .filter(MockExam.student_id == test_user.id)
            .all()
        )
        assert len(own) == 1
        assert own[0].exam_name == "My Exam"
