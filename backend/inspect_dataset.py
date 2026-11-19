
import pandas as pd

# Load extracted dataset
df = pd.read_csv(
    "app/data/processed/fer2013_features.csv"
)

# 1. Dataset size
print("\n========== DATASET SIZE ==========")
print("Rows and columns:", df.shape)

# 2. Samples per class
print("\n========== CLASS DISTRIBUTION ==========")
print(df["label"].value_counts())

# 3. Check missing values
print("\n========== MISSING VALUES ==========")
print(df.isnull().sum())

# 4. Feature statistics
print("\n========== FEATURE STATISTICS ==========")
print(df.describe())

# 5. Preview first five rows
print("\n========== FIRST FIVE ROWS ==========")
print(df.head())
