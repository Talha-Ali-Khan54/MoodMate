
import pandas as pd
import joblib

from sklearn.svm import SVC
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Load training dataset
df = pd.read_csv("app/data/processed/fer2013_features.csv")

feature_columns = [
    "mouth_width",
    "mouth_opening",
    "left_eye_opening",
    "right_eye_opening",
    "left_brow_eye",
    "right_brow_eye",
    "corner_lift"
]

X = df[feature_columns]
y = df["label"]

# Create final SVM pipeline
model = Pipeline([
    ("scaler", StandardScaler()),
    ("classifier", SVC(kernel="rbf", C=1.0))
])

# Train on all available training samples
model.fit(X, y)

# Save model
joblib.dump(model, "models/expression_model.joblib")

print("SVM model saved successfully!")
