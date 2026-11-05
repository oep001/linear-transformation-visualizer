# Compatible with Windows PowerShell 5.1 and PowerShell 7.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*/[a-z0-9][a-z0-9._-]*$')]
    [string]$ImageRepository,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$Commit,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^sha256:[0-9a-f]{64}$')]
    [string]$Digest,
    [ValidatePattern('^[a-z0-9][a-z0-9_.-]*$')]
    [string]$ContainerName = 'linear-transformation-visualizer',
    [ValidateRange(1024, 65535)]
    [int]$Port = 8000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Docker {
    param([string[]]$Arguments)
    $result = & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker $($Arguments[0]) failed (exit $LASTEXITCODE)"
    }
    return $result
}

function Find-Container([string]$Name) {
    $id = Invoke-Docker -Arguments @('container', 'ls', '-aq', '--filter', "name=^/$Name`$")
    if ($id) { return ($id | Select-Object -First 1).Trim() }
    return $null
}

function Assert-Service([string]$BaseUrl, [string]$ExpectedCommit) {
    $lastError = ''
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $health = Invoke-RestMethod "$BaseUrl/health" -TimeoutSec 3
            if ($health.status -ne 'ok') { throw 'Invalid health response' }
            $version = Invoke-RestMethod "$BaseUrl/api/version" -TimeoutSec 3
            if ($version.commit -ne $ExpectedCommit) { throw "Commit mismatch: $($version.commit)" }
            $body = '{"matrix":[[0,-1],[1,0]],"vector":[2,1]}'
            $result = Invoke-RestMethod "$BaseUrl/api/transform" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 3
            if ($result.transformed_vector.Count -ne 2 -or $result.transformed_vector[0] -ne -1 -or $result.transformed_vector[1] -ne 2 -or $result.determinant -ne 1) {
                throw 'Transform regression: expected [-1,2], determinant 1'
            }
            Write-Host "Verified health, commit=$ExpectedCommit and rotation [-1,2] at $BaseUrl"
            return
        } catch {
            $lastError = $_.Exception.Message
            Start-Sleep -Seconds 2
        }
    }
    throw "Service validation failed: $lastError"
}

$mutex = New-Object System.Threading.Mutex($false, "Local\HW3Deploy-$ContainerName")
$locked = $false
$candidate = "$ContainerName-candidate"
$backup = "$ContainerName-previous"
$candidateId = $null
$candidateAttempted = $false
$oldId = $null
$newId = $null
$oldStopped = $false
$oldRenamed = $false
$replacementStarted = $false
try {
    $locked = $mutex.WaitOne(0)
    if (-not $locked) { throw 'Another deployment is already running' }
    $osType = Invoke-Docker -Arguments @('info', '--format', '{{.OSType}}')
    if ($osType -ne 'linux') { throw 'Docker Desktop must be running Linux containers' }
    if ((Find-Container $candidate) -or (Find-Container $backup)) {
        throw "A candidate/previous container already exists. Inspect it and recover manually before retrying."
    }
    $oldId = Find-Container $ContainerName
    $oldCommit = $null
    if ($oldId) {
        $oldInfo = (Invoke-Docker -Arguments @('inspect', $oldId) | Out-String | ConvertFrom-Json)[0]
        if ($oldInfo.Config.Labels.'io.hw3.managed' -ne 'true') {
            throw "Existing container is not managed by HW3; choose another ContainerName/Port."
        }
        $oldCommit = $oldInfo.Config.Labels.'org.opencontainers.image.revision'
        if ($oldCommit -notmatch '^[0-9a-f]{40}$') { throw 'Previous commit label is invalid' }
        # Establish that rollback target really is healthy before touching it.
        Assert-Service -BaseUrl "http://127.0.0.1:$Port" -ExpectedCommit $oldCommit
    }

    $image = "docker.io/$ImageRepository@$Digest"
    Write-Host "Pulling sha-$Commit by immutable digest: $Digest"
    Invoke-Docker -Arguments @('pull', $image) | Out-Host
    $imageInfo = (Invoke-Docker -Arguments @('image', 'inspect', $image) | Out-String | ConvertFrom-Json)[0]
    if ($imageInfo.Config.Labels.'org.opencontainers.image.revision' -ne $Commit) {
        throw 'Image revision label does not match the requested Git commit'
    }
    # No host directories or Docker socket are mounted in the application.
    $candidateAttempted = $true
    $candidateId = Invoke-Docker -Arguments @('run', '-d', '--name', $candidate, '--label', 'io.hw3.managed=true', '-p', '127.0.0.1::8000', $image)
    $candidateInfo = (Invoke-Docker -Arguments @('inspect', $candidateId) | Out-String | ConvertFrom-Json)[0]
    $candidatePort = $candidateInfo.NetworkSettings.Ports.'8000/tcp'[0].HostPort
    Assert-Service -BaseUrl "http://127.0.0.1:$candidatePort" -ExpectedCommit $Commit
    Invoke-Docker -Arguments @('rm', '-f', $candidateId) | Out-Null
    $candidateId = $null
    $candidateAttempted = $false

    if ($oldId) {
        Invoke-Docker -Arguments @('stop', '--time', '20', $oldId) | Out-Null
        $oldStopped = $true
        Invoke-Docker -Arguments @('rename', $oldId, $backup) | Out-Null
        $oldRenamed = $true
    }
    $replacementStarted = $true
    $newId = Invoke-Docker -Arguments @('run', '-d', '--name', $ContainerName, '--restart', 'unless-stopped', '--label', 'io.hw3.managed=true', '-p', "127.0.0.1:${Port}:8000", $image)
    Assert-Service -BaseUrl "http://127.0.0.1:$Port" -ExpectedCommit $Commit
    if ($oldRenamed) {
        Invoke-Docker -Arguments @('rm', $oldId) | Out-Null
        $oldRenamed = $false
        $oldStopped = $false
    }
    Write-Host "DEPLOYMENT SUCCEEDED commit=$Commit digest=$Digest container=$newId"
} catch {
    $deployError = $_.Exception.Message
    Write-Warning "DEPLOYMENT FAILED: $deployError"
    if ($locked) {
        try {
            # docker run can create a stopped container and then exit nonzero.
            if ($candidateAttempted -and -not $candidateId) { $candidateId = Find-Container $candidate }
            if ($candidateId) {
                & docker logs --tail 50 $candidateId 2>&1 | Out-Host
                Invoke-Docker -Arguments @('rm', '-f', $candidateId) | Out-Null
            }
            if ($replacementStarted) {
                $failedId = Find-Container $ContainerName
                if ($failedId -and $failedId -ne $oldId) {
                    & docker logs --tail 50 $failedId 2>&1 | Out-Host
                    Invoke-Docker -Arguments @('rm', '-f', $failedId) | Out-Null
                }
            }
            if ($oldStopped) {
                if ($oldRenamed) { Invoke-Docker -Arguments @('rename', $oldId, $ContainerName) | Out-Null }
                Invoke-Docker -Arguments @('start', $oldId) | Out-Null
                Assert-Service -BaseUrl "http://127.0.0.1:$Port" -ExpectedCommit $oldCommit
                Write-Warning "ROLLBACK SUCCEEDED: restored commit=$oldCommit. Deployment still fails."
            }
        } catch {
            Write-Warning "RECOVERY FAILED: $($_.Exception.Message). Inspect docker ps -a and docker logs."
        }
    }
    throw $deployError
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
