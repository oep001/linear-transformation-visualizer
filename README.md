# Linear Transformation Visualizer

2×2 행렬이 평면을 어떻게 바꾸는지 격자·벡터·기저벡터로 탐구하는 한국어 교육용 웹앱입니다. 대학교 「오픈소스SW개발방법및도구」 HW2 과제로, FastAPI 계산 API와 SVG 시각화, GitHub Actions CI, Render 자동 배포 설정을 함께 제공합니다.

실제 GitHub·Render URL과 배포 검증 결과는 [deployment-status.md](deployment-status.md)에 기록합니다. 설정 파일이 존재한다는 이유만으로 배포·CI/CD 검증 완료를 주장하지 않습니다.

## 주요 기능

- 실수 2×2 행렬과 2차원 입력 벡터 편집, 서버 계산 결과에 따른 시각화 갱신
- 원본·변환 격자, 입력 벡터 `v`와 결과 `Av`, 표준기저와 변환된 기저 표시
- 항등, 각도 지정 회전, 확대·축소, x축·y축 반사, 전단, 사영 프리셋
- 재생·초기화·진행률 조절을 통한 `I → A` 보간 애니메이션
- 행렬식·면적 배율·방향 반전·행렬의 계수(rank) 설명
- 특이행렬 및 영벡터 처리, 잘못된 입력에 대한 오류 표시
- 데스크톱·모바일 반응형 화면, 브라우저 외부 라이브러리/CDN 없이 실행

## 기술과 구조

| 구성 | 기술 |
| --- | --- |
| API·정적 파일 제공 | Python, FastAPI, Uvicorn |
| 수치 계산 | NumPy |
| 화면·애니메이션 | HTML, CSS, JavaScript, SVG, requestAnimationFrame |
| 자동 검증 | pytest, GitHub Actions |
| 배포 | Render Web Service, render.yaml |

```text
app/                 FastAPI API 및 계산
static/              HTML / CSS / JavaScript
tests/               수치·입력 검증·API 테스트
.github/workflows/   GitHub Actions CI
.python-version      Render·CI의 Python 버전
requirements.txt     의존성 고정
render.yaml          Render 무료 Web Service 설정
deployment-status.md 실제 배포 검증 기록
```

## 로컬 설치와 실행

프로젝트 폴더에서 Python 3.11 이상을 사용합니다. Render와 CI는 `.python-version`에 지정한 3.12.16을 사용합니다. Windows에서 3.12.16 설치 파일을 구할 필요 없이 현재 설치된 호환 Python으로 로컬 실행할 수 있습니다.

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

macOS / Linux:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

브라우저에서 [로컬 앱](http://127.0.0.1:8000)을 엽니다. 자동 생성 API 문서는 [Swagger UI](http://127.0.0.1:8000/docs)에서 확인합니다. 서버를 종료하려면 실행 중인 창에서 `Ctrl+C`를 누릅니다.

테스트:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
node --check static/app.js
```

두 번째 명령은 Node.js가 설치된 경우 실행하는 JavaScript 문법 검사입니다. 앱 실행에는 Node.js가 필요하지 않습니다. 테스트 코드를 작성하거나 실행을 시도한 사실과 실제 통과한 결과는 구분해야 합니다. 실행 결과는 제출 자료의 검증 기록을 확인하세요.

## API

### `POST /api/transform`

`Content-Type: application/json`으로 행 우선 2×2 행렬과 길이 2의 벡터를 전송합니다.

```json
{
  "matrix": [[0, -1], [1, 0]],
  "vector": [2, 1]
}
```

응답 예시(반시계 방향 90° 회전):

```json
{
  "matrix": [[0.0, -1.0], [1.0, 0.0]],
  "vector": [2.0, 1.0],
  "transformed_vector": [-1.0, 2.0],
  "determinant": 1.0,
  "basis": {"e1": [0.0, 1.0], "e2": [-1.0, 0.0]},
  "area_scale": 1.0,
  "orientation": "preserved",
  "rank": 2
}
```

| 필드 | 의미 |
| --- | --- |
| `transformed_vector` | 행렬곱 `Av` |
| `determinant` | `ad − bc` |
| `basis.e1`, `basis.e2` | `Ae₁=(a,c)`, `Ae₂=(b,d)` |
| `area_scale` | 면적 배율 `abs(det(A))` |
| `orientation` | `preserved`: 방향 유지, `reversed`: 방향 반전, `collapsed`: 차원 축소 |
| `rank` | 0: 원점으로 축소, 1: 직선으로 축소, 2: 평면 |

모든 원소는 유한한 JSON 숫자이며 절댓값이 10,000 이하여야 합니다. 문자열·불리언·`null`·NaN·Infinity·잘못된 배열 크기는 허용하지 않습니다. 잘못된 요청은 HTTP 422와 `detail` 오류 정보를 반환합니다. 입력 길이 제한은 화면에서 정확히 표시하기 위한 서비스의 범위입니다.

```powershell
$body = '{"matrix":[[0,-1],[1,0]],"vector":[2,1]}'
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/transform -ContentType 'application/json' -Body $body
```

### `GET /health`

프로세스 상태를 확인하는 HTTP 200 응답입니다. Render의 상태 확인 경로로 사용합니다.

### `GET /api/version`

`version`, `commit`을 반환합니다. Render에서는 `RENDER_GIT_COMMIT`을 통해 실행 중인 배포의 커밋을 확인합니다. 로컬 실행의 커밋 표시는 원격 배포 성공의 증거가 아닙니다.

### 수학과 애니메이션

면적 배율은 행렬식의 절댓값입니다. 음의 행렬식은 방향 반전을, 0은 평면이 직선이나 점으로 줄어듦을 의미합니다. 입력이 아주 작은 행렬식이라도 무조건 0으로 간주하지 않습니다. 일반 실수 계산 결과는 부동소수점 정밀도 범위의 근삿값입니다.

애니메이션은 `A(t) = (1−t)I + tA`, `0 ≤ t ≤ 1`을 사용합니다. 회전 프리셋의 중간 모습도 이 행렬 보간을 따르므로 중간 프레임은 순수한 회전일 필요가 없습니다. 예를 들어 180° 회전의 중간 행렬은 영행렬이 됩니다. 최종 `t=1`의 변환 결과는 선택한 `A`와 일치합니다.

## GitHub 업로드

1. GitHub에서 빈 저장소를 생성합니다. 예: `linear-transformation-visualizer`. 이미 파일이 있는 저장소를 대상으로 덮어쓰지 않습니다.
2. 이 폴더에 이미 Git 저장소가 있다면 현재 상태와 원격을 먼저 확인합니다.
3. 아직 Git 저장소가 없는 새 프로젝트 폴더에서 다음을 실행합니다.

```bash
git init -b main
git add .
git commit -m "Build linear transformation visualizer"
git remote add origin https://github.com/YOUR_USERNAME/linear-transformation-visualizer.git
git push -u origin main
```

`YOUR_USERNAME`은 실제 계정명으로 바꿉니다. 기존 원격에 오류가 나면 먼저 상태를 확인하고 `--force`로 해결하지 않습니다. GitHub 로그인과 최초 저장소 생성 권한 승인은 계정 소유자가 수행할 수 있습니다. 공개 저장소에는 소스코드가 공개되므로 인증정보·학번·불필요한 개인정보를 포함하지 마세요.

## Render 최초 배포

1. [Render Dashboard](https://dashboard.render.com/)에 로그인합니다.
2. `New` → `Blueprint`에서 GitHub 계정을 연결하고 이 저장소를 선택합니다. GitHub가 요구하는 Render 앱의 저장소 접근 승인은 계정 소유자가 수행합니다.
3. `main`의 루트에 있는 `render.yaml`을 사용합니다. 서비스 이름이 기존 서비스와 겹치면 생성 전에 고유한 이름으로 변경하세요.
4. Web Service의 **Free** 플랜을 확인합니다. 결제 정보 입력·유료 플랜 선택·유료 리소스 생성은 이 과제에 필요하지 않습니다. 비용 관련 화면이 나타나면 진행 전에 사용자 승인을 받습니다.
5. 서비스를 생성하고 최초 빌드와 배포가 끝날 때까지 Render의 Events와 Logs를 확인합니다.
6. 표시된 실제 `https://...onrender.com` 주소에서 웹페이지, `/health`, `/api/version`, `/api/transform`을 확인합니다.

Blueprint를 사용하지 않고 Web Service를 직접 생성할 때도 다음 값을 동일하게 설정합니다.

| 설정 | 값 |
| --- | --- |
| Runtime | Python 3 |
| Branch | `main` |
| Region | Singapore |
| Instance Type | **Free** |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |
| Auto-Deploy | After CI Checks Pass |
| Python version | `PYTHON_VERSION=3.12.16` |

앱은 Render가 주입하는 `PORT`에 바인딩하고 `0.0.0.0`에서 외부 요청을 받습니다. 데이터베이스·디스크·API 키는 필요하지 않습니다. 무료 서비스는 15분 유휴 후 중지되며 다음 요청 때 시작하는 데 약 1분이 걸릴 수 있습니다. 무료 사용량 한도를 확인하세요.

## main Push 이후 CI/CD

```text
main Push
  → GitHub Actions CI: 의존성 설치 → pytest → JavaScript 문법 검사
  → CI 성공 확인 후 Render 자동 배포
  → Render: 빌드 → 서버 시작 → /health 확인 → Live
  → 공개 URL의 변경 문구와 /api/version 커밋 대조
```

`.github/workflows/ci.yml`은 `main` Push, `main` 대상 Pull Request, 수동 실행을 지원합니다. Render의 `autoDeployTrigger: checksPass`는 연결 브랜치의 CI가 성공한 커밋을 자동 배포하도록 설정합니다. GitHub Actions가 비활성화됐거나 검사 실행 자체가 없으면 이 방식의 자동 배포도 진행되지 않을 수 있으므로 Actions 권한과 실행 결과를 확인합니다.

최초 배포 성공 후 `static/index.html`의 설명 문구를 변경하고 Commit/Push합니다. 새 GitHub Actions 실행 성공, 같은 SHA의 Render 자동 배포, 공개 화면 변경 및 `/api/version`의 커밋을 모두 확인해야 자동 배포 실증이 완료됩니다. 수동 재배포만 성공한 경우 자동 배포 검증으로 기록하지 않습니다. 자세한 기록 양식은 [deployment-status.md](deployment-status.md)에 있습니다.

## 제출 자료

마감: **2026년 11월 2일 23:59:59 (한국시간)**. 실제 학번과 이름을 확인한 뒤 `StudentID_Name_HW2.zip` 형식으로 만듭니다. GitHub 화면, Render Live 화면, 공개 서비스 화면, Push 후 자동 배포 이벤트 화면을 확보하고 1페이지 보고서에 실제 검증 결과와 URL을 기록합니다. 로그인·연결 권한 등의 사유로 완료하지 못한 항목은 미검증으로 명시합니다.

## 공식 참고 자료

- [FastAPI의 Render 배포](https://render.com/docs/deploy-fastapi)
- [Render Blueprint 명세](https://render.com/docs/blueprint-spec)
- [Render 배포 및 CI 검사 연동](https://render.com/docs/deploys)
- [Render Python 버전 지정](https://render.com/docs/python-version)
- [Render 무료 서비스 제한](https://render.com/docs/free)
- [GitHub Actions Python 빌드·테스트](https://docs.github.com/en/actions/tutorials/build-and-test-code/python)
- [Python 3.12.16 릴리스](https://www.python.org/downloads/release/python-31216/)
