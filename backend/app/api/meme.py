from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
import cv2
import numpy as np
from typing import Optional

from app.vision.face_detector import detect_face
from app.vision.feature_builder import extract_features
from app.ml.predictor import predict_expression

router = APIRouter(prefix="/meme", tags=["meme"])

# Curated, relatable meme captions designed for young adults (15-30) experiencing low/cloudy moods
SUGGESTIONS = {
    "reaction-meme": [
        {
            "top": "WHEN SOMEONE SAYS 'JUST RELAX'",
            "bottom": "THANK YOU I AM SUDDENLY CURED"
        },
        {
            "top": "ME LOOKING AT MY BANK BALANCE",
            "bottom": "AFTER PROMISING I WOULD SAVE THIS MONTH"
        },
        {
            "top": "WHEN YOU REALISE IT'S ONLY TUESDAY",
            "bottom": "AND YOU'VE ALREADY USED 99% OF YOUR ENERGY"
        },
        {
            "top": "I AM TOTALLY FINE",
            "bottom": "NARRATOR: SHE WAS IN FACT, NOT FINE"
        },
        {
            "top": "OPENING AN ASSIGNMENT AT 11:45 PM",
            "bottom": "DUE TODAY AT 11:59 PM"
        }
    ],
    "two-panel": [
        {
            "top": "ME PLANNING TO GET MY ENTIRE LIFE TOGETHER TODAY",
            "bottom": "ME 12 MINUTES LATER STARING AT THE CEILING"
        },
        {
            "top": "BRAIN AT 2 PM: WE ARE GOING TO SLEEP EARLY TONIGHT",
            "bottom": "BRAIN AT 3 AM: DO PENGUINS HAVE KNEES?"
        },
        {
            "top": "HOW I THINK I HANDLE MILD INCONVENIENCES",
            "bottom": "HOW I ACTUALLY HANDLE MILD INCONVENIENCES"
        },
        {
            "top": "TELLING MY FRIEND EVERYTHING WILL BE ALRIGHT",
            "bottom": "ME DEALING WITH MY OWN MINOR INCONVENIENCE"
        }
    ],
    "choice-meme": [
        {
            "top": "FACE MY RESPONSIBILITIES LIKE AN ADULT",
            "middle": "TURN MY OVERTHINKING INTO DUMB MEMES",
            "bottom": "ME CHOOSING THE CHAOS BUTTON EVERY SINGLE TIME"
        },
        {
            "top": "GO FOR A 10 MINUTE HEALTHY WALK",
            "middle": "STARE AT A SCREEN IN THE DARK",
            "bottom": "THE ILLUSION OF FREE CHOICE"
        },
        {
            "top": "FINISH WORK EARLY",
            "middle": "PROCRASTINATE WITH PASSION",
            "bottom": "WHY AM I LIKE THIS?"
        }
    ],
    "expectation-reality": [
        {
            "top": "HOW I EXPECTED TODAY WOULD GO",
            "bottom": "HOW TODAY ACTUALLY HIT ME"
        },
        {
            "top": "ADULTING EXPECTATION: ORGANIZED, HYDRATED, THRIVING",
            "bottom": "ADULTING REALITY: CRYING OVER UNPACKED GROCERIES"
        },
        {
            "top": "SEMESTER EXPECTATIONS: 4.0 GPA & MORNING JOGS",
            "bottom": "SEMESTER REALITY: LIVING ON ICED COFFEE AND PRAYERS"
        },
        {
            "top": "EXPECTATION: CALM, COLLECTED AND UNBOTHERED",
            "bottom": "REALITY: ONE MINOR INCONVENIENCE CRUSHES MY SPIRIT"
        }
    ]
}


@router.get("/suggestions")
def get_meme_suggestions(template: Optional[str] = None):
    """
    Returns curated, mood-boosting meme prompt ideas for the Meme Recreation Studio.
    """
    if template and template in SUGGESTIONS:
        return {
            "template": template,
            "suggestions": SUGGESTIONS[template]
        }
    return {
        "suggestions": SUGGESTIONS
    }


@router.post("/detect-face")
async def detect_face_in_meme(file: UploadFile = File(...)):
    """
    Optional server-side facial analysis for uploaded meme photos.
    Processes the image strictly in memory and returns face bounding boxes,
    facial landmarks, and expression prediction without storing the image.
    """
    # Validate content type
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="File must be an image (JPEG, PNG, WebP)"
        )

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=400,
            detail="Empty image file received"
        )

    # Decode image in memory using OpenCV
    image_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Could not decode image. Please provide a valid JPEG or PNG."
        )

    height, width = image.shape[:2]

    # Detect face using existing MediaPipe FaceLandmarker
    landmarks = detect_face(image)

    if not landmarks or len(landmarks) == 0:
        return {
            "success": False,
            "message": "No face detected in the image. You can still use the full photo or try another one."
        }

    face = landmarks[0]

    # Calculate bounding box
    xs = [lm.x for lm in face]
    ys = [lm.y for lm in face]

    min_x, max_x = max(0.0, min(xs)), min(1.0, max(xs))
    min_y, max_y = max(0.0, min(ys)), min(1.0, max(ys))

    # Extract standard 7 facial features and predict expression
    predicted_expression = "neutral"
    features_dict = {}
    try:
        features_dict = extract_features(face, image.shape)
        # Convert dictionary to ordered feature list matching predictor
        feature_list = [
            features_dict["mouth_width"],
            features_dict["mouth_opening"],
            features_dict["left_eye_opening"],
            features_dict["right_eye_opening"],
            features_dict["left_brow_eye"],
            features_dict["right_brow_eye"],
            features_dict["corner_lift"],
        ]
        predicted_expression = str(predict_expression(feature_list))
    except Exception as e:
        print(f"Prediction warning: {e}")

    # Return key landmarks for client positioning
    # Left eye: 159, Right eye: 386, Mouth center: 13, Nose tip: 1, Chin: 152
    key_points = {
        "left_eye": {"x": face[159].x, "y": face[159].y},
        "right_eye": {"x": face[386].x, "y": face[386].y},
        "mouth": {"x": (face[13].x + face[14].x) / 2, "y": (face[13].y + face[14].y) / 2},
        "nose": {"x": face[1].x, "y": face[1].y},
        "chin": {"x": face[152].x, "y": face[152].y},
    }

    return {
        "success": True,
        "expression": predicted_expression,
        "width": width,
        "height": height,
        "bounding_box": {
            "x": min_x,
            "y": min_y,
            "width": max_x - min_x,
            "height": max_y - min_y
        },
        "key_points": key_points
    }
