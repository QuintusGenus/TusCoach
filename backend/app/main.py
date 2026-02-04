"""
TUS Coaching App - FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="TUS Coaching App",
    description="API for Turkish Medical Residency Entrance Exam coaching",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "TUS Coaching App API", "status": "running"}


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {"status": "healthy", "version": "0.1.0"}
