#!/usr/bin/env python3

import json
import math
import os
import resource
import signal
import subprocess
import sys
import time
from pathlib import Path


SUBMISSION_ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/submission")
MANIFEST_PATH = SUBMISSION_ROOT / "manifest.json"
SOURCE_PATH = SUBMISSION_ROOT / "main.cpp"
BINARY_PATH = SUBMISSION_ROOT / "main"
RUNNER_UID = 10001
RUNNER_GID = 10001
MAX_OUTPUT_BYTES = 64 * 1024
WORK_ROOT = Path("/work")


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), flush=True)


def clamp_text(path, limit=MAX_OUTPUT_BYTES):
    try:
        return path.read_bytes()[:limit].decode("utf-8", errors="replace")
    except FileNotFoundError:
        return ""


def kill_runner_processes():
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            status = (entry / "status").read_text(errors="ignore")
            uid_line = next(line for line in status.splitlines() if line.startswith("Uid:"))
            real_uid = int(uid_line.split()[1])
            if real_uid == RUNNER_UID:
                os.kill(int(entry.name), signal.SIGKILL)
        except (FileNotFoundError, ProcessLookupError, PermissionError, StopIteration, ValueError):
            continue


def child_limits(memory_bytes=None, time_limit_ms=None, output_limit=False):
    def apply():
        os.setsid()
        os.setgroups([])
        os.setgid(RUNNER_GID)
        os.setuid(RUNNER_UID)
        resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
        resource.setrlimit(resource.RLIMIT_NPROC, (32, 32))
        if memory_bytes is not None:
            resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
        if time_limit_ms is not None:
            cpu_seconds = max(1, math.ceil(time_limit_ms / 1000) + 1)
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
        if output_limit:
            resource.setrlimit(
                resource.RLIMIT_FSIZE,
                (MAX_OUTPUT_BYTES, MAX_OUTPUT_BYTES),
            )

    return apply


def compile_source(manifest):
    emit({"type": "phase", "phase": "COMPILING", "cacheHit": bool(manifest["cacheHit"])})
    if manifest["cacheHit"] and BINARY_PATH.exists():
        os.chown(BINARY_PATH, 0, 0)
        os.chmod(BINARY_PATH, 0o555)
        os.chmod(SUBMISSION_ROOT, 0o755)
        return None

    compiler_output = WORK_ROOT / "compiler.stderr"
    command = [
        "g++",
        "-std=gnu++14",
        "-O2",
        "-pipe",
        "-Wall",
        "-Wextra",
        "-o",
        str(BINARY_PATH),
        str(SOURCE_PATH),
    ]
    with compiler_output.open("wb") as stderr:
        process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=stderr,
            cwd=SUBMISSION_ROOT,
            preexec_fn=child_limits(),
        )
        try:
            process.wait(timeout=manifest["compileLimitMs"] / 1000)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
            kill_runner_processes()
            return {
                "verdict": "CE",
                "compilerOutput": "Compilation exceeded the 15 second limit.",
                "cases": [],
                "compiled": False,
            }

    kill_runner_processes()
    if process.returncode != 0 or not BINARY_PATH.exists():
        return {
            "verdict": "CE",
            "compilerOutput": clamp_text(compiler_output),
            "cases": [],
            "compiled": False,
        }

    os.chown(BINARY_PATH, 0, 0)
    os.chmod(BINARY_PATH, 0o555)
    os.chmod(SUBMISSION_ROOT, 0o755)
    return None


def read_metrics(path, fallback_ms):
    try:
        elapsed_seconds, memory_kb = path.read_text().strip().split()
        return max(1, math.ceil(float(elapsed_seconds) * 1000)), max(
            0, math.ceil(float(memory_kb))
        )
    except (FileNotFoundError, ValueError):
        return max(1, math.ceil(fallback_ms)), 0


def run_case(test, manifest):
    case_root = WORK_ROOT / f"case-{test['id']}"
    case_root.mkdir(mode=0o770)
    os.chown(case_root, RUNNER_UID, RUNNER_GID)
    stdout_path = case_root / "stdout"
    stderr_path = case_root / "stderr"
    metrics_path = case_root / "metrics"
    command = [
        "/usr/bin/time",
        "-f",
        "%e %M",
        "-o",
        str(metrics_path),
        str(BINARY_PATH),
    ]
    memory_bytes = int(manifest["memoryLimitMb"]) * 1024 * 1024
    started = time.monotonic()
    timed_out = False

    with stdout_path.open("wb") as stdout, stderr_path.open("wb") as stderr:
        process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=stdout,
            stderr=stderr,
            cwd=case_root,
            preexec_fn=child_limits(
                memory_bytes=memory_bytes,
                time_limit_ms=manifest["timeLimitMs"],
                output_limit=True,
            ),
        )
        try:
            process.communicate(
                input=test["input"].encode(),
                timeout=manifest["timeLimitMs"] / 1000,
            )
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()

    elapsed_ms = (time.monotonic() - started) * 1000
    kill_runner_processes()
    time_ms, memory_kb = read_metrics(metrics_path, elapsed_ms)
    stdout = clamp_text(stdout_path)
    stderr = clamp_text(stderr_path, 4096)
    output_exceeded = (
        stdout_path.stat().st_size >= MAX_OUTPUT_BYTES
        or stderr_path.stat().st_size >= MAX_OUTPUT_BYTES
        or process.returncode in (-signal.SIGXFSZ, 128 + signal.SIGXFSZ)
    )

    verdict = "AC"
    if timed_out:
        verdict = "TLE"
    elif output_exceeded:
        verdict = "OLE"
    elif (
        memory_kb >= int(manifest["memoryLimitMb"]) * 1024
        or "std::bad_alloc" in stderr
        or "Cannot allocate memory" in stderr
    ):
        verdict = "MLE"
    elif process.returncode != 0:
        verdict = "RE"
    elif stdout.rstrip() != test["expected"].rstrip():
        verdict = "WA"

    result = {
        "id": test["id"],
        "verdict": verdict,
        "timeMs": time_ms,
        "memoryKb": memory_kb,
    }
    if verdict == "WA":
        result["expected"] = test["expected"].rstrip()
        result["received"] = stdout.rstrip()
    if verdict == "RE":
        result["stderr"] = stderr
    return result


def main():
    WORK_ROOT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST_PATH.read_text())
    compile_failure = compile_source(manifest)
    if compile_failure is not None:
        emit({"type": "result", **compile_failure})
        return

    emit(
        {
            "type": "phase",
            "phase": "RUNNING",
            "totalCases": len(manifest["tests"]),
        }
    )
    cases = []
    verdict = "AC"
    for test in manifest["tests"]:
        result = run_case(test, manifest)
        cases.append(result)
        emit({"type": "case", "case": result})
        if result["verdict"] != "AC":
            verdict = result["verdict"]
            break

    emit(
        {
            "type": "result",
            "verdict": verdict,
            "cases": cases,
            "compiled": True,
            "cacheHit": bool(manifest["cacheHit"]),
            "containerStarts": 1,
        }
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit(
            {
                "type": "result",
                "verdict": "JE",
                "error": f"{type(error).__name__}: {error}",
                "cases": [],
                "compiled": False,
            }
        )
