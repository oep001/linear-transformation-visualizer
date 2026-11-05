"""Check a running service using only Python's standard library."""

import argparse
import json
import time
import urllib.request


def check(base_url, commit=None):
    def request(path, payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(
            base_url.rstrip("/") + path,
            data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status != 200:
                raise RuntimeError(f"{path}: HTTP {response.status}")
            return response.read().decode()

    if json.loads(request("/health")) != {"status": "ok"}:
        raise RuntimeError("Health response mismatch")
    version = json.loads(request("/api/version"))
    if commit is not None and version["commit"] != commit:
        raise RuntimeError(f"Commit mismatch: {version['commit']} != {commit}")
    result = json.loads(request("/api/transform", {
        "matrix": [[0, -1], [1, 0]], "vector": [2, 1],
    }))
    if (result["transformed_vector"] != [-1, 2]
            or result["determinant"] != 1
            or result["basis"] != {"e1": [0, 1], "e2": [-1, 0]}):
        raise RuntimeError(f"Transform mismatch: {result}")
    if "Linear Transformation Visualizer" not in request("/"):
        raise RuntimeError("Frontend missing")
    for path in ("/static/app.js", "/static/styles.css"):
        if not request(path):
            raise RuntimeError(f"Empty static asset: {path}")
    return {"base_url": base_url, "version": version, "transform": result, "status": "passed"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--commit")
    parser.add_argument("--attempts", type=int, default=30)
    args = parser.parse_args()
    for attempt in range(args.attempts):
        try:
            print(json.dumps(check(args.url, args.commit), ensure_ascii=False, indent=2))
            break
        except Exception as error:
            if attempt == args.attempts - 1:
                raise
            print(f"Waiting for service ({attempt + 1}/{args.attempts}): {error}", flush=True)
            time.sleep(2)
