# HW2 최신 저장소 분석 및 HW3 변경 계획

확인일: 2026-11-05 KST. GitHub 연결로 최신 main 커밋·전체 tree·Actions 실행을 읽고 해당 소스를 로컬 clone했습니다. 기준 main: `1117e8ed356c96c10c8b7b59f314557eb5278fa8` (2026-11-02, 문서 갱신 `[skip render]`). 저장소에 AGENTS.md는 없었습니다.

## 실제 전체 파일 구조 (변경 전, 13개)

```text
.github/workflows/ci.yml
.gitignore
.python-version
README.md
app/__init__.py
app/main.py
deployment-status.md
render.yaml
requirements.txt
static/app.js
static/index.html
static/styles.css
tests/test_api.py
```

HTML/CSS/JavaScript와 SVG는 FastAPI가 같은 출처에서 제공합니다. `/`는 index.html, `/static`은 정적 파일입니다. Node.js는 문법 검사에만 필요하며 frontend 별도 빌드 서버는 없습니다. JavaScript가 `/api/transform`을 호출하고 NumPy 행렬곱과 Decimal 행렬식 결과를 SVG로 표현합니다. Uvicorn 진입점은 `app.main:app`입니다.

requirements.txt: fastapi 0.115.6, uvicorn 0.34.0, numpy 2.2.1, pytest 8.3.4, httpx 0.28.1. 직접 의존성은 고정돼 있으나 간접 의존성 전체가 잠긴 lockfile은 아닙니다. `.python-version`, Render PYTHON_VERSION은 3.12.16, 기존 CI는 그 파일을 읽습니다. Docker는 `python:3.12-slim`의 최신 3.12 패치 버전을 사용하므로 패치 버전이 다를 수 있습니다. 재배포 앱은 CI에서 만든 이미지 digest로 고정합니다.

기존 pytest는 매개변수 확장 포함 37개이며 수치 계산·유효성 검증·정적 파일·버전·상태 경로를 검사합니다. 기존 CI는 main Push, main 대상 PR, 수동 실행에서 pytest와 `node --check static/app.js`를 실행합니다. 최신 main의 CI run `41395525377`은 success로 확인했습니다.

render.yaml은 Python runtime/free/Singapore/main, `pip install -r requirements.txt`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, On Commit 배포를 지정합니다. 실제 Render 연결에서도 해당 repo/main/명령/무료 플랜/On Commit을 확인했습니다. 실제 서비스의 명시 healthCheckPath는 비어 있고 Blueprint만 `/health`를 지정합니다. 설정을 바꾸지 않았습니다.

README와 deployment-status.md의 HW2 기록은 37개 테스트 및 Render `6559848` 자동 배포 성공입니다. 11월 5일 공개 API에서도 1.0.2/6559848, health ok, 회전 (-1,2)가 확인돼 기존 기록과 모순이 없습니다. 최신 main과 Render SHA 차이는 문서 커밋에 `[skip render]`가 있기 때문입니다. 기존 HW2 마감·보고는 역사적 기록으로 유지하고 HW3 자료를 별도로 추가합니다.

## 변경 계획과 구현 범위

1. 기존 app/static/requirements를 Docker 이미지에 포함하고 non-root Uvicorn 실행 및 healthcheck 추가.
2. 기존 CI 검사 보존, Windows 배포 복구 모의 검사와 Linux 이미지 build/run smoke 추가. main Push에서만 Hub 로그인·SHA 태그 업로드.
3. 업로드 성공 뒤 재사용 deploy.yml 호출. Windows runner, main/저장소/이벤트 제한, 비활성 기본 gate, read-only 권한, 같은 SHA의 코드 checkout.
4. PowerShell에서 digest pull, 이미지 label 검사, 임시 컨테이너 검사, 교체, API commit 검증, 오류 시 이전 컨테이너 복구.
5. version은 `RENDER_GIT_COMMIT` 우선 → `GIT_COMMIT` → local 순서로 확장. 기존 UI와 수학 연산 코드는 유지.
6. 사용자 승인과 계정 준비 후에만 main 병합·운영 변경 및 별도 문구 변경 Push 검증 진행.
