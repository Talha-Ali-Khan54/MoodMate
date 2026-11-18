from fastapi import APIRouter, File, UploadFile,HTTPException
from pydantic import BaseModel
import cv2
import numpy as np

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
    image_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid image file"
        )

    height, width, channels = image.shape
    return {
        "message": "Image processed successfully!",
        "filename": file.filename,
        "width": width,
        "height": height,
        "channels": channels
    }
