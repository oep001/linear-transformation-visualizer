# HW3 실제 검증 기록

확인일: **2026-11-05 KST**. 구현 완료와 실행 성공을 구분합니다. main 병합과 운영 변경은 사용자 승인 전까지 진행하지 않습니다.

| 검증 항목 | 실제 상태 | 증거/한계 |
| --- | --- | --- |
| 최신 저장소 확인 | 완료 | main 1117e8ed356c96c10c8b7b59f314557eb5278fa8, 13개 파일 |
| 기존 CI 이력 | success | [기준 main CI](https://github.com/oep001/linear-transformation-visualizer/actions/runs/41395525377) |
| 로컬 pytest | **41 passed / 1 warning / 4.40s** | 기존 37개 보존 + 버전 출처 검사 4개, Python 3.11.7 |
| JavaScript 문법 | 통과 | Node 22.19.0 `node --check static/app.js` 종료 코드 0 |
| PowerShell 복구 흐름 | **로컬 모의 10개 통과** | 실제 Docker/HTTP 호출을 대체한 제어 흐름 검사; 실제 배포 증거 아님 |
| GitHub의 Linux 이미지 빌드/실행 | **성공** | [PR CI 42029401708](https://github.com/oep001/linear-transformation-visualizer/actions/runs/42029401708), 총 57초, test/deploy-script/docker success |
| 로컬 Docker 빌드/실행 | 미검증 | PC PATH 및 기본 설치 경로에서 Docker 미확인 |
| Docker Hub 업로드 | 미검증 | 사용자 계정·저장소·토큰·Secrets 설정과 승인된 main Push 필요 |
| 실제 Windows Self-hosted Runner | 미등록/미검증 | 사용자가 등록·시작·Docker 접근 확인 필요 |
| 코드 변경 후 Docker 자동 업데이트 | 미검증 | 최초 자동 배포 후 별도 문구 변경 main Push 필요 |
| Docker 이미지/API 커밋 일치 | **CI 컨테이너 일치 / 실제 Runner 미검증** | PR 테스트 merge SHA bea5c3b7117e018b757bdff4d8140f27c2b12a16 일치 |
| 기존 Render 공개 API | 정상 | 21:36:33 KST, /health ok, 회전 (-1,2), det=1 |
| 기존 Render 실행 커밋 | **1.0.2 / 6559848 일치** | 기존 배포 dep-dbk22uivcj2c73fi3if0 live/new_commit 재확인 |

현재 Render는 변경하지 않았습니다. 현재 공개 서비스가 정상이라는 사실은 HW3 변경을 main에 반영한 이후까지 검증했다는 뜻은 아닙니다. 반영 후에도 재확인이 필요합니다. 로컬 pytest의 외부 Starlette/AnyIO DeprecationWarning 1건은 실패가 아닙니다.

구현 브랜치: [hw3/docker-cicd](https://github.com/oep001/linear-transformation-visualizer/tree/hw3/docker-cicd), [초안 PR #1](https://github.com/oep001/linear-transformation-visualizer/pull/1). 구현 커밋 `21d2f526ed06aa41371890378fa94ff3e65ab38f`의 Push 실행과 PR 검증 실행이 발생했습니다. 위 PR 실행은 GitHub의 테스트용 merge commit을 빌드했으므로 API SHA는 feature HEAD와 다릅니다. main 배포에서는 실제 main SHA를 사용합니다.

실제 Docker 로그: 21:43:08 KST 이미지 build 완료, image ID `sha256:0bc1a84964ae0e0c0f28eeccd1571137af76299df38e93936a5d03c7faf5fc49` (로컬 image ID이며 Hub manifest digest가 아님). 21:43:11에 smoke `status: passed`, 1.0.2와 위 PR merge SHA 반환, 회전 [-1,2], determinant 1, 기저 및 HTML/JS/CSS 응답 확인. Hub login/push 단계와 deploy job은 **skipped**로 확인했습니다. 실제 CI/PR/Render 화면 3장을 확보했습니다.

추가 점검에서 docker run이 컨테이너 생성 후 오류를 반환하는 경우의 정리·복구를 보강하고 모의 시나리오 2개를 추가했습니다. 최종 브랜치 CI의 상태는 PR Checks 및 제출물 evidence의 최종 실행 기록을 확인합니다. 최초 8개와 보강 후 10개 검사를 구분합니다.

## 최초 배포 후 채울 기록

| 필드 | 실제 값 |
| --- | --- |
| 최초 main SHA / CI 실행 링크 | 미검증 |
| Hub sha-태그 / digest | 미검증 |
| Runner job 링크 / 완료 시각 KST | 미검증 |
| 컨테이너 Image / revision label | 미검증 |
| /health, /api/version, /api/transform | 미검증 |

## 두 번째 코드 변경 Push 후 채울 기록

| 필드 | 실제 값 |
| --- | --- |
| 변경 전 SHA / 새 main SHA | 미검증 |
| 설명 문구 변경 | '탐구합니다.' → '직접 탐구합니다.' 예정 |
| 자동 CI 실행 / 업로드 digest / Runner job | 미검증 |
| 로컬 API commit = 이미지 revision = 새 main SHA | 미검증 |
| 새 문구 브라우저 반영 / Render API 재확인 | 미검증 |

수동 실행 성공을 Push 자동 배포 성공으로 기록하지 않습니다. 실행하지 않은 로그·스크린샷은 생성하지 않습니다.
