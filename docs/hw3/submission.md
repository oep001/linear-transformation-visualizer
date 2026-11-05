# HW3 제출 구성과 점검표

제출 마감: **2026-11-09 23:59:59 KST**. 파일명: `StudentID_Name_HW3.zip`. 실제 학번과 이름으로 바꿉니다. 신원 미확인 상태에서는 이 이름을 양식으로만 사용합니다.

```text
StudentID_Name_HW3.zip
  source/                 저장소의 추적 소스·설정 전체 (.github 포함)
  guide.md                복사 실행 명령과 성공 기준
  report-draft.md         수정 가능한 한국어 1페이지 보고서 초안
  HW3-report-draft.pdf    1페이지 PDF 초안
  verification.md          실행한 것과 미검증 항목 구분
  evidence/               실제 pytest·API·CI 로그와 실행 링크
  screenshots/            실제 화면 캡처만 포함
  submission-checklist.md  최종 확인 사항
```

## 확보할 실제 스크린샷

| 권장 파일 | 반드시 보여야 하는 내용 | 현재/추후 |
| --- | --- | --- |
| 01-pr.png | HW3 브랜치/PR, 변경 파일, CI 상태 | PR 생성 후 |
| 02-ci-build.png | 해당 SHA의 pytest·JS·Docker build/smoke 성공 | PR CI 후 |
| 03-hub-tag.png | Docker Hub repo, sha-태그, digest | main 업로드 후 |
| 04-runner.png | GitHub Runner Idle/Active, Windows/X64/hw3-deploy | 사용자 등록 후 |
| 05-deploy-job.png | CI 안 deploy/windows 성공, commit/digest, API 검사 | 실제 배포 후 |
| 06-container-api.png | docker ps와 health/version/transform 실제 응답 | 실제 로컬 배포 후 |
| 07-before-update.png | 최초 배포 문구·버전·커밋 | 변경 Push 전 |
| 08-after-update.png | '직접 탐구합니다.'와 새 커밋, 새 CI/Hub/Runner 결과 | 별도 main Push 후 |
| 09-render.png | 기존 공개 서비스와 버전·변환 기능 유지 | 현재 + main 반영 후 |

토큰·비밀번호·등록 토큰·불필요한 개인 경로를 캡처하지 않습니다. 전체 SHA/digest는 evidence 텍스트에도 보관해 화면의 짧은 SHA를 보완합니다. API 응답을 재구성한 이미지를 Dashboard 스크린샷처럼 제출하지 않습니다.

## 제출 직전

- [ ] 학번·이름을 보고서에 입력하고 ZIP 파일명을 변경했다.
- [ ] 승인 후 main 병합을 완료했다. 기존 Render 서비스도 재확인했다.
- [ ] Docker Hub의 실제 업로드 태그와 digest를 보관했다.
- [ ] Windows Runner를 실제 등록했고 배포 작업 success를 확인했다.
- [ ] 최초 배포 이후 별도 설명 문구 변경을 main에 Push했다.
- [ ] 수동 docker 교체 없이 자동 업데이트가 됐고 새 main SHA와 API commit이 같다.
- [ ] health·transform·정적 화면도 정상이다.
- [ ] 실제 화면만 screenshots에 넣고 모든 필요한 스크린샷을 확보했다.
- [ ] 보고서의 미검증 항목은 실제 결과가 생긴 부분만 갱신했다.
- [ ] .github/workflows/ci.yml, deploy.yml, Dockerfile, .dockerignore, scripts가 source에 포함됐다.
- [ ] .git, .venv, 캐시, .env, Docker 로그인 정보, Runner 설치 폴더/토큰은 ZIP에서 제외했다.
- [ ] ZIP을 새 폴더에 풀어 가이드·PDF가 열리고 숨김 설정 파일도 포함되는지 확인했다.

실제 배포가 완료되기 전에 만든 ZIP은 **준비본**입니다. 모든 항목이 완료된 최종 제출본으로 표현하지 않습니다.
