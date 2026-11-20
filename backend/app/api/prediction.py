
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.ml.predictor import predict_expression

router = APIRouter()


class PredictionRequest(BaseModel):
    features: list[float]


@router.post("/predict")
async def predict(request: PredictionRequest):

    features = request.features

    if len(features) != 7:
        raise HTTPException(
            status_code=400,
            detail="Expected exactly 7 facial features"
        )

    expression = predict_expression(features)

    return {
        "label": str(expression),
        "source": "model"
    }
