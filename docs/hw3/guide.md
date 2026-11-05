# HW3 실행 가이드

마감: **2026-11-09 23:59:59 KST**. 이 문서는 설정·재현 절차이며 성공 증거는 [검증 기록](verification.md)에 따로 기록합니다. 기존 Render 서비스와 수학·화면 기능을 유지합니다.

## 1. 먼저 전체 흐름 이해하기

```text
GitHub main에 Push
  ├─ 기존 Render: Python 패키지 설치 → Uvicorn 실행 → 공개 서비스 갱신
  └─ GitHub Actions CI
      ├─ pytest + JavaScript 문법 검사
      ├─ Windows 배포/복구 스크립트 모의 검사
      └─ 둘 다 성공 → Linux Docker 이미지 빌드 → 컨테이너 API 검사
          → main Push인 경우만 Docker Hub sha-<40자리 커밋> 태그 업로드
          → 업로드 digest 전달 → deploy.yml 호출
          → Windows Self-hosted Runner가 같은 이미지 다운로드
          → 임시 컨테이너 검사 → 기존 컨테이너 교체
          → /health + /api/version + /api/transform 검사
```

| 도구 | 이 프로젝트에서 맡는 역할 |
| --- | --- |
| GitHub | 코드와 변경 이력, 커밋 SHA, PR 보관 |
| GitHub Actions | Push를 감지해 검사·빌드·업로드·배포 순서 실행 |
| Docker | Python·패키지·기존 앱·정적 파일을 실행 가능한 이미지로 묶고 컨테이너 실행 |
| Docker Hub | CI가 만든 이미지를 보관해 로컬 PC가 같은 결과물을 받도록 연결 |
| Self-hosted Runner | 로컬 Windows에서 GitHub의 허용된 배포 작업을 받아 Docker 명령 실행 |
| Render | 기존 Python 방식의 공개 서비스 운영; Docker Hub/로컬 Runner와 독립 |

Render는 기존 On Commit 설정으로 CI와 병행됩니다. 새 Docker 경로만 테스트 성공을 배포 선행 조건으로 삼습니다. 이 작업에서 Render 설정을 변경하지 않습니다.

## 2. Docker Desktop 준비

Windows 11 x64, 하드웨어 가상화와 WSL 2를 준비하고 [공식 Windows 설치 안내](https://docs.docker.com/desktop/setup/install/windows-install/)로 Docker Desktop을 설치합니다. 설치 과정의 관리자 승인·재부팅은 사용자가 진행합니다. Docker Desktop을 시작하고 Linux containers 모드인지 확인합니다. 일반 PowerShell을 새로 엽니다.

```powershell
wsl --status
docker version
docker info --format '{{.OSType}}'
```

성공 기준: Client/Server 버전 모두 표시, 마지막 명령 출력 `linux`. 명령이 없으면 설치 후 터미널을 다시 열고, Server 연결 오류는 Docker Desktop 실행 여부와 현재 로그인 사용자를 확인합니다. 8000 포트 충돌도 확인합니다.

```powershell
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
```

## 3. 브랜치 코드로 로컬 이미지 검사

아직 저장소가 없다면 아래 첫 두 명령으로 가져옵니다. 이미 있다면 해당 프로젝트 폴더에서 시작합니다.

```powershell
git clone https://github.com/oep001/linear-transformation-visualizer.git
cd linear-transformation-visualizer
git switch hw3/docker-cicd
$commit = (git rev-parse HEAD).Trim()
docker build --platform linux/amd64 --build-arg "GIT_COMMIT=$commit" -t "hw3-local:sha-$commit" .
docker run -d --name hw3-preview -p 127.0.0.1:18000:8000 "hw3-local:sha-$commit"
python scripts/smoke.py --url http://127.0.0.1:18000 --commit $commit
docker ps --filter name=hw3-preview
docker logs hw3-preview
```

Python이 없으면 `/health`, `/api/version`은 아래 PowerShell 명령으로 확인합니다. 성공 기준: build 종료 코드 0, 컨테이너 `Up`/잠시 후 `healthy`, smoke `status: passed`, 반환 커밋과 `$commit` 동일. 이 검사는 로컬 build/run 검사이며 Docker Hub 업로드나 Runner 자동 배포 증거가 아닙니다. 검증 후 본인이 만든 미리보기 컨테이너만 정리합니다.

```powershell
Invoke-RestMethod http://127.0.0.1:18000/health
Invoke-RestMethod http://127.0.0.1:18000/api/version
docker rm -f hw3-preview
```

## 4. Docker Hub와 GitHub 설정

1. [Docker Hub](https://hub.docker.com/)에서 본인 계정을 준비하고 **Public** 저장소 `linear-transformation-visualizer`를 만듭니다. Public 이미지이므로 로컬 Runner에는 Hub 비밀번호나 토큰을 전달하지 않습니다.
2. Docker 계정 설정의 Personal access tokens에서 과제용 토큰을 생성합니다. 이미지 업로드에 필요한 Read/Write 권한을 주고 Delete 권한은 주지 않습니다. 토큰 값은 GitHub Secrets에만 입력하고 채팅·파일·스크린샷에 노출하지 않습니다.
3. [GitHub Actions 설정](https://github.com/oep001/linear-transformation-visualizer/settings/secrets/actions)에서 다음 값을 등록합니다.

| 종류 | 정확한 이름 | 값 |
| --- | --- | --- |
| Repository secret | `DOCKERHUB_USERNAME` | Docker Hub 로그인 사용자명 |
| Repository secret | `DOCKERHUB_TOKEN` | 위에서 만든 토큰; 로그인 비밀번호 사용 안 함 |
| Repository variable | `DOCKERHUB_IMAGE` | `사용자명/linear-transformation-visualizer` (소문자, URL·태그 제외) |
| Repository variable | `HW3_DEPLOY_ENABLED` | 준비 중에는 `false`, Runner 준비 후 `true` |

Repository variables는 같은 Settings > Secrets and variables > Actions의 Variables 탭에 등록합니다. 개인 계정이라면 IMAGE의 앞부분은 위 사용자명과 같아야 합니다. 조직 저장소는 해당 토큰에 쓰기 권한이 있어야 합니다. 비밀값이 비어 있으면 main 업로드 작업이 명확한 오류로 실패합니다.

`main` Push에서만 로그인·업로드합니다. PR·HW3 브랜치 Push·수동 CI 실행은 테스트와 로컬 이미지 빌드/실행만 하고 Hub 업로드와 Runner 호출은 생략합니다. 이미지 태그는 `sha-<40자리 Git SHA>`이며 `latest`를 배포 기준으로 사용하지 않습니다. CI 로그·Summary에 digest가 기록됩니다. 같은 SHA 태그를 다시 올리더라도 배포는 그 실행에서 받은 `sha256:...` digest로 이미지를 고정합니다.

## 5. Runner 보안 및 등록

이 저장소는 공개 저장소입니다. [GitHub의 공식 경고](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)처럼 PR을 통해 위험한 작업이 PC에서 실행될 수 있으므로 아래 설정이 필요합니다. 워크플로의 if 조건·레이블 자체는 보안 격리 기능이 아닙니다.

- Repository Settings > Actions > General에서 외부 기여자 워크플로는 모두 실행 승인이 필요하도록 설정하고, 외부 PR의 Runner 대상·워크플로 변경을 확인 없이 승인하지 않습니다. `pull_request_target`에 PR 코드를 checkout하는 흐름을 추가하지 않습니다.
- `main`은 직접 쓰기 권한을 최소화하고 보호 규칙/Ruleset으로 PR 검토와 `test`, `deploy-script`, `docker` 검사를 요구하도록 권장합니다. Actions·배포 스크립트 변경도 검토합니다.
- Settings > Environments에서 `hw3-local`을 만들고 Deployment branches를 **Selected branches: main**으로 한정합니다. 해당 계정/플랜에서 제공하는 보호 기능을 사용합니다. 매번 자동 배포가 필요하면 required reviewer를 추가하지 않으며 보호된 main을 신뢰 경계로 삼습니다.
- 전용 Windows 일반 사용자 계정으로 Runner를 실행하고 해당 계정에 개인 문서·클라우드 키를 두지 않습니다. 실행 중인 Runner는 GitHub에 허용된 작업을 받으므로 과제 검증 때만 켭니다. Runner 그룹의 워크플로 제한을 사용할 수 있는 계정이라면 이 저장소의 CI/배포 워크플로만 허용합니다.
- 앱 컨테이너는 일반 사용자로 실행하며 host 볼륨·Docker 소켓을 연결하지 않습니다. 접속 포트는 `127.0.0.1`에만 열어 로컬 PC에서 접속합니다. 방화벽의 외부 포트 개방은 필요하지 않습니다.

등록 방법:

1. [Runner 설정](https://github.com/oep001/linear-transformation-visualizer/settings/actions/runners) > New self-hosted runner > **Windows / x64**를 선택합니다.
2. 일반 사용자 PowerShell에서 전용 폴더를 만듭니다. 소스 폴더 안에는 설치하지 않습니다.

```powershell
New-Item -ItemType Directory -Force C:\actions-runner-hw3 | Out-Null
Set-Location C:\actions-runner-hw3
```

3. GitHub 페이지에 방금 표시된 Download 명령(최신 버전 URL·SHA256 포함)을 **그대로** 실행합니다. 등록 토큰은 단기 비밀값이며 문서에 고정하거나 저장소에 올리지 않습니다. 페이지에 표시된 Configure 명령에 레이블을 추가합니다. 아래 `<...>`는 실제 화면 값으로 바꿔야 합니다.

```powershell
.\config.cmd --url https://github.com/oep001/linear-transformation-visualizer --token <GitHub화면의단기등록토큰> --name hw3-windows --labels hw3-deploy
```

서비스로 설치할지 묻는 경우 처음에는 **N**을 선택합니다. Docker Desktop이 켜진 동일한 Windows 사용자 세션에서 실행하는 방법이 가장 단순합니다.

```powershell
docker version
docker info --format '{{.OSType}}'
.\run.cmd
```

성공 기준: 터미널 `Listening for Jobs`, GitHub의 Runner 상태 `Idle`, 레이블 `self-hosted`, `Windows`, `X64`, `hw3-deploy` 모두 표시. 기본 Windows PowerShell 5.1과 Git이 필요합니다(별도 PowerShell 7 설치 불필요). Checkout 액션의 현재 Node 런타임 요구사항을 만족하도록 Runner는 GitHub가 제시하는 최신 버전을 사용합니다.

Docker 접근 오류는 Runner를 실행하는 **그 사용자**로 `docker info`를 확인해 해결합니다. 설치 방식이 docker-users 그룹을 요구하면 해당 사용자만 추가한 뒤 재로그인합니다. Docker Desktop 사용자 세션과 다른 서비스 계정의 Docker 접근을 당연히 가정하지 않습니다. Windows 서비스로 전환하려면 Docker Desktop 기동·동일 계정·재부팅 후 연결을 별도로 검증합니다.

검증 중 Windows 설정 > 시스템 > 전원에서 전원 연결 시 절전을 끕니다. 노트북 덮개 닫기·로그아웃·PC 종료·Docker Desktop 종료·Runner 창 종료 시 배포를 받을 수 없습니다. `unless-stopped`는 Docker 엔진 재시작 후 컨테이너 재시작 정책이며 PC를 깨우거나 Docker Desktop을 자동 실행하는 기능은 아닙니다.

Runner 준비 후 `HW3_DEPLOY_ENABLED=true`로 변경합니다. 변수 변경만으로 배포는 시작되지 않습니다. 승인 후 새 main Push가 필요합니다. 준비되지 않은 동안 이 값이 false면 deploy는 **skipped**이며 성공 배포로 기록하지 않습니다.

## 6. 승인 후 최초 자동 배포

이 PR을 main에 병합하면 기존 Render 운영 서비스도 자동 갱신됩니다. **사용자 승인 전에는 병합하지 않습니다.** 승인과 Hub/Runner 준비 후 PR을 병합합니다. Actions `CI` 실행에서 순서대로 test, deploy-script, docker, deploy/windows 성공을 확인합니다. `deploy.yml`은 CI가 호출하는 재사용 워크플로이므로 별도 독립 실행 목록이 생기지 않아도 CI 안에 배포 작업이 보입니다.

```powershell
$base = 'http://127.0.0.1:8000'
docker ps --filter name=linear-transformation-visualizer
docker logs --tail 50 linear-transformation-visualizer
Invoke-RestMethod "$base/health"
$version = Invoke-RestMethod "$base/api/version"
$version
$body = '{"matrix":[[0,-1],[1,0]],"vector":[2,1]}'
Invoke-RestMethod "$base/api/transform" -Method Post -ContentType 'application/json' -Body $body
docker inspect linear-transformation-visualizer --format '{{.Config.Image}}'
docker inspect linear-transformation-visualizer --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
```

성공 기준: health `ok`, transformed_vector `[-1,2]`, determinant `1`, version.commit이 해당 CI 실행의 main SHA 전체와 같음. Config.Image의 `@sha256:...`가 CI Summary의 digest와 같음. 버전 숫자 `1.0.2`가 그대로여도 commit으로 서로 다른 배포를 구분합니다. 브라우저 `http://127.0.0.1:8000`에서 기본 기능도 확인합니다.

## 7. 실제 코드 변경 후 Push만으로 업데이트 검증

최초 Docker 배포 성공 이후 별도 변경을 해야 '업데이트' 증거가 됩니다. 다음 작업도 main을 바꾸므로 사용자 승인을 받은 뒤 실행합니다. 작업 폴더가 깨끗한지 먼저 확인하고, 아래 예시는 변경 브랜치를 만들어 PR로 main에 반영합니다.

```powershell
git switch main
git pull --ff-only
git switch -c hw3/verify-update
$file = Join-Path (Get-Location) 'static/index.html'
$old = '행렬이 공간을 바꾸는 순간을 탐구합니다.'
$new = '행렬이 공간을 바꾸는 순간을 직접 탐구합니다.'
$text = [IO.File]::ReadAllText($file)
if (-not $text.Contains($old)) { throw '기준 문구가 달라졌습니다. 먼저 파일을 확인하세요.' }
[IO.File]::WriteAllText($file, $text.Replace($old, $new), (New-Object Text.UTF8Encoding($false)))
git diff -- static/index.html
git add static/index.html
git commit -m "Verify HW3 automatic Docker update with a copy change"
git push -u origin hw3/verify-update
```

GitHub에서 PR을 만들고 검사가 성공하면 승인 후 main으로 병합합니다. 병합에 따른 main Push가 CI를 시작합니다. 수동 `docker pull/run`이나 수동 Render Deploy를 실행하지 않고 결과를 기다립니다.

1. Push/merge의 새 main SHA 전체를 기록합니다. squash merge라면 feature 브랜치 SHA가 아닌 **main의 실제 SHA**를 사용합니다.
2. 그 SHA의 CI 테스트·이미지 업로드·Runner 배포가 모두 성공하는지 확인합니다.
3. Docker Hub의 새 `sha-<SHA>` 태그와 digest, Runner 컨테이너 이미지 digest를 대조합니다.
4. 로컬 `/api/version` commit 일치, 새 문구 '직접 탐구합니다.', health와 transform 검사를 확인합니다.
5. 기존 Render URL에서도 health·transform·같은 main SHA를 확인합니다. Render는 별도로 완료 시각이 다를 수 있습니다.
6. 아래 스크린샷과 [검증 기록](verification.md)에 전/후 값을 채웁니다. UI 변경이 PR에만 존재하거나 Docker를 수동 교체한 경우 자동 업데이트 성공으로 기록하지 않습니다.

## 8. 실패 대응과 수동 재현

Runner의 배포 스크립트는 CI가 업로드한 digest로 pull하고 이미지 revision label과 `/api/version`을 모두 검사합니다. 임시 컨테이너 검사 실패 시 기존 컨테이너를 유지합니다. 교체 후 실패 시 이전 컨테이너를 복구하고 기존 commit과 API까지 검사합니다. 복구 성공도 **배포 실패**로 반환합니다. 최초 설치에는 이전 버전이 없으므로 실패 컨테이너를 제거하고 실패로 끝납니다.

- `unauthorized`: Hub의 저장소명·계정·Read/Write 토큰과 두 Secrets를 다시 확인합니다.
- `Queued` + Runner offline: 같은 사용자로 Docker Desktop과 run.cmd를 켜고 모든 레이블을 확인합니다.
- main HEAD 변경 오류: 오래된 커밋 배포를 거부한 결과입니다. 더 최신 CI 결과를 확인합니다.
- 8000 충돌/관리하지 않는 컨테이너: 다른 앱을 임의 삭제하지 말고 포트를 비우거나 별도 이름/포트로 수동 검사합니다.
- `RECOVERY FAILED` 또는 PC/Runner 강제 종료: 아래처럼 상태를 확인하고 복구합니다. `-previous`가 있으면 이전 버전을 자동 삭제하지 않고 검사를 멈춥니다. Docker 엔진/PC 장애와 작업 강제 취소까지 자동 복구를 보장하지 않습니다. 교체 순간에는 짧은 중단이 있을 수 있습니다.

```powershell
docker ps -a
docker logs --tail 100 linear-transformation-visualizer
docker logs --tail 100 linear-transformation-visualizer-previous
```

실패한 새 컨테이너와 이전 컨테이너를 실제 상태로 확인한 뒤, 본인이 관리하는 실패 컨테이너만 제거하고 이전 것을 복구합니다(둘 다 존재하고 previous가 정상 이전 버전인 경우).

```powershell
docker rm -f linear-transformation-visualizer
docker rename linear-transformation-visualizer-previous linear-transformation-visualizer
docker start linear-transformation-visualizer
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/api/version
```

수동 배포 재현(자동 배포 증거로 사용하지 않음): CI Summary에서 해당 SHA와 digest를 복사한 뒤 프로젝트 폴더에서 실행합니다.

```powershell
./scripts/deploy.ps1 -ImageRepository '사용자명/linear-transformation-visualizer' -Commit '<40자리SHA>' -Digest 'sha256:<64자리digest>'
```

## 공식 참고

- [GitHub 워크플로 재사용](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- [GitHub Actions 보안](https://docs.github.com/en/actions/reference/security/secure-use)
- [Windows Runner 등록](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)
- [Docker 공식 GitHub Actions 안내](https://docs.docker.com/build/ci/github-actions/)
- [Docker Windows 설치](https://docs.docker.com/desktop/setup/install/windows-install/)
