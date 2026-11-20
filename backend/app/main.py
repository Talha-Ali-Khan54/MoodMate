
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.prediction import router as prediction_router

app = FastAPI()

# Allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "Welcome to MoodMate Backend!"
    }

app.include_router(prediction_router, prefix="/api")
