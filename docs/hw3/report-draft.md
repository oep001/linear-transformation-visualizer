# Docker 기반 CI/CD 파이프라인 구축

오픈소스SW개발방법및도구 HW3 | 학번: __________ | 이름: __________
작성 기준: 2026년 11월 5일 | 제출 마감: 2026년 11월 9일 23:59:59 KST

## 목적과 전체 구조

HW2의 FastAPI·NumPy 계산 API와 HTML/CSS/JavaScript/SVG 선형변환 시각화 서비스를 유지하면서 Docker 기반 배포 경로를 추가하였다. main Push → GitHub Actions 테스트 → Linux 이미지 빌드·실행 검사 → Docker Hub 업로드 → Windows Self-hosted Runner → 컨테이너 교체 → 상태·버전·계산 검사의 흐름이다. 기존 Render는 동일 main의 Python 배포를 독립적으로 유지한다.

## 구현과 도구의 역할

GitHub는 코드와 커밋 이력을 보관하고 Actions는 변경을 감지하여 작업을 순서대로 실행한다. Dockerfile은 Python 3.12와 기존 앱·정적 파일을 하나의 이미지로 구성하며, 일반 사용자 권한으로 Uvicorn을 8000 포트에서 실행한다. .dockerignore는 실행에 필요한 파일만 허용한다. Docker Hub는 완성된 이미지를 보관하고 Windows Runner는 PC의 Docker Desktop에서 그 이미지를 실행한다. Render는 기존 공개 서비스 운영을 담당한다.

ci.yml은 기존 pytest·JavaScript 검사를 보존하고 컨테이너 검사를 추가하였다. main Push에서만 Secrets로 Hub에 로그인해 sha-<전체 커밋> 태그를 올린다. deploy.yml은 성공한 CI가 호출하며 업로드 결과의 digest로 이미지를 고정한다. PowerShell 스크립트는 임시 컨테이너를 먼저 검사하고 기존 컨테이너를 교체한다. 이후 오류가 발생하면 이전 컨테이너를 복구하고 배포 실패로 보고한다. /api/version은 Render의 RENDER_GIT_COMMIT을 우선 유지하고 Docker의 GIT_COMMIT을 추가 지원한다.

## 실제 실행 결과

로컬 Python 3.11.7에서 기존 37개와 추가 4개를 포함한 pytest 41개가 통과하였고 JavaScript 문법 검사도 통과하였다. 배포·복구 흐름은 Docker/HTTP를 대체한 모의 검사 10개로 확인하였다. 실제 GitHub PR CI(run 42029401708)는 57초에 성공했으며 Linux 이미지 빌드·컨테이너 실행·health·version SHA 일치·90도 회전 [-1,2]·정적 파일 검사가 통과하였다. 이 실행의 SHA는 PR 검증용 merge SHA이다. 기존 Render에서도 1.0.2/6559848, health ok, 정상 회전 계산과 실제 화면을 확인하였다.

## 미검증 사항과 후속 검증

Docker Hub 인증·Secrets, 로컬 Docker Desktop, 실제 Windows Runner 등록은 사용자 설정이 필요하다. 따라서 Hub 업로드, Runner의 실제 배포·복구, 별도 main 코드 변경 후 Push만으로 자동 업데이트되는 과정은 아직 미검증이다. main 병합은 사용자 승인 전까지 보류하였다. 준비 후 최초 자동 배포를 확인하고 설명 문구를 소폭 바꿔 다시 main에 반영하여 새 SHA·Hub digest·로컬 API commit·화면 문구를 대조해야 한다. PR은 호스팅 Runner에서만 검사하며 배포는 신뢰된 main Push로 제한한다. 공개 저장소 Runner의 외부 PR 승인과 main 보호 설정도 필요하다.

저장소: https://github.com/oep001/linear-transformation-visualizer
구현 PR: https://github.com/oep001/linear-transformation-visualizer/pull/1
증빙: CI·PR·Render 실제 화면, Actions 원본 로그, pytest XML, API 응답. 미검증 항목은 실제 실행 후에만 갱신한다.
