
import pandas as pd

from sklearn.model_selection import train_test_split

# Load dataset
df = pd.read_csv(
    "app/data/processed/fer2013_features.csv"
)

# Select the seven input features
X = df[
    [
        "mouth_width",
        "mouth_opening",
        "left_eye_opening",
        "right_eye_opening",
        "left_brow_eye",
        "right_brow_eye",
        "corner_lift"
    ]
]

# Select target labels
y = df["label"]

# Split into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# Display results
print("========== DATA SPLIT ==========")

print("Total samples:", len(X))

print("\nTraining samples:", len(X_train))
print("Testing samples:", len(X_test))

print("\nTraining class distribution:")
print(y_train.value_counts())

print("\nTesting class distribution:")
print(y_test.value_counts())
