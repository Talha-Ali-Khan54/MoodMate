
import cv2
import mediapipe as mp
from pathlib import Path

# Get the path to the MediaPipe model
BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "models" / "face_landmarker.task"

# Configure MediaPipe
BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
RunningMode = mp.tasks.vision.RunningMode

options = FaceLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path=str(MODEL_PATH)
    ),
    running_mode=RunningMode.IMAGE,
    num_faces=1
)

# Initialize the model ONCE
landmarker = FaceLandmarker.create_from_options(options)


def detect_face(image):

    # Convert OpenCV BGR image to RGB
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Convert image to MediaPipe format
    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb_image
    )

    # Detect facial landmarks
    result = landmarker.detect(mp_image)

    # Return detected face landmarks
    return result.face_landmarks
