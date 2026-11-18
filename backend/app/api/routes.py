from fastapi import APIRouter, File, UploadFile
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

@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):

    image_bytes = await file.read()

    return {
        "message": "Image uploaded successfully!",
        "filename": file.filename,
        "content_type": file.content_type,
        "file_size": len(image_bytes)
    }