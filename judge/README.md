# AlgoQuest queued, isolated judge

The production path is asynchronous:

```text
POST submission -> bounded queue -> worker -> one disposable container
                                      ├─ compile once (or cache hit)
                                      ├─ case 01 child process
                                      ├─ case 02 child process
                                      └─ stop at first failure
```

`POST /v1/submissions` returns `202 Accepted` immediately. Poll the returned
`GET /v1/submissions/:id` URL until its status becomes `DONE` or `ERROR`.
Queued responses include a server-selected `pollAfterMs`, so a large queue does
not turn into a polling storm.

Build the multi-architecture C++14 runner image first:

```bash
docker build -f judge/Dockerfile.runner -t algoquest-runner:cpp14 judge
docker compose -f docker-compose.judge.yml up -d --build
curl http://127.0.0.1:8788/health
```

The compose defaults are deliberately conservative for a Raspberry Pi 5:

- 2 active submissions
- 1,000 waiting submissions
- 1 active/waiting submission per client IP
- 4 second submission cooldown
- 10 minute result retention
- 256-entry compiled-binary cache
- job and cache data on `/var/lib/algoquest`, suitable for NVMe

Override `JUDGE_WORK_ROOT` and `JUDGE_CACHE_ROOT` if the NVMe is mounted
elsewhere. These paths are mounted into the Judge service at the exact same host
paths because the service asks the host Docker daemon to create runner
containers.

Run queue tests plus the real Docker regression suite (AC, CE, WA and TLE):

```bash
JUDGE_DOCKER_TEST=1 npm --prefix judge test
```

Measure the actual Raspberry Pi instead of trusting estimates:

```bash
JUDGE_STRESS_SUBMISSIONS=100 \
JUDGE_STRESS_CLIENTS=20 \
npm --prefix judge run stress
```

Repeat with 500 and 1,000 submissions after checking temperature, queue depth,
load average, and free memory. The stress client connects directly to the local
Judge API and uses unique synthetic client IPs; never expose that direct port
publicly.

Nginx should proxy `/api/judge/` to `http://127.0.0.1:8788/`, preserving the
path after the prefix. The browser endpoint is then
`https://game.intqwq.com/api/judge/v1/submissions`.

The service accepts source code only. Test input and expected output remain
root-readable only inside the runner. Each submission gets one fresh container
with no network, a read-only root filesystem, a minimal capability set,
PID/CPU/memory/file-descriptor limits, output caps, and a host-enforced
wall-clock timeout. Individual test cases run as freshly-created, resource-
limited child processes; surviving processes are killed before the next case.

The current queue is intentionally single-node and in-memory. It protects one
Pi from a burst of 1,000 submissions, but jobs are not durable across a service
restart and multiple Judge hosts do not share work. Replace the queue store with
Redis before horizontally scaling workers for a synchronous 1,000-player
contest.
