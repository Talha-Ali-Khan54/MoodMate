
from app.ml.predictor import predict_expression

features = {
    "mouth_width": 0.38,
    "mouth_opening": 0.05,
    "left_eye_opening": 0.06,
    "right_eye_opening": 0.06,
    "left_brow_eye": 0.16,
    "right_brow_eye": 0.15,
    "corner_lift": 0.02
}

result = predict_expression(features)

print("Predicted expression:", result)
