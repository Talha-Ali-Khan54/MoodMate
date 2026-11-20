
import pandas as pd

from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score
)


# Load dataset
df = pd.read_csv(
    "app/data/processed/fer2013_features.csv"
)

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


# Train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)


# Base model
rf = RandomForestClassifier(random_state=42)


# Parameters to experiment with
param_grid = {
    "n_estimators": [100, 150],
    "max_depth": [None, 10],
    "min_samples_leaf": [1, 2],
    "class_weight": [None, "balanced"]
}


# Grid search
grid_search = GridSearchCV(
    estimator=rf,
    param_grid=param_grid,
    cv=3,
    scoring="f1_macro",
    n_jobs=2,
    verbose=1
)


print("Starting Random Forest tuning...")

grid_search.fit(X_train, y_train)


# Best model
best_model = grid_search.best_estimator_

print("\n========== BEST PARAMETERS ==========")
print(grid_search.best_params_)

print("\nBest Cross-Validation Macro F1:")
print(round(grid_search.best_score_, 4))


# Evaluate on untouched test set
y_pred = best_model.predict(X_test)

print("\n========== TUNED RANDOM FOREST RESULTS ==========")

print("Accuracy:", round(
    accuracy_score(y_test, y_pred) * 100, 2
), "%")

print("Macro F1:", round(
    f1_score(y_test, y_pred, average="macro"), 4
))

print("\nClassification Report:")
print(classification_report(y_test, y_pred))

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))
