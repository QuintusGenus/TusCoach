from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.services.scoring_service import compute_risk_score, compute_adherence_7d, compute_inactivity_hours, compute_weak_topics_top3
from app.models import User
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/students/{student_id}/scores")
def get_student_scores(
    student_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get computed scores for a student.
    Debug endpoint.
    """
    # Check user exists
    user = db.get(User, student_id)
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    return {
        "student_id": student_id,
        "risk_score": compute_risk_score(db, student_id),
        "adherence_7d": compute_adherence_7d(db, student_id),
        "inactivity_hours": compute_inactivity_hours(db, student_id),
        "weak_topics": compute_weak_topics_top3(db, student_id)
    }
