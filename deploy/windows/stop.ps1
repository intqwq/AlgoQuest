$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$EnvFile = Join-Path $ProjectRoot ".env.windows"

if (-not (Test-Path $EnvFile)) {
    throw ".env.windows does not exist. Nothing has been deployed by the Windows script."
}

Push-Location $ProjectRoot
try {
    & docker compose --env-file $EnvFile --profile all down
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose shutdown failed."
    }
}
finally {
    Pop-Location
}
