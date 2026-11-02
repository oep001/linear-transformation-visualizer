"""Validated numerical API and same-origin static frontend."""

from __future__ import annotations

from decimal import Decimal, localcontext
import math
import os
from pathlib import Path
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import numpy as np
from pydantic import BaseModel, ConfigDict, Field


ROOT = Path(__file__).resolve().parent.parent
Number = Annotated[
    float,
    Field(strict=True, ge=-10000, le=10000, allow_inf_nan=False),
]
Vector = tuple[Number, Number]
Matrix = tuple[Vector, Vector]


class TransformRequest(BaseModel):
    """JSON numbers only; a matrix has exactly two rows and two columns."""

    model_config = ConfigDict(extra="forbid")
    matrix: Matrix
    vector: Vector


class Basis(BaseModel):
    e1: tuple[float, float]
    e2: tuple[float, float]


class TransformResponse(BaseModel):
    matrix: tuple[tuple[float, float], tuple[float, float]]
    vector: tuple[float, float]
    transformed_vector: tuple[float, float]
    determinant: float
    basis: Basis
    area_scale: float
    orientation: Literal["preserved", "reversed", "collapsed"]
    rank: Literal[0, 1, 2]


app = FastAPI(
    title="Linear Transformation Visualizer",
    description="2×2 행렬과 2차원 벡터의 선형변환 계산 API",
    version="1.0.0",
)
app.mount("/static", StaticFiles(directory=ROOT / "static", check_dir=False), name="static")


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Do not echo untrusted input: NaN/Infinity are not valid JSON response values.
    detail = [
        {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": detail})


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(ROOT / "static" / "index.html", headers={"Cache-Control": "no-cache"})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/version")
def version() -> JSONResponse:
    return JSONResponse(
        content={
            "version": os.getenv("APP_VERSION", "1.0.0"),
            "commit": os.getenv("RENDER_GIT_COMMIT", "local"),
        },
        headers={"Cache-Control": "no-store"},
    )


def _determinant(matrix: Matrix) -> tuple[float, int]:
    """Evaluate ad−bc without an arbitrary singularity tolerance.

    JSON numbers are first parsed as binary floats. Their shortest decimal
    representations define the accepted numerical inputs. Each has at most
    17 significant digits, so 80 decimal digits comfortably preserve product
    cancellation. Decimal avoids numpy.linalg.det's rounding to a tiny nonzero
    value for a truly singular 2×2 matrix.
    """
    with localcontext() as context:
        context.prec = 80
        a, b = (Decimal(str(value)) for value in matrix[0])
        c, d = (Decimal(str(value)) for value in matrix[1])
        exact = a * d - b * c
    determinant = float(exact)
    if not math.isfinite(determinant) or (exact != 0 and determinant == 0):
        raise HTTPException(
            status_code=422,
            detail="행렬식이 표현 가능한 수치 범위를 벗어났습니다. 입력값의 크기를 조정해 주세요.",
        )
    sign = 0 if exact == 0 else (1 if exact > 0 else -1)
    return (0.0 if determinant == 0 else determinant), sign


@app.post("/api/transform", response_model=TransformResponse)
def transform(payload: TransformRequest) -> TransformResponse:
    matrix = np.asarray(payload.matrix, dtype=np.float64)
    vector = np.asarray(payload.vector, dtype=np.float64)
    with np.errstate(over="raise", invalid="raise"):
        try:
            result = matrix @ vector
        except FloatingPointError as error:
            raise HTTPException(status_code=422, detail="계산 결과가 수치 범위를 벗어났습니다.") from error
    if not np.isfinite(result).all():
        raise HTTPException(status_code=422, detail="계산 결과는 유한한 수여야 합니다.")

    determinant, sign = _determinant(payload.matrix)
    rank = 2 if sign else (1 if np.any(matrix != 0) else 0)
    orientation = "preserved" if sign > 0 else "reversed" if sign < 0 else "collapsed"

    return TransformResponse(
        matrix=payload.matrix,
        vector=payload.vector,
        transformed_vector=(float(result[0]), float(result[1])),
        determinant=determinant,
        basis=Basis(e1=(matrix[0, 0], matrix[1, 0]), e2=(matrix[0, 1], matrix[1, 1])),
        area_scale=abs(determinant),
        orientation=orientation,
        rank=rank,
    )
