
import cv2
import csv
from pathlib import Path

from app.vision.face_detector import detect_face
from app.vision.feature_builder import extract_features


# Dataset location
BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "app" / "data" / "raw" / "fer2013"

# Output location
OUTPUT_DIR = BASE_DIR / "app" / "data" / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CSV_PATH = OUTPUT_DIR / "fer2013_features.csv"

# Settings
categories = ["happy", "sad", "angry", "neutral"]
MAX_IMAGES_PER_CLASS = 500

feature_columns = [
    "mouth_width",
    "mouth_opening",
    "left_eye_opening",
    "right_eye_opening",
    "left_brow_eye",
    "right_brow_eye",
    "corner_lift"
]

columns = ["split", "label", "image_path"] + feature_columns

total_success = 0
total_failed = 0


with open(CSV_PATH, "w", newline="") as file:

    writer = csv.DictWriter(file, fieldnames=columns)
    writer.writeheader()

    # Process training data only
    split = "train"

    for category in categories:

        print(f"\n========== {category.upper()} ==========")

        image_paths = list(
            (DATASET_DIR / split / category).glob("*")
        )[:MAX_IMAGES_PER_CLASS]

        successful = 0
        failed = 0

        for index, image_path in enumerate(image_paths):

            image = cv2.imread(str(image_path))

            if image is None:
                failed += 1
                continue

            # Resize image
            image = cv2.resize(image, (192, 192))

            # Detect facial landmarks
            landmarks = detect_face(image)

            if not landmarks:
                failed += 1
                continue

            # Get first detected face
            landmarks = landmarks[0]

            # Extract facial features
            features = extract_features(
                landmarks,
                image.shape
            )

            # Prepare CSV row
            row = {
                "split": split,
                "label": category,
                "image_path": str(image_path)
            }

            row.update(features)

            # Save extracted features
            writer.writerow(row)
            file.flush()

            successful += 1

            if (index + 1) % 50 == 0:
                print(
                    f"Processed {index + 1}/{len(image_paths)} images"
                )

        total_success += successful
        total_failed += failed

        print("Images selected:", len(image_paths))
        print("Successfully processed:", successful)
        print("Failed:", failed)


print("\n========== FINAL RESULTS ==========")
print("Successfully processed:", total_success)
print("Failed:", total_failed)
print("CSV saved at:", CSV_PATH)
