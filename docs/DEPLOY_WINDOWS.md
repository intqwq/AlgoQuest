# Deploy on Windows

## Requirements

- Windows 10/11 with WSL 2 support
- Docker Desktop using Linux containers
- PowerShell 5.1 or newer
- At least 8 GB of memory available to Docker for comfortable Judge builds

The Judge starts sibling Linux containers through Docker Desktop. Windows
containers are not supported.

## First deployment

From the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\deploy\windows\deploy.ps1
```

The command:

1. verifies Docker Desktop and Compose;
2. creates `.env.windows` with random PostgreSQL and Judge secrets;
3. builds the GNU C++14 runner;
4. builds and starts Web, API, Judge, and PostgreSQL;
5. submits a known-correct C++ program to the isolated runner and requires AC;
6. repeats the submission through the Core API, polls to AC, and verifies
   progress persistence;
7. prints the service addresses.

Open <http://localhost:8080>.

## Verify

```powershell
.\deploy\windows\status.ps1
docker compose --env-file .env.windows logs --tail 100 api
docker compose --env-file .env.windows logs --tail 100 judge
```

Test the Judge in Quest 01 with:

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    long long a, b;
    cin >> a >> b;
    cout << a + b << '\n';
}
```

Removing the semicolon must produce `COMPILE ERROR`.

## Start one component

```powershell
.\deploy\windows\deploy.ps1 -Mode web
.\deploy\windows\deploy.ps1 -Mode database
.\deploy\windows\deploy.ps1 -Mode api
.\deploy\windows\deploy.ps1 -Mode judge
```

For a split deployment, edit `.env.windows` before starting:

- `API_UPSTREAM` is the Core API address used by Nginx.
- `DATABASE_URL` is the database used by the Core API.
- `JUDGE_API_URL` is the Judge address used by the Core API.
- `JUDGE_API_TOKEN` must match the Judge host.
- Change the relevant `*_BIND_ADDRESS` to `0.0.0.0` only when another machine
  must connect, then restrict that port in Windows Firewall.

Rebuild the Web image after changing `NEXT_PUBLIC_API_BASE_URL`, because it is a
browser build-time value.

## Data and shutdown

Normal shutdown preserves named volumes:

```powershell
.\deploy\windows\stop.ps1
```

Do not add `-v` to `docker compose down` unless you intentionally want to erase
PostgreSQL and Judge caches.

The main volumes are:

```text
algoquest-postgres-data
algoquest-judge-work
algoquest-judge-cache
```

## Troubleshooting

- `docker info` fails: start Docker Desktop and wait for the engine.
- Runner fails immediately: confirm Docker Desktop is using Linux containers.
- Judge smoke test fails: read the result printed by the script and run
  `docker compose --env-file .env.windows logs --tail 100 judge`.
- Core API smoke test fails: inspect both `api` and `judge` logs; this check
  covers the complete create → poll → AC → progress path.
- API health is degraded: inspect `api` logs, then `db` and `judge` health.
- Web loads but submissions are offline: confirm `/api/v1/sessions` reaches the
  API and that API/Judge `JUDGE_API_TOKEN` values match.
