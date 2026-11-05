# Deployment control-flow tests. All Docker/HTTP calls are simulated.
# This is NOT evidence of a real Docker deployment.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$global:HW3TestCommitA = 'a' * 40
$global:HW3TestCommitB = 'b' * 40
$global:HW3TestDigestB = 'sha256:' + ('c' * 64)
$global:HW3TestTestResults = @()

function docker {
    $a = @($args)
    $global:LASTEXITCODE = 0
    $global:HW3TestCalls += ($a -join ' ')
    switch ($a[0]) {
        'info' { return 'linux' }
        'container' {
            $name = ($a[4] -replace '^name=\^/', '') -replace '\$$', ''
            foreach ($id in @($global:HW3TestContainers.Keys)) {
                if ($global:HW3TestContainers[$id].Name -eq $name) { return $id }
            }
            return
        }
        'pull' {
            if ($global:HW3TestScenario -eq 'pull-fails') { $global:LASTEXITCODE = 1 }
            return
        }
        'image' {
            $revision = $global:HW3TestCommitB
            if ($global:HW3TestScenario -eq 'wrong-label') { $revision = $global:HW3TestCommitA }
            return ConvertTo-Json -Depth 8 -InputObject @(@{Config=@{Labels=@{'org.opencontainers.image.revision'=$revision}}})
        }
        'inspect' {
            $c = $global:HW3TestContainers[$a[1]]
            return ConvertTo-Json -Depth 8 -InputObject @(@{
                Config=@{Labels=@{'io.hw3.managed'=$c.Managed; 'org.opencontainers.image.revision'=$c.Commit}}
                NetworkSettings=@{Ports=@{'8000/tcp'=@(@{HostPort='49152'})}}
            })
        }
        'run' {
            $name = $a[[Array]::IndexOf($a, '--name') + 1]
            $id = 'id-' + $name
            $global:HW3TestContainers[$id] = @{Name=$name;Commit=$global:HW3TestCommitB;Managed='true';Running=$true}
            return $id
        }
        'rm' {
            $global:HW3TestContainers.Remove($a[-1])
            return
        }
        'stop' { $global:HW3TestContainers[$a[-1]].Running = $false; return }
        'start' { $global:HW3TestContainers[$a[-1]].Running = $true; return }
        'rename' {
            if ($global:HW3TestScenario -eq 'rename-fails' -and $a[2] -like '*-previous') {
                $global:LASTEXITCODE = 1
            } else { $global:HW3TestContainers[$a[1]].Name = $a[2] }
            return
        }
        'logs' { return 'simulated container log' }
        default { throw "Unexpected fake Docker command: $a" }
    }
}

function Invoke-RestMethod {
    param($Uri, $TimeoutSec, $Method, $ContentType, $Body)
    $isCandidate = $Uri -like '*:49152/*'
    $current = @($global:HW3TestContainers.Values | Where-Object { $_.Name -eq 'test-hw3' -and $_.Running })
    if ($isCandidate) { $currentCommit = $global:HW3TestCommitB }
    elseif ($current.Count) { $currentCommit = $current[0].Commit }
    else { throw 'No running service' }
    if ($global:HW3TestScenario -eq 'candidate-fails' -and $isCandidate) { throw 'Simulated candidate failure' }
    if ($global:HW3TestScenario -eq 'production-fails' -and -not $isCandidate -and $currentCommit -eq $global:HW3TestCommitB) { throw 'Simulated production failure' }
    if ($Uri -like '*/health') { return @{status='ok'} }
    if ($Uri -like '*/api/version') { return @{commit=$currentCommit} }
    if ($Uri -like '*/api/transform') { return @{transformed_vector=@(-1,2);determinant=1} }
    throw "Unexpected HTTP endpoint: $Uri"
}
function Start-Sleep { param($Seconds) }

foreach ($case in @('initial', 'upgrade', 'pull-fails', 'wrong-label', 'candidate-fails', 'production-fails', 'rename-fails', 'unmanaged')) {
    $global:HW3TestScenario = $case
    $global:HW3TestContainers = @{}
    $global:HW3TestCalls = @()
    if ($case -ne 'initial') {
        $global:HW3TestContainers['old'] = @{Name='test-hw3';Commit=$global:HW3TestCommitA;Managed='true';Running=$true}
        if ($case -eq 'unmanaged') { $global:HW3TestContainers['old'].Managed = 'false' }
    }
    $failed = $false
    try {
        & "$PSScriptRoot/../scripts/deploy.ps1" -ImageRepository 'example/visualizer' -Commit $global:HW3TestCommitB -Digest $global:HW3TestDigestB -ContainerName 'test-hw3'
    } catch { $failed = $true }
    $shouldFail = $case -notin @('initial', 'upgrade')
    if ($failed -ne $shouldFail) { throw "Case $case reported wrong success/failure" }
    $active = @($global:HW3TestContainers.Values | Where-Object { $_.Name -eq 'test-hw3' -and $_.Running })
    $expected = if ($shouldFail) { $global:HW3TestCommitA } else { $global:HW3TestCommitB }
    if ($active.Count -ne 1 -or $active[0].Commit -ne $expected) { throw "Case $case did not preserve/restore expected version" }
    if (@($global:HW3TestContainers.Values | Where-Object { $_.Name -like '*-candidate' -or $_.Name -like '*-previous' }).Count -ne 0) { throw "Case $case left stale containers" }
    $global:HW3TestTestResults += "$case PASS"
}
$global:HW3TestTestResults | Write-Output
Write-Output '8 simulated deployment scenarios passed; real Docker execution is not covered.'
