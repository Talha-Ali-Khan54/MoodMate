
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score
)

# Load training and testing datasets
train_df = pd.read_csv(
    "app/data/processed/fer2013_features.csv"
)

test_df = pd.read_csv(
    "app/data/processed/fer2013_test_features.csv"
)

# Select features
feature_columns = [
    "mouth_width",
    "mouth_opening",
    "left_eye_opening",
    "right_eye_opening",
    "left_brow_eye",
    "right_brow_eye",
    "corner_lift"
]

# Training data
X_train = train_df[feature_columns]
y_train = train_df["label"]

# Testing data
X_test = test_df[feature_columns]
y_test = test_df["label"]

# Create original Random Forest model
model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

# Train model
print("Training Random Forest...")
model.fit(X_train, y_train)

# Predict test labels
y_pred = model.predict(X_test)

# Evaluate
print("\n========== OFFICIAL TEST RESULTS ==========")

print(
    "Accuracy:",
    round(accuracy_score(y_test, y_pred) * 100, 2),
    "%"
)

print(
    "Macro F1:",
    round(f1_score(y_test, y_pred, average="macro"), 4)
)

print("\nClassification Report:")
print(classification_report(y_test, y_pred))

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))
