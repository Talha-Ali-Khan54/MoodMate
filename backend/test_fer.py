
import cv2
import glob

from app.vision.face_detector import detect_face
from app.vision.feature_builder import extract_features

# FER2013 categories we want to test
categories = ["happy", "sad", "angry", "neutral"]

for category in categories:

    print(f"\n========== {category.upper()} ==========")

    image_paths = glob.glob(
        f"app/data/raw/fer2013/train/{category}/*"
    )[:10]

    successful = 0
    failed = 0

    for image_path in image_paths:

        image = cv2.imread(image_path)

        if image is None:
            failed += 1
            continue

        # Resize image
        image = cv2.resize(image, (192, 192))

        # Detect facial landmarks
        landmarks = detect_face(image)

        if landmarks:
            # Get landmarks of the first detected face
            landmarks = landmarks[0]

            # Extract facial features
            features = extract_features(landmarks, image.shape)

            successful += 1

        else:
            failed += 1

    print("Total images:", len(image_paths))
    print("Successfully processed:", successful)
    print("Failed:", failed)
