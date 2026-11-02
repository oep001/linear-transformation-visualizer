# 배포·자동 배포 검증 기록

확인일: **2026년 11월 2일 (한국시간)**. 실제 실행 결과와 API 관찰값을 기록했습니다.

## 서비스와 검증 상태

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| GitHub 저장소 및 소스 업로드 | 완료 | [Repository](https://github.com/oep001/linear-transformation-visualizer) |
| 로컬 계산·API 테스트 | pytest 37개 통과 | 제출물의 테스트·API 검증 기록 |
| JavaScript 문법 검사 | 통과 | 로컬 검사 및 GitHub Actions |
| GitHub Actions Push 실행 | 성공 | [Run 41395062950](https://github.com/oep001/linear-transformation-visualizer/actions/runs/41395062950) |
| Render Web Service | Free / Singapore / My Workspace | `srv-dbk0092jnfac7396up80` |
| Render GitHub 연결 | 계정 소유자가 연결 및 Git Credentials 선택 완료 | 이후 실제 새 커밋 자동 배포 확인 |
| 새 main 커밋 자동 재배포 | **live 완료** | `trigger: new_commit`, `dep-dbk22uivcj2c73fi3if0` |
| 최종 공개 페이지·API 검사 | **20개 모두 통과** | `evidence/public-api-final.json`, 14:38:47 KST |
| 최종 공개 버전·커밋 대조 | **1.0.2 / 6559848 일치** | 공개 `/api/version`의 실제 응답 |
| 최종 공개 화면 문구·버전 | **일치** | 변경 문구와 `1.0.2 · 6559848` 실제 표시 |
| 320px·390px 모바일 | **통과** | 가로 넘침 없음, 실제 브라우저 화면 확보 |

- 공개 서비스: [Linear Transformation Visualizer](https://linear-transformation-visualizer.onrender.com)
- Render 관리 화면: [Service Dashboard](https://dashboard.render.com/web/srv-dbk0092jnfac7396up80)
- 자동 배포 검증 커밋: [`6559848a6d83746c572226b5f9fe2709bd4f745e`](https://github.com/oep001/linear-transformation-visualizer/commit/6559848a6d83746c572226b5f9fe2709bd4f745e)

## 실제 업로드와 자동 배포 과정

1. 연결된 GitHub 도구로 최초 프로젝트 소스를 업로드했습니다.
2. Render 최초 배포는 **12:15:37 KST**에 Live로 완료되었습니다. 이후 첫 변경은 Render의 GitHub 연동이 완성되지 않아 자동 배포되지 않았습니다.
3. 일반 CLI의 `git push`는 인증 문제로 완료되지 않았습니다. 연결된 GitHub 도구로 커밋을 생성하고 `main` 참조를 정상적인 **fast-forward** 방식으로 갱신했습니다.
4. 계정 소유자가 Render에서 GitHub 연결과 서비스의 Git Credentials 선택을 완료했습니다.
5. **14:36:51 KST**의 새 `main` 커밋은 실제 GitHub **Push 이벤트**와 GitHub Actions 실행을 발생시켰습니다.
6. Render API에서 같은 커밋의 배포가 `trigger: new_commit`으로 시작되어 `live`로 완료된 것을 확인했습니다. 강제 Push와 수동 Deploy는 이 자동 배포 검증에 사용하지 않았습니다.
7. **14:38:47 KST**에 공개 페이지·API 20개 검사가 모두 통과했습니다. 실제 공개 `/api/version`에서 버전 `1.0.2`와 위 커밋 SHA를 확인했습니다.

실제 Render 설정은 **On Commit**이며 `render.yaml`도 `autoDeployTrigger: commit`입니다. GitHub Actions CI와 배포는 병렬로 실행합니다. CI 성공이 배포 시작의 선행 조건은 아닙니다. 앱의 `/health` API를 별도로 확인하며, 직접 생성한 Render 서비스는 명시적 Health Check Path 없이 기본 상태 확인을 사용합니다.

## 자동 배포 이벤트

| 필드 | 실제 관찰값 |
| --- | --- |
| GitHub commit SHA | `6559848a6d83746c572226b5f9fe2709bd4f745e` |
| GitHub Actions run | `41395062950` / `success` |
| main 변경 커밋 시각 | 2026-11-02 **14:36:51 KST** (`05:36:51Z`) |
| Render deployment ID | `dep-dbk22uivcj2c73fi3if0` |
| Render trigger | `new_commit` |
| Render status | `live` |
| 배포 시작 | 2026-11-02 **14:36:58 KST** (`05:36:58.458478Z`) |
| 배포 완료 | 2026-11-02 **14:37:47 KST** (`05:37:47.023039Z`) |
| 실제 공개 버전 | **`1.0.2`** |
| 공개 API commit 대조 | **`6559848a6d83746c572226b5f9fe2709bd4f745e` 일치** |
| 변경 문구 확인 | **실제 공개 브라우저에서 전체 문구 일치** |

변경한 화면 설명 문구:

> 격자·벡터·면적의 변화를 한눈에 살펴보세요. 행렬이 공간을 바꾸는 순간을 탐구합니다.

최종 공개 `/api/version`에서 위 버전·커밋이 일치했고, 실제 공개 브라우저에서 위 문구 전체와 하단 `1.0.2 · 6559848` 표시가 확인되었습니다. **새 main 커밋 감지부터 자동 배포 완료, 공개 API·화면 반영까지 검증 완료**했습니다.

## 브라우저·계산 검증

- 실제 브라우저에서 항등변환, 90도 회전, 확대·축소·반사·전단·사영 프리셋, 입력 오류, 영벡터, 진행률 조절 및 애니메이션을 확인했습니다.
- `v=(2,1)`을 90도 회전하면 `Av=(-1,2)`, `det(A)=1`, `Ae1=(0,1)`, `Ae2=(-1,0)`이 표시되는 것을 확인했습니다.
- 320px 화면의 문서 폭 305px, 390px 화면의 문서 폭 375px로 가로 넘침이 없었습니다. 행렬 이름 `A =`의 줄바꿈 수정도 최종 공개 화면에서 확인했습니다.
- 애니메이션 도중 프리셋을 빠르게 바꿔도 마지막 전단변환 결과 `Av=(3,1)`이 반영되었습니다. 키보드로 진행률 50% 조절 후 재생하여 100% 도달하는 것을 확인했습니다.
- 최종 브라우저 콘솔 오류는 **0건**이며 결과는 `evidence/browser-final.json`에 기록했습니다.
- 로컬 pytest는 **37개 통과**했습니다. 외부 Starlette/AnyIO 라이브러리의 폐기 예정 경고 1건은 테스트 실패가 아닙니다.
- 최종 로컬 pytest 실행 시간은 **1.33초**이며 JUnit 결과는 제출물 `evidence/pytest-results.xml`에 있습니다.
- 공개 URL 검사는 **20개 통과 / 0개 실패**, 실행 시간 **1.156초**였습니다. 공개 `/health`가 HTTP 200과 `{"status":"ok"}`를 반환했습니다.

## 증빙 자료의 성격

제출 ZIP의 `screenshots/`에는 실제 브라우저 화면을, `evidence/`에는 공개 API·GitHub Actions·Render API의 실제 확인 기록을 보관합니다. 최종 핵심 기록은 `public-api-final.json`, `render-deploy-final.json`, `render-events-final.json`입니다. Render Dashboard 직접 스크린샷은 로그인 및 브라우저 제어 접근 제한으로 확보하지 못했습니다. Render API 응답을 읽기 쉽게 표시한 생성 기록 이미지가 포함될 경우 **Dashboard 원본 화면이 아니라 실제 API 응답에 기반한 검증 기록 이미지**로 명확히 표시합니다. 이 접근 제한을 Render 서비스 오류로 판단하지 않았습니다.

검증 후 보고서와 문서만 갱신하는 커밋에는 `[skip render]`를 사용할 수 있습니다. 이 경우 GitHub 최신 문서 커밋과 현재 실행 중인 위 서비스 커밋은 다를 수 있으며, 검증한 앱 코드는 위 배포 커밋 기준입니다.
