# TUS Coaching App

A comprehensive coaching application for the Turkish Medical Residency Entrance Exam (Tıpta Uzmanlık Sınavı - TUS).

## Features (Planned)

- 📚 Question bank with categorized practice questions
- ⏱️ Mock exams and timed tests
- 📊 Performance analytics and progress tracking
- 📅 Study scheduling and reminders
- 🎯 Personalized learning recommendations

## Project Structure

```
TusCoach/
├── backend/          # FastAPI Python backend
├── frontend/         # React/Next.js frontend
├── docs/             # Documentation
└── scripts/          # Utility scripts
```

## Getting Started

### Backend Setup

```bash
# Navigate to backend
cd backend

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the development server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy
- **Frontend**: React/Next.js, TypeScript
- **Database**: PostgreSQL (planned)

## License

MIT
