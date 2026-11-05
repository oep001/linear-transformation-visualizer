"""Numerical regression, API validation, and delivery checks."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


@pytest.mark.parametrize(
    "matrix,vector,expected,det,orientation,rank",
    [
        ([[1, 0], [0, 1]], [3, -2], [3, -2], 1, "preserved", 2),
        ([[0, -1], [1, 0]], [3, 2], [-2, 3], 1, "preserved", 2),
        ([[2, 0], [0, 3]], [1, -2], [2, -6], 6, "preserved", 2),
        ([[0.5, 0], [0, 0.25]], [2, 4], [1, 1], 0.125, "preserved", 2),
        ([[1, 0], [0, -1]], [2, 3], [2, -3], -1, "reversed", 2),
        ([[-1, 0], [0, 1]], [2, 3], [-2, 3], -1, "reversed", 2),
        ([[1, 1.5], [0, 1]], [2, 4], [8, 4], 1, "preserved", 2),
        ([[1, 0], [0, 0]], [2, 3], [2, 0], 0, "collapsed", 1),
        ([[1, 2], [2, 4]], [-2, 3], [4, 8], 0, "collapsed", 1),
        ([[0, 0], [0, 0]], [2, -1], [0, 0], 0, "collapsed", 0),
        ([[2, -3], [4, 0.5]], [0, 0], [0, 0], 13, "preserved", 2),
        ([[-1.5, 0.25], [2, -0.5]], [-2.5, 1.2], [4.05, -5.6], 0.25, "preserved", 2),
        ([[1e-10, 0], [0, 1e-10]], [1, 1], [1e-10, 1e-10], 1e-20, "preserved", 2),
        ([[0.1, 0.2], [0.3, 0.6]], [1, 2], [0.5, 1.5], 0, "collapsed", 1),
        ([[1, 1], [1, 1.000000000000001]], [0, 1], [1, 1.000000000000001], 1e-15, "preserved", 2),
        ([[10000, -10000], [10000, 10000]], [10000, -10000], [200000000, 0], 200000000, "preserved", 2),
    ],
)
def test_representative_transforms(matrix, vector, expected, det, orientation, rank):
    response = client.post("/api/transform", json={"matrix": matrix, "vector": vector})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["transformed_vector"] == pytest.approx(expected)
    assert data["determinant"] == pytest.approx(det, rel=1e-12, abs=0)
    assert data["area_scale"] == abs(data["determinant"])
    assert data["orientation"] == orientation
    assert data["rank"] == rank
    assert data["basis"]["e1"] == [matrix[0][0], matrix[1][0]]
    assert data["basis"]["e2"] == [matrix[0][1], matrix[1][1]]
    assert data["matrix"] == matrix
    assert data["vector"] == vector


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"matrix": [[1, 0]], "vector": [1, 2]},
        {"matrix": [[1, 0, 0], [0, 1, 0]], "vector": [1, 2]},
        {"matrix": [[1, 0], [0, 1]], "vector": [1]},
        {"matrix": [[1, 0], [0, 1]], "vector": [1, 2, 3]},
        {"matrix": [["1", 0], [0, 1]], "vector": [1, 2]},
        {"matrix": [[True, 0], [0, 1]], "vector": [1, 2]},
        {"matrix": [[1, None], [0, 1]], "vector": [1, 2]},
        {"matrix": [[1, 0], [0, 1]], "vector": [False, 2]},
        {"matrix": [[10000.1, 0], [0, 1]], "vector": [1, 2]},
        {"matrix": [[1, 0], [0, 1]], "vector": [-10001, 2]},
        {"matrix": [[1, 0], [0, 1]], "vector": [1, 2], "extra": 1},
        {"matrix": [[1e-200, 0], [0, 1e-200]], "vector": [1, 2]},
    ],
)
def test_rejects_invalid_payload(payload):
    response = client.post("/api/transform", json=payload)
    assert response.status_code == 422
    assert response.json()["detail"]


@pytest.mark.parametrize("token", ["NaN", "Infinity", "-Infinity", "1e999"])
def test_nonfinite_json_never_crashes_server(token):
    response = client.post(
        "/api/transform",
        content='{"matrix":[[' + token + ',0],[0,1]],"vector":[1,2]}',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json()["detail"]


def test_malformed_json():
    response = client.post("/api/transform", content="{broken", headers={"Content-Type": "application/json"})
    assert response.status_code == 422


def test_health_and_version(monkeypatch):
    assert client.get("/health").json() == {"status": "ok"}
    monkeypatch.setenv("APP_VERSION", "1.0.1")
    monkeypatch.setenv("RENDER_GIT_COMMIT", "abcdef123456")
    response = client.get("/api/version")
    assert response.status_code == 200
    assert response.json() == {"version": "1.0.1", "commit": "abcdef123456"}
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    "render_commit,docker_commit,expected",
    [(None, None, "local"), (None, "a" * 40, "a" * 40),
     ("b" * 40, "a" * 40, "b" * 40), ("", "a" * 40, "a" * 40)],
)
def test_version_commit_sources(monkeypatch, render_commit, docker_commit, expected):
    for name, value in (("RENDER_GIT_COMMIT", render_commit), ("GIT_COMMIT", docker_commit)):
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    assert client.get("/api/version").json()["commit"] == expected


def test_frontend_and_api_schema():
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Linear Transformation Visualizer" in response.text
    assert client.get("/static/app.js").status_code == 200
    schema = client.get("/openapi.json").json()
    assert "/api/transform" in schema["paths"]


def test_api_rejects_get_and_unknown_route():
    assert client.get("/api/transform").status_code == 405
    assert client.get("/api/does-not-exist").status_code == 404
