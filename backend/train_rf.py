
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)


# 1. Load dataset
df = pd.read_csv(
    "app/data/processed/fer2013_features.csv"
)

# 2. Separate features and labels
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


# 3. Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)


# 4. Create Random Forest model
model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)


# 5. Train model
print("Training Random Forest...")
model.fit(X_train, y_train)


# 6. Make predictions
y_pred = model.predict(X_test)


# 7. Evaluate model
print("\n========== RANDOM FOREST RESULTS ==========")

accuracy = accuracy_score(y_test, y_pred)

print("Accuracy:", round(accuracy * 100, 2), "%")

print("\nClassification Report:")
print(classification_report(y_test, y_pred))

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))


# 8. Display feature importance
print("\n========== FEATURE IMPORTANCE ==========")

for name, importance in zip(
    feature_columns,
    model.feature_importances_
):
    print(f"{name}: {importance:.4f}")
