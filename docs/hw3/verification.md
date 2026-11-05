# HW3 실제 검증 기록

확인일: **2026-11-05 KST**. 구현 완료와 실행 성공을 구분합니다. main 병합과 운영 변경은 사용자 승인 전까지 진행하지 않습니다.

| 검증 항목 | 실제 상태 | 증거/한계 |
| --- | --- | --- |
| 최신 저장소 확인 | 완료 | main 1117e8ed356c96c10c8b7b59f314557eb5278fa8, 13개 파일 |
| 기존 CI 이력 | success | [기준 main CI](https://github.com/oep001/linear-transformation-visualizer/actions/runs/41395525377) |
| 로컬 pytest | **41 passed / 1 warning / 4.40s** | 기존 37개 보존 + 버전 출처 검사 4개, Python 3.11.7 |
| JavaScript 문법 | 통과 | Node 22.19.0 `node --check static/app.js` 종료 코드 0 |
| PowerShell 복구 흐름 | **모의 8개 통과** | 실제 Docker/HTTP 호출을 대체한 제어 흐름 검사; 실제 배포 증거 아님 |
| GitHub의 Linux 이미지 빌드/실행 | 실행 예정 | PR CI의 실제 결과를 여기에 추가 |
| 로컬 Docker 빌드/실행 | 미검증 | PC PATH 및 기본 설치 경로에서 Docker 미확인 |
| Docker Hub 업로드 | 미검증 | 사용자 계정·저장소·토큰·Secrets 설정과 승인된 main Push 필요 |
| 실제 Windows Self-hosted Runner | 미등록/미검증 | 사용자가 등록·시작·Docker 접근 확인 필요 |
| 코드 변경 후 Docker 자동 업데이트 | 미검증 | 최초 자동 배포 후 별도 문구 변경 main Push 필요 |
| Docker 이미지/API 커밋 일치 | 미검증 | CI 이미지 실행 및 실제 Runner 배포 결과로 따로 검증 |
| 기존 Render 공개 API | 정상 | 21:36:33 KST, /health ok, 회전 (-1,2), det=1 |
| 기존 Render 실행 커밋 | **1.0.2 / 6559848 일치** | 기존 배포 dep-dbk22uivcj2c73fi3if0 live/new_commit 재확인 |

현재 Render는 변경하지 않았습니다. 현재 공개 서비스가 정상이라는 사실은 HW3 변경을 main에 반영한 이후까지 검증했다는 뜻은 아닙니다. 반영 후에도 재확인이 필요합니다. 로컬 pytest의 외부 Starlette/AnyIO DeprecationWarning 1건은 실패가 아닙니다.

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
