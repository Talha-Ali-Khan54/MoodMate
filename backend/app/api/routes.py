from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class MoodRequest(BaseModel):
    mood: str
    energy: str
    available_minutes: int


@router.get("/health")
def health_check():
    return {
        "status": "running",
        "project": "MoodMate"
    }


@router.post("/recommend-activity")
def recommend_activity(data: MoodRequest):
    return {
        "message": "Mood data received successfully!",
        "received_data": {
            "mood": data.mood,
            "energy": data.energy,
            "available_minutes": data.available_minutes
        }
    }