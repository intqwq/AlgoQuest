$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$EnvFile = Join-Path $ProjectRoot ".env.windows"

Push-Location $ProjectRoot
try {
    & docker compose --env-file $EnvFile ps
    Write-Host ""
    foreach ($url in @(
        "http://localhost:8080/healthz",
        "http://localhost:8787/health",
        "http://localhost:8788/health"
    )) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $url
            Write-Host ("{0} -> HTTP {1}" -f $url, $response.StatusCode)
        }
        catch {
            Write-Host ("{0} -> offline" -f $url)
        }
    }
}
finally {
    Pop-Location
}
