from fastapi import APIRouter, File, UploadFile,HTTPException,Form
from pydantic import BaseModel
import cv2
import numpy as np
from app.vision.face_detector import detect_face
from app.vision.feature_builder import extract_features
import csv
from pathlib import Path


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

@router.post("/detect-face")
async def detect_face_endpoint(file: UploadFile = File(...)):

    image_bytes = await file.read()

    image_array = np.frombuffer(image_bytes, np.uint8)

    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid image file"
        )

    landmarks = detect_face(image)

   

    if not landmarks:
        return {
            "success": False,
            "message": "No face detected"
        }
    
    features = extract_features(landmarks[0], image.shape)
    return {
        "success": True,
        "message": "Face detected and features extracted!",
        "landmark_count": len(landmarks[0]),
        "features": features
    }


    # Location of our dataset
DATASET_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "moodmate_dataset.csv"
)


@router.post("/collect-sample")
async def collect_sample(
    participant_id: str = Form(...),
    expression: str = Form(...),
    file: UploadFile = File(...)
):

    # Step 1: Validate expression label
    valid_expressions = [
        "smiling",
        "neutral",
        "frowning",
        "surprised"
    ]

    expression = expression.strip().lower()

    if expression not in valid_expressions:
        raise HTTPException(
            status_code=400,
            detail="Invalid expression label"
        )

    # Step 2: Read uploaded image
    image_bytes = await file.read()

    # Step 3: Decode image
    image_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid image file"
        )

    # Step 4: Detect face
    landmarks = detect_face(image)

    if not landmarks:
        raise HTTPException(
            status_code=400,
            detail="No face detected"
        )

    # Step 5: Extract features
    features = extract_features(
        landmarks[0],
        image.shape
    )

    # Step 6: Create dataset directory
    DATASET_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    # Step 7: Define CSV columns
    fieldnames = [
        "participant_id",
        "expression",
        *features.keys()
    ]

    # Step 8: Append sample to CSV
    file_exists = DATASET_PATH.exists()

    with open(
        DATASET_PATH,
        "a",
        newline="",
        encoding="utf-8"
    ) as csvfile:

        writer = csv.DictWriter(
            csvfile,
            fieldnames=fieldnames
        )

        if not file_exists:
            writer.writeheader()

        writer.writerow({
            "participant_id": participant_id,
            "expression": expression,
            **features
        })

    return {
        "success": True,
        "message": "Sample saved successfully!",
        "participant_id": participant_id,
        "expression": expression
    }