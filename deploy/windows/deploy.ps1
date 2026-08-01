param(
    [ValidateSet("all", "web", "api", "judge", "database")]
    [string]$Mode = "all"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$EnvFile = Join-Path $ProjectRoot ".env.windows"
$ExampleEnv = Join-Path $ProjectRoot ".env.windows.example"

function New-HexSecret {
    param([int]$Bytes = 32)
    $buffer = New-Object byte[] $Bytes
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($buffer)
    }
    finally {
        $generator.Dispose()
    }
    return -join ($buffer | ForEach-Object { $_.ToString("x2") })
}

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop is not installed or docker.exe is not in PATH."
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop is not running. Start it with Linux containers enabled."
}

& docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose v2 is unavailable. Update Docker Desktop."
}

if (-not (Test-Path $EnvFile)) {
    Copy-Item $ExampleEnv $EnvFile
    Write-Host "Created .env.windows."
}

$content = Get-Content $EnvFile -Raw
$changed = $false
if ($content.Contains("CHANGE_ME_DATABASE_PASSWORD")) {
    $content = $content.Replace(
        "CHANGE_ME_DATABASE_PASSWORD",
        (New-HexSecret -Bytes 24)
    )
    $changed = $true
}
if ($content.Contains("CHANGE_ME_JUDGE_TOKEN")) {
    $content = $content.Replace(
        "CHANGE_ME_JUDGE_TOKEN",
        (New-HexSecret -Bytes 32)
    )
    $changed = $true
}
if ($changed) {
    Write-Utf8NoBom -Path $EnvFile -Content $content
    Write-Host "Filled .env.windows with generated local secrets."
}

Push-Location $ProjectRoot
try {
    if ($Mode -in @("all", "judge")) {
        & docker build `
            -f judge/Dockerfile.runner `
            -t algoquest-runner:cpp14 `
            judge
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to build the isolated C++ runner image."
        }
    }

    & docker compose `
        --env-file $EnvFile `
        --profile $Mode `
        up -d --build --remove-orphans
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose deployment failed."
    }

    if ($Mode -in @("all", "judge")) {
        Write-Host "Running the isolated Judge smoke test..."
        & docker compose `
            --env-file $EnvFile `
            exec -T judge node scripts/smoke.mjs
        if ($LASTEXITCODE -ne 0) {
            & docker compose --env-file $EnvFile logs --tail 100 judge judge-worker redis
            throw "Judge smoke test failed. Inspect the Judge API, worker, and Redis logs above."
        }
    }

    if ($Mode -eq "all") {
        Write-Host "Running the Core API end-to-end smoke test..."
        & docker compose `
            --env-file $EnvFile `
            exec -T api node scripts/smoke.mjs
        if ($LASTEXITCODE -ne 0) {
            & docker compose --env-file $EnvFile logs --tail 100 api judge
            throw "Core API smoke test failed. Submission polling or progress persistence is unavailable."
        }
        if ((Get-Content $EnvFile -Raw).Contains("AUTH_EMAIL_MODE=log")) {
            Write-Host "Account email is in local log mode."
            Write-Host "Use 'docker compose --env-file .env.windows logs -f api' to open verification links."
        }
        $ownerLine = Get-Content $EnvFile |
            Where-Object { $_ -match '^\s*SITE_OWNER_EMAIL\s*=' } |
            Select-Object -First 1
        if (-not $ownerLine -or $ownerLine -match '^\s*SITE_OWNER_EMAIL\s*=\s*$') {
            Write-Warning "SITE_OWNER_EMAIL is empty. Set it to a verified AlgoQuest account email to choose the site owner."
        }
    }

    & docker compose --env-file $EnvFile ps
    Write-Host ""
    switch ($Mode) {
        "all" {
            Write-Host "AlgoQuest: http://localhost:8080"
            Write-Host "API health: http://localhost:8787/health"
            Write-Host "Judge health: http://localhost:8788/health"
        }
        "web" { Write-Host "Web gateway: http://localhost:8080" }
        "api" { Write-Host "API health: http://localhost:8787/health" }
        "judge" { Write-Host "Judge health: http://localhost:8788/health" }
        "database" { Write-Host "PostgreSQL: 127.0.0.1:5432" }
    }
}
finally {
    Pop-Location
}

if (
    $Mode -eq "all" -and
    [Environment]::UserInteractive -and
    -not [Console]::IsInputRedirected
) {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Push-Location $ProjectRoot
        try {
            & node scripts/ops-console.mjs --env-file .env.windows
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Warning "Node.js is not in PATH, so the interactive operations console was not opened."
    }
}
