
import joblib
import pandas as pd
from pathlib import Path

MODEL_PATH = (
    Path(__file__).resolve().parents[2]
    / "models"
    / "expression_model.joblib"
)

model = joblib.load(MODEL_PATH)

FEATURE_COLUMNS = [
    "mouth_width",
    "mouth_opening",
    "left_eye_opening",
    "right_eye_opening",
    "left_brow_eye",
    "right_brow_eye",
    "corner_lift"
]


def predict_expression(features):

    input_data = pd.DataFrame(
        [features],
        columns=FEATURE_COLUMNS
    )

    prediction = model.predict(input_data)

    return prediction[0]
