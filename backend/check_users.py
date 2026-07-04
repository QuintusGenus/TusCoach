from app.core.db import SessionLocal
from app.models.user import User, StudentProfile
from app.models.events import EventLog

def check_data():
    db = SessionLocal()
    
    print("\n=== USERS ===")
    users = db.query(User).all()
    for u in users:
        print(f"ID: {u.id}, Email: {u.email}, Active: {u.is_active}")
        if u.student_profile:
            print(f"  -> Student Profile ID: {u.student_profile.id}")
        else:
            print("  -> No Student Profile")

    print("\n=== LOGIN HISTORY (Last 5) ===")
    logs = db.query(EventLog).filter(EventLog.event_type == "user_login").order_by(EventLog.created_at.desc()).limit(5).all()
    for log in logs:
        print(f"User {log.student_id} at {log.created_at}: {log.payload}")

    db.close()

if __name__ == "__main__":
    check_data()
