/* SVG rendering and interpolation run in the browser; all final results come from FastAPI. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const matrixInputs = [$("matrix-a"), $("matrix-b"), $("matrix-c"), $("matrix-d")];
  const vectorInputs = [$("vector-x"), $("vector-y")];
  const numericInputs = [...matrixInputs, ...vectorInputs];
  const svg = $("coordinate-plot");
  const NS = "http://www.w3.org/2000/svg";
  const IDENTITY = [[1, 0], [0, 1]];
  const COLORS = { original: "#53667f", transformed: "#7961d5", e1: "#ed8356", e2: "#119a85", grid: "#6f9fdc" };
  const presetNames = { identity: "항등변환", rotation: "회전변환", "scale-up": "2배 확대", "scale-down": "½배 축소", "reflect-x": "x축 대칭", "reflect-y": "y축 대칭", shear: "전단변환", projection: "x축 사영" };
  const state = { result: null, progress: 1, frame: null, playing: false, request: 0, abort: null, timer: null, valid: false, pending: false, zoom: 1, preset: "identity" };

  function format(value) {
    if (Object.is(value, -0) || value === 0) return "0";
    const abs = Math.abs(value);
    if (abs >= 1000000 || abs < 0.0001) return value.toExponential(4).replace(/\.?0+e/, "e").replace("e+", "e");
    return Number(value.toPrecision(8)).toLocaleString("en-US", { maximumFractionDigits: 8, useGrouping: false });
  }
  const pair = (v) => `(${format(v[0])}, ${format(v[1])})`;
  const multiply = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];
  const determinant = (m) => m[0][0] * m[1][1] - m[0][1] * m[1][0];
  function element(name, attrs = {}, text = null) {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    if (text !== null) el.textContent = text;
    return el;
  }
  function niceStep(raw) {
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    const ratio = raw / power;
    return (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * power;
  }
  function setStatus(text, kind = "") {
    $("calculation-status").textContent = text;
    $("calculation-status").className = `status ${kind}`;
  }
  function showError(message) {
    $("input-error").textContent = message;
    $("input-error").hidden = !message;
  }
  function enableControls() {
    const enabled = state.valid && !state.pending && Boolean(state.result);
    ["play-animation", "reset-animation", "animation-progress"].forEach((id) => { $(id).disabled = !enabled; });
  }
  function stopAnimation() {
    if (state.frame !== null) cancelAnimationFrame(state.frame);
    state.frame = null;
    state.playing = false;
    $("play-label").textContent = "변환 재생";
    $("play-animation").firstElementChild.textContent = "▶";
  }
  function setProgress(progress) {
    state.progress = Math.max(0, Math.min(1, progress));
    const percent = Math.round(state.progress * 100);
    $("animation-progress").value = String(Math.round(state.progress * 1000));
    $("animation-progress").setAttribute("aria-valuetext", `${percent}%`);
    $("progress-output").textContent = `${percent}%`;
    const phase = state.progress === 1 ? "최종 변환" : state.progress === 0 ? "원본 공간" : "변환 중";
    $("plot-phase").textContent = `${phase} · t = ${state.progress.toFixed(2)}`;
    draw();
  }
  function readInputs() {
    const values = [];
    let bad = null;
    numericInputs.forEach((input) => {
      const value = input.valueAsNumber;
      const valid = input.value.trim() !== "" && Number.isFinite(value) && Math.abs(value) <= 10000;
      input.setAttribute("aria-invalid", String(!valid));
      if (!valid && !bad) bad = input;
      values.push(value);
    });
    if (bad) {
      showError(`${bad.getAttribute("aria-label")}에 −10,000부터 10,000 사이의 숫자를 입력하세요. 화면에는 마지막 유효한 계산이 표시됩니다.`);
      return null;
    }
    return { matrix: [[values[0], values[1]], [values[2], values[3]]], vector: [values[4], values[5]] };
  }
  function acceptResult(data) {
    const finitePair = (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
    if (!Array.isArray(data.matrix) || data.matrix.length !== 2 || !data.matrix.every(finitePair) || !finitePair(data.vector) || !finitePair(data.transformed_vector) || !Number.isFinite(data.determinant) || !Number.isFinite(data.area_scale) || !data.basis || !finitePair(data.basis.e1) || !finitePair(data.basis.e2) || ![0, 1, 2].includes(data.rank) || !["preserved", "reversed", "collapsed"].includes(data.orientation)) {
      throw new Error("계산 서버의 응답 형식이 올바르지 않습니다.");
    }
    state.result = data;
    state.valid = true;
    updateResults();
    setProgress(1);
  }
  async function requestCalculation() {
    clearTimeout(state.timer);
    const payload = readInputs();
    state.abort?.abort();
    const sequence = ++state.request;
    state.valid = false;
    if (!payload) {
      state.pending = false;
      setStatus("입력 확인 필요", "error");
      enableControls();
      return;
    }
    showError("");
    state.pending = true;
    enableControls();
    setStatus("서버 계산 중", "pending");
    const controller = new AbortController();
    state.abort = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 15000);
    try {
      const response = await fetch("/api/transform", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) {
        const statusMessage = response.status === 422 ? "입력한 값을 서버에서 처리할 수 없습니다. 범위와 형식을 확인하세요." : `계산 서버 오류가 발생했습니다 (${response.status}). 입력을 다시 변경해 시도하세요.`;
        throw new Error(statusMessage);
      }
      const data = await response.json();
      if (sequence !== state.request) return;
      acceptResult(data);
      setStatus("서버 계산 완료");
    } catch (error) {
      if (sequence !== state.request) return;
      if (error.name === "AbortError" && controller.signal.reason !== "timeout") return;
      const message = controller.signal.reason === "timeout" ? "서버 응답 시간이 초과되었습니다. 잠시 후 입력을 다시 변경해 주세요." : error.message === "Failed to fetch" ? "계산 서버에 연결할 수 없습니다. 연결 상태를 확인하고 입력을 다시 변경해 주세요." : error.message;
      showError(`${message} 화면에는 마지막 유효한 계산이 표시됩니다.`);
      setStatus("계산 실패", "error");
      state.valid = false;
    } finally {
      clearTimeout(timeout);
      if (sequence === state.request) {
        state.pending = false;
        enableControls();
      }
    }
  }
  function scheduleCalculation() {
    stopAnimation();
    state.abort?.abort();
    ++state.request;
    clearTimeout(state.timer);
    state.valid = false;
    state.pending = true;
    enableControls();
    setStatus("입력 반영 중", "pending");
    if (!readInputs()) {
      state.pending = false;
      setStatus("입력 확인 필요", "error");
      return;
    }
    showError("");
    state.timer = setTimeout(requestCalculation, 180);
  }
  function selectPreset(preset) {
    state.preset = preset;
    document.querySelectorAll("[data-preset]").forEach((button) => {
      const selected = button.dataset.preset === preset;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("transformation-title").textContent = presetNames[preset] || "사용자 지정 변환";
  }
  function writeMatrix(matrix, preset) {
    matrixInputs.forEach((input, index) => { input.value = String(matrix[Math.floor(index / 2)][index % 2]); });
    selectPreset(preset);
    stopAnimation();
    requestCalculation();
  }
  function applyPreset(preset) {
    let matrix;
    switch (preset) {
      case "identity": matrix = IDENTITY; break;
      case "rotation": {
        const angle = $("rotation-angle").valueAsNumber;
        if (!Number.isFinite(angle) || Math.abs(angle) > 3600) {
          $("rotation-angle").setAttribute("aria-invalid", "true");
          showError("회전 각도에 −3,600부터 3,600 사이의 숫자를 입력하세요.");
          return;
        }
        $("rotation-angle").setAttribute("aria-invalid", "false");
        const radians = angle * Math.PI / 180;
        // Quarter turns have exact integer matrices; avoid artificial residual components.
        const exactQuarter = Number.isInteger(angle / 90);
        const cosine = exactQuarter ? Math.round(Math.cos(radians)) : Math.cos(radians);
        const sine = exactQuarter ? Math.round(Math.sin(radians)) : Math.sin(radians);
        matrix = [[cosine, -sine], [sine, cosine]];
        break;
      }
      case "scale-up": matrix = [[2, 0], [0, 2]]; break;
      case "scale-down": matrix = [[0.5, 0], [0, 0.5]]; break;
      case "reflect-x": matrix = [[1, 0], [0, -1]]; break;
      case "reflect-y": matrix = [[-1, 0], [0, 1]]; break;
      case "shear": matrix = [[1, 1], [0, 1]]; break;
      case "projection": matrix = [[1, 0], [0, 0]]; break;
      default: return;
    }
    writeMatrix(matrix, preset);
  }
  function updateResults() {
    const data = state.result;
    $("determinant-value").textContent = format(data.determinant);
    $("original-vector-value").textContent = pair(data.vector);
    $("transformed-vector-value").textContent = pair(data.transformed_vector);
    $("basis-e1-value").textContent = `Ae₁ = ${pair(data.basis.e1)}`;
    $("basis-e2-value").textContent = `Ae₂ = ${pair(data.basis.e2)}`;
    $("rank-value").textContent = `RANK ${data.rank} / 2`;
    const orientation = $("orientation-badge");
    orientation.className = `orientation-badge ${data.orientation}`;
    if (data.orientation === "collapsed") {
      orientation.textContent = "면적 0 · 차원 축소";
      $("determinant-explanation").textContent = "det(A) = 0. 단위 정사각형의 면적이 0이 되어 평면의 차원이 축소됩니다.";
      $("insight-title").textContent = data.rank === 0 ? "모든 점이 원점으로 모여요." : "평면이 하나의 직선으로 모여요.";
      $("insight-description").textContent = data.rank === 0 ? "두 기저벡터가 모두 영벡터입니다. 어떤 입력 벡터도 변환 결과는 (0, 0)이 됩니다." : "두 변환 기저가 한 직선 위에 놓입니다. 서로 다른 벡터가 같은 결과로 겹칠 수 있습니다.";
    } else {
      orientation.textContent = data.orientation === "reversed" ? "방향 반전" : "방향 유지";
      $("determinant-explanation").textContent = `면적은 ${format(data.area_scale)}배가 됩니다. ${data.orientation === "reversed" ? "음의 행렬식은 평면의 방향이 뒤집혔음을 뜻합니다." : "양의 행렬식은 평면의 방향이 유지됨을 뜻합니다."}`;
      const identity = data.matrix[0][0] === 1 && data.matrix[0][1] === 0 && data.matrix[1][0] === 0 && data.matrix[1][1] === 1;
      if (identity) {
        $("insight-title").textContent = "공간이 그대로 유지돼요.";
        $("insight-description").textContent = "항등행렬은 모든 벡터를 원래 위치에 둡니다. 프리셋을 선택해 공간의 변화를 시작해 보세요.";
      } else if (data.orientation === "reversed") {
        $("insight-title").textContent = "공간의 방향이 뒤집혀요.";
        $("insight-description").textContent = "변환된 기저가 이루는 방향을 관찰하세요. 면적 배율은 행렬식의 절댓값으로 읽습니다.";
      } else if (data.area_scale === 1) {
        $("insight-title").textContent = "모양이 달라도 면적은 같아요.";
        $("insight-description").textContent = "행렬식이 1인 변환은 면적과 방향을 보존합니다. 길이와 각도는 변환에 따라 달라질 수 있습니다.";
      } else if (Math.abs(data.area_scale - 1) < 1e-10) {
        $("insight-title").textContent = "면적이 거의 유지돼요.";
        $("insight-description").textContent = "면적 배율이 1에 매우 가깝습니다. 기저벡터가 만드는 평행사변형을 원래 정사각형과 비교해 보세요.";
      } else {
        $("insight-title").textContent = data.area_scale > 1 ? "단위 면적이 더 넓어져요." : "단위 면적이 더 작아져요.";
        $("insight-description").textContent = `단위 정사각형이 변환된 평행사변형의 면적은 ${format(data.area_scale)}입니다. 기저벡터의 길이와 각도를 함께 관찰하세요.`;
      }
    }
    $("plot-description").textContent = `행렬 A = ${pair(data.matrix[0])}, ${pair(data.matrix[1])}. 원본 벡터 v = ${pair(data.vector)}, 최종 변환 벡터 Av = ${pair(data.transformed_vector)}. 행렬식 ${format(data.determinant)}. 진행률 슬라이더로 중간 변환을 조절할 수 있습니다.`;
  }

  function draw() {
    if (!state.result) return;
    const data = state.result;
    const t = state.progress;
    const matrix = t === 1 ? data.matrix : t === 0 ? IDENTITY : [[1 + t * (data.matrix[0][0] - 1), t * data.matrix[0][1]], [t * data.matrix[1][0], 1 + t * (data.matrix[1][1] - 1)]];
    const points = [data.vector, data.transformed_vector, data.basis.e1, data.basis.e2, [data.basis.e1[0] + data.basis.e2[0], data.basis.e1[1] + data.basis.e2[1]]];
    const maxX = Math.max(1, ...points.map((point) => Math.abs(point[0])));
    const maxY = Math.max(1, ...points.map((point) => Math.abs(point[1])));
    const scale = Math.min(50, 390 / maxX, 235 / maxY) * state.zoom;
    const toScreen = (point) => [500 + scale * point[0], 340 - scale * point[1]];
    const bounds = { left: 38, right: 962, top: 37, bottom: 643 };
    const root = element("g", { "data-render-progress": t.toFixed(4) });
    const defs = element("defs");
    const clip = element("clipPath", { id: "plot-clip" });
    clip.append(element("rect", { x: bounds.left, y: bounds.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top }));
    defs.append(clip);
    Object.entries(COLORS).forEach(([name, color]) => {
      const marker = element("marker", { id: `arrow-${name}`, viewBox: "0 0 10 10", refX: 8.5, refY: 5, markerWidth: 5.5, markerHeight: 5.5, orient: "auto-start-reverse", markerUnits: "strokeWidth" });
      marker.append(element("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
      defs.append(marker);
    });
    root.append(defs);
    const grid = element("g", { "clip-path": "url(#plot-clip)" });
    const shapes = element("g", { "clip-path": "url(#plot-clip)" });
    const vectors = element("g", { "clip-path": "url(#plot-clip)" });
    const labels = element("g", { "clip-path": "url(#plot-clip)" });

    // Intersect an infinite line with the viewport before making SVG elements.
    // This avoids enormous SVG coordinates for large matrices and near singular transforms.
    function clippedLine(point, direction) {
      let low = -Infinity, high = Infinity;
      for (let axis = 0; axis < 2; axis++) {
        const min = axis === 0 ? bounds.left : bounds.top;
        const max = axis === 0 ? bounds.right : bounds.bottom;
        if (Math.abs(direction[axis]) < 1e-13) {
          if (point[axis] < min || point[axis] > max) return null;
        } else {
          let a = (min - point[axis]) / direction[axis], b = (max - point[axis]) / direction[axis];
          if (a > b) [a, b] = [b, a];
          low = Math.max(low, a);
          high = Math.min(high, b);
          if (low > high) return null;
        }
      }
      if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
      return [point[0] + low * direction[0], point[1] + low * direction[1], point[0] + high * direction[0], point[1] + high * direction[1]];
    }
    function line(layer, coords, attrs) {
      if (!coords || !coords.every(Number.isFinite)) return;
      layer.append(element("line", { x1: coords[0], y1: coords[1], x2: coords[2], y2: coords[3], ...attrs }));
    }
    function infinite(layer, point, direction, attrs) {
      const length = Math.hypot(...direction);
      if (length === 0) return;
      line(layer, clippedLine(point, direction.map((value) => value / length)), attrs);
    }
    const step = niceStep(48 / scale);
    const pixelStep = step * scale;
    const xCount = Math.ceil(465 / pixelStep), yCount = Math.ceil(305 / pixelStep);
    for (let i = -xCount; i <= xCount; i++) {
      const x = 500 + i * pixelStep;
      line(grid, [x, bounds.top, x, bounds.bottom], { stroke: "#dfe7f1", "stroke-width": 1 });
      if (i !== 0 && x > bounds.left + 12 && x < bounds.right - 12) labels.append(element("text", { x, y: 357, "text-anchor": "middle", class: "tick-label" }, format(i * step)));
    }
    for (let i = -yCount; i <= yCount; i++) {
      const y = 340 - i * pixelStep;
      line(grid, [bounds.left, y, bounds.right, y], { stroke: "#dfe7f1", "stroke-width": 1 });
      if (i !== 0 && y > bounds.top + 10 && y < bounds.bottom - 10) labels.append(element("text", { x: 489, y: y + 3, "text-anchor": "end", class: "tick-label" }, format(i * step)));
    }
    // Transform the SAME input lattice as the original grid. Only skip integer
    // multiples if the image becomes too dense to resolve on screen.
    const column1 = [matrix[0][0], matrix[1][0]], column2 = [matrix[0][1], matrix[1][1]];
    const norm1 = Math.hypot(...column1), norm2 = Math.hypot(...column2), det = t === 1 ? data.determinant : determinant(matrix);
    const singularAtDisplayScale = t === 1 ? data.rank < 2 : det === 0 || Math.abs(det) <= Number.EPSILON * norm1 * norm2;
    const gridStyle = { stroke: COLORS.grid, "stroke-width": 1.15, opacity: 0.5 };
    if (singularAtDisplayScale) {
      const dir = norm1 >= norm2 ? column1 : column2;
      if (Math.hypot(...dir) > 0) infinite(grid, [500, 340], [dir[0], -dir[1]], { ...gridStyle, "stroke-width": 2.3, opacity: 0.7 });
      else grid.append(element("circle", { cx: 500, cy: 340, r: 7, fill: COLORS.grid, opacity: 0.23 }));
    } else {
      [[column1, column2, norm2], [column2, column1, norm1]].forEach(([offset, direction, directionNorm], familyIndex) => {
        const unitGap = Math.abs(det) / directionNorm * scale;
        const skip = Math.max(1, Math.ceil(niceStep(12 / (unitGap * step))));
        const inputStep = step * skip;
        const gap = unitGap * inputStep;
        const normal = [direction[1] / directionNorm, direction[0] / directionNorm];
        const sign = (familyIndex === 0 ? det : -det) < 0 ? -1 : 1;
        const count = Math.min(80, Math.ceil(560 / gap));
        for (let k = -count; k <= count; k++) {
          const distance = sign * gap * k;
          const point = [500 + normal[0] * distance, 340 + normal[1] * distance];
          infinite(grid, point, [direction[0], -direction[1]], gridStyle);
        }
      });
    }
    const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const polygonPoints = (vertices) => vertices.map((point) => toScreen(point).join(",")).join(" ");
    shapes.append(element("polygon", { points: polygonPoints(square), fill: "#aabacf", "fill-opacity": 0.06, stroke: "#9aafca", "stroke-opacity": 0.5, "stroke-width": 1, "stroke-dasharray": "4 4" }));
    shapes.append(element("polygon", { points: polygonPoints(square.map((point) => multiply(matrix, point))), fill: "#419bcd", "fill-opacity": 0.11, stroke: "#6b9bd4", "stroke-opacity": 0.65, "stroke-width": 1.4 }));
    line(grid, [bounds.left, 340, bounds.right, 340], { stroke: "#a8b8cc", "stroke-width": 1.35 });
    line(grid, [500, bounds.top, 500, bounds.bottom], { stroke: "#a8b8cc", "stroke-width": 1.35 });
    labels.append(element("text", { x: 954, y: 331, class: "axis-label" }, "x"));
    labels.append(element("text", { x: 513, y: 49, class: "axis-label" }, "y"));
    labels.append(element("text", { x: 487, y: 357, class: "tick-label", "text-anchor": "end" }, "0"));
    function arrow(value, name, label, original, offset) {
      const point = toScreen(value), color = COLORS[name];
      const length = Math.hypot(point[0] - 500, point[1] - 340);
      const attrs = { stroke: color, "stroke-width": original ? 2.2 : name === "transformed" ? 3.7 : 2.8, opacity: original ? 0.5 : 1, "stroke-linecap": "round" };
      if (original) attrs["stroke-dasharray"] = "5 4";
      if (length > 7) attrs["marker-end"] = `url(#arrow-${name})`;
      if (length < 1.5) vectors.append(element("circle", { cx: 500, cy: 340, r: original ? 3 : 4, fill: color, opacity: original ? 0.4 : 0.9 }));
      else line(vectors, [500, 340, point[0], point[1]], attrs);
      if (length < 1.5) offset = name === "transformed" ? [12, -12] : name === "original" ? [12, 52] : name === "e1" ? [12, 18] : [12, 35];
      const labelX = point[0] + offset[0], labelY = point[1] + offset[1];
      if (labelX > bounds.left + 8 && labelX < bounds.right - 8 && labelY > bounds.top + 12 && labelY < bounds.bottom - 6) {
        labels.append(element("text", { x: labelX, y: labelY, fill: color, opacity: original ? 0.55 : 1, class: name === "original" || name === "transformed" ? "vector-label" : "basis-label" }, label));
      }
    }
    arrow([1, 0], "e1", "e₁", true, [7, 19]);
    arrow([0, 1], "e2", "e₂", true, [-24, -7]);
    arrow(data.vector, "original", "v", true, [9, 21]);
    arrow(multiply(matrix, [1, 0]), "e1", t === 1 ? "Ae₁" : "e₁(t)", false, [9, -9]);
    arrow(multiply(matrix, [0, 1]), "e2", t === 1 ? "Ae₂" : "e₂(t)", false, [9, -9]);
    arrow(t === 1 ? data.transformed_vector : multiply(matrix, data.vector), "transformed", t === 1 ? "Av" : "v(t)", false, [10, -12]);
    root.append(grid, shapes, vectors, labels);
    const prior = svg.querySelector("g[data-render-progress]");
    if (prior) prior.replaceWith(root); else svg.append(root);
  }

  matrixInputs.forEach((input) => input.addEventListener("input", () => { selectPreset(null); scheduleCalculation(); }));
  vectorInputs.forEach((input) => input.addEventListener("input", scheduleCalculation));
  document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
  $("identity-reset").addEventListener("click", () => applyPreset("identity"));
  $("apply-rotation").addEventListener("click", () => applyPreset("rotation"));
  $("rotation-angle").addEventListener("keydown", (event) => { if (event.key === "Enter") applyPreset("rotation"); });
  $("rotation-angle").addEventListener("input", () => {
    const value = $("rotation-angle").valueAsNumber;
    $("rotation-angle").setAttribute("aria-invalid", String(!Number.isFinite(value) || Math.abs(value) > 3600));
    if (state.preset === "rotation") {
      clearTimeout(state.timer);
      state.timer = setTimeout(() => applyPreset("rotation"), 180);
    }
  });
  $("play-animation").addEventListener("click", () => {
    if (!state.valid || state.pending || !state.result) return;
    if (state.playing) { stopAnimation(); return; }
    stopAnimation();
    const from = state.progress >= 1 ? 0 : state.progress;
    const duration = 1800 * (1 - from);
    const started = performance.now();
    state.playing = true;
    $("play-label").textContent = "일시 정지";
    $("play-animation").firstElementChild.textContent = "Ⅱ";
    setProgress(from);
    const tick = (now) => {
      if (!state.playing) return;
      const elapsed = Math.min(1, (now - started) / Math.max(1, duration));
      setProgress(from + (1 - from) * elapsed);
      if (elapsed < 1) state.frame = requestAnimationFrame(tick);
      else stopAnimation();
    };
    state.frame = requestAnimationFrame(tick);
  });
  $("reset-animation").addEventListener("click", () => { stopAnimation(); setProgress(0); });
  $("animation-progress").addEventListener("input", () => { stopAnimation(); setProgress($("animation-progress").valueAsNumber / 1000); });
  $("zoom-in").addEventListener("click", () => { state.zoom = Math.min(12, state.zoom * 1.25); draw(); });
  $("zoom-out").addEventListener("click", () => { state.zoom = Math.max(0.08, state.zoom / 1.25); draw(); });
  $("fit-view").addEventListener("click", () => { state.zoom = 1; draw(); });
  $("reset-all").addEventListener("click", () => {
    vectorInputs[0].value = "2";
    vectorInputs[1].value = "1";
    $("rotation-angle").value = "45";
    $("rotation-angle").setAttribute("aria-invalid", "false");
    state.zoom = 1;
    applyPreset("identity");
  });
  fetch("/api/version", { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error("version");
    return response.json();
  }).then((data) => {
    $("version-label").textContent = `${data.version || "버전 미지정"}${data.commit ? ` · ${String(data.commit).slice(0, 7)}` : ""}`;
  }).catch(() => { $("version-label").textContent = "버전 정보 확인 불가"; });
  requestCalculation();
})();
