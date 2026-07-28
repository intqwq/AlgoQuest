"use client";

import { useMemo, useState } from "react";
import { apiUrl, authenticatedFetch } from "@/lib/api-client";

type Verdict = "AC" | "WA" | "CE" | "RE" | "TLE" | "MLE" | "OLE" | "JE";
type JudgeState =
  | "idle"
  | "queued"
  | "compiling"
  | "running"
  | "accepted"
  | "failed"
  | "offline";

type CaseResult = {
  id: string;
  input: string;
  expected: string;
  verdict: "WAIT" | "RUN" | Verdict;
  time?: string;
  memory?: string;
};

type JudgeResponse = {
  verdict: Verdict;
  compilerOutput?: string;
  cases: Array<{
    id: string;
    verdict: Verdict;
    timeMs: number;
    memoryKb: number;
    expected?: string;
    received?: string;
    stderr?: string;
  }>;
};

type Submission = {
  id: string;
  status: "QUEUED" | "COMPILING" | "RUNNING" | "DONE" | "ERROR";
  queuePosition: number;
  pollAfterMs?: number;
  verdict?: Verdict;
  compilerOutput?: string;
  error?: string;
  cases: JudgeResponse["cases"];
};

class JudgeRequestError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const starterCode = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int a, b;
    cin >> a >> b;

    // TODO: transmit the combined energy

    return 0;
}`;

const acceptedLine = `    cout << a + b << '\\n';`;

const tests = [
  { id: "01", input: "7 35", expected: "42" },
  { id: "02", input: "-19 8", expected: "-11" },
  { id: "03", input: "1000000000 1000000000", expected: "2000000000" },
  { id: "04", input: "-1000000000 1000000000", expected: "0" },
];

const judgeApi = apiUrl("/judge/submissions");

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function requestJudge(
  source: string,
  mode: "sample" | "submit",
  onUpdate: (submission: Submission) => void,
): Promise<JudgeResponse> {
  const response = await authenticatedFetch(judgeApi, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      questId: "signal-fire",
      language: "cpp14",
      source,
      mode,
    }),
  });
  const body = (await response.json()) as {
    error?: string;
    retryAfterMs?: number;
    submission?: Submission;
  };
  if (!response.ok && !body.submission) {
    const messages: Record<string, string> = {
      QUEUE_FULL: "The judge queue is full. Wait a moment and retry.",
      SUBMISSION_COOLDOWN: `Submission cooldown: ${Math.ceil((body.retryAfterMs ?? 1000) / 1000)}s remaining.`,
      ACTIVE_SUBMISSION: "This player already has a submission in flight.",
    };
    throw new JudgeRequestError(
      body.error ?? "JUDGE_FAILURE",
      messages[body.error ?? ""] ?? `Judge returned HTTP ${response.status}.`,
    );
  }

  let submission = body.submission;
  if (!submission) {
    throw new JudgeRequestError("INVALID_RESPONSE", "Judge returned no job.");
  }
  onUpdate(submission);

  while (!["DONE", "ERROR"].includes(submission.status)) {
    const jitter = Math.floor(Math.random() * 120);
    await delay((submission.pollAfterMs ?? 1000) + jitter);
    const poll = await authenticatedFetch(
      `${judgeApi.replace(/\/$/, "")}/${submission.id}`,
      {
      headers: { accept: "application/json" },
      },
    );
    if (!poll.ok) {
      throw new JudgeRequestError(
        "POLL_FAILED",
        `Judge status returned HTTP ${poll.status}.`,
      );
    }
    const polled = (await poll.json()) as { submission: Submission };
    submission = polled.submission;
    onUpdate(submission);
  }

  if (submission.status === "ERROR" || !submission.verdict) {
    throw new JudgeRequestError(
      submission.error ?? "JUDGE_FAILURE",
      "The judge worker failed while processing this submission.",
    );
  }
  return {
    verdict: submission.verdict,
    compilerOutput: submission.compilerOutput,
    cases: submission.cases,
  };
}

export function MissionTerminal({
  onExit,
  onComplete,
}: {
  onExit: () => void;
  onComplete: () => void;
}) {
  const [code, setCode] = useState(starterCode);
  const [judgeState, setJudgeState] = useState<JudgeState>("idle");
  const [results, setResults] = useState<CaseResult[]>(
    tests.map((test) => ({ ...test, verdict: "WAIT" })),
  );
  const [consoleText, setConsoleText] = useState(
    "$ judge --awaiting-source\n> Edit main.cpp, then run the sample.",
  );
  const [hintOpen, setHintOpen] = useState(false);

  const lineNumbers = useMemo(
    () => code.split("\n").map((_, index) => index + 1),
    [code],
  );

  const formatFailure = (response: JudgeResponse) => {
    if (response.verdict === "CE") {
      return `$ compile --std=gnu++14\n[ COMPILE ERROR ]\n${response.compilerOutput ?? "Compiler produced no diagnostics."}`;
    }
    const failed = response.cases.find((item) => item.verdict !== "AC");
    if (!failed) return `$ verdict\n[ ${response.verdict} ]`;
    const details =
      response.verdict === "WA"
        ? `\nEXPECTED ${failed.expected ?? "<empty>"}\nRECEIVED ${failed.received ?? "<empty>"}`
        : failed.stderr
          ? `\n${failed.stderr}`
          : "";
    return `$ verdict\n[ ${response.verdict} ] case #${failed.id}${details}\nPatch the source and retry.`;
  };

  const applySubmissionUpdate = (submission: Submission) => {
    if (submission.status === "QUEUED") {
      setJudgeState("queued");
      setConsoleText(
        `$ submit main.cpp\n[ QUEUED ] position #${submission.queuePosition}\n> The request is safely parked; no browser connection is being held open.\n> Next status check in ${((submission.pollAfterMs ?? 1000) / 1000).toFixed(1)}s.`,
      );
      return;
    }
    if (submission.status === "COMPILING") {
      setJudgeState("compiling");
      setConsoleText(
        "$ compile --std=gnu++14\n[ COMPILING ] worker acquired\n> One disposable container started for this submission.",
      );
      return;
    }
    if (submission.status === "RUNNING") {
      setJudgeState("running");
      setResults(
        tests.map((test, index) => {
          const result = submission.cases.find((item) => item.id === test.id);
          if (result) {
            return {
              ...test,
              verdict: result.verdict,
              time: `${result.timeMs} ms`,
              memory: `${(result.memoryKb / 1024).toFixed(2)} MB`,
            };
          }
          return {
            ...test,
            verdict:
              index === submission.cases.length ? ("RUN" as const) : ("WAIT" as const),
          };
        }),
      );
      setConsoleText(
        `$ judge --hidden-cases\n[ RUNNING ] ${submission.cases.length} / ${tests.length} complete\n> Cases execute as isolated child processes inside the same submission container.\n> First failure stops the run early.`,
      );
    }
  };

  const runSample = async () => {
    if (["queued", "compiling", "running"].includes(judgeState)) return;
    setJudgeState("queued");
    setConsoleText("$ run --sample\n> Creating an isolated judge job...");
    try {
      const response = await requestJudge(code, "sample", applySubmissionUpdate);
      const sample = response.cases[0];
      if (response.verdict === "AC" || sample?.verdict === "AC") {
        setConsoleText(
          `$ run --sample\nINPUT    7 35\nEXPECTED 42\nRECEIVED 42\nTIME     ${sample.timeMs} ms\nMEMORY   ${(sample.memoryKb / 1024).toFixed(2)} MB\n[ SAMPLE PASSED ]`,
        );
        setJudgeState("idle");
      } else {
        setConsoleText(formatFailure(response));
        setJudgeState("failed");
      }
    } catch (error) {
      const requestError =
        error instanceof JudgeRequestError ? error : undefined;
      setJudgeState(
        requestError?.code === "QUEUE_FULL" ||
          requestError?.code === "SUBMISSION_COOLDOWN"
          ? "failed"
          : "offline",
      );
      setConsoleText(
        requestError
          ? `$ judge --request\n[ ${requestError.code} ]\n${requestError.message}`
          : "$ judge --connect\n[ JUDGE OFFLINE ]\nThe isolated runner is not reachable. Start the Judge service or configure NEXT_PUBLIC_JUDGE_API_URL.",
      );
    }
  };

  const submit = async () => {
    if (["queued", "compiling", "running"].includes(judgeState)) return;
    setJudgeState("queued");
    setResults(tests.map((test) => ({ ...test, verdict: "WAIT" })));
    setConsoleText(
      "$ submit main.cpp\n> Reserving a bounded queue slot...",
    );

    try {
      const response = await requestJudge(code, "submit", applySubmissionUpdate);
      setResults(
        tests.map((test) => {
          const result = response.cases.find((item) => item.id === test.id);
          return result
            ? {
                ...test,
                verdict: result.verdict,
                time: `${result.timeMs} ms`,
                memory: `${(result.memoryKb / 1024).toFixed(2)} MB`,
              }
            : { ...test, verdict: "WAIT" };
        }),
      );

      if (response.verdict === "AC") {
        const maxTime = Math.max(...response.cases.map((item) => item.timeMs));
        const maxMemory = Math.max(
          ...response.cases.map((item) => item.memoryKb),
        );
        setJudgeState("accepted");
        setConsoleText(
          `$ verdict\n[ ACCEPTED ] ${response.cases.length} / ${response.cases.length} cases\nTIME   ${maxTime} ms max\nMEMORY ${(maxMemory / 1024).toFixed(2)} MB max\nSCORE  100 / 100\nREWARD +120 XP`,
        );
        onComplete();
      } else {
        setJudgeState("failed");
        setConsoleText(formatFailure(response));
      }
    } catch (error) {
      const requestError =
        error instanceof JudgeRequestError ? error : undefined;
      setJudgeState(
        requestError?.code === "QUEUE_FULL" ||
          requestError?.code === "SUBMISSION_COOLDOWN"
          ? "failed"
          : "offline",
      );
      setConsoleText(
        requestError
          ? `$ judge --request\n[ ${requestError.code} ]\n${requestError.message}`
          : "$ judge --connect\n[ JUDGE OFFLINE ]\nThe isolated runner is not reachable. Start the Judge service or configure NEXT_PUBLIC_JUDGE_API_URL.",
      );
    }
  };

  const insertHint = () => {
    if (code.includes("cout << a + b")) return;
    setCode((current) =>
      current.replace(
        "    // TODO: transmit the combined energy",
        `${acceptedLine}\n\n    // The relay is listening.`,
      ),
    );
    setConsoleText("$ codex --apply-hint\n> Output instruction inserted.");
  };

  return (
    <section className="mission-terminal">
      <div className="mission-toolbar">
        <button className="back-button" onClick={onExit}>
          &lt; WORLD_MAP
        </button>
        <div className="mission-id">
          <span>QUEST_01</span>
          <strong>SIGNAL FIRE</strong>
        </div>
        <div className="mission-flags">
          <span>C++14</span>
          <span>TIME 1.0s</span>
          <span>MEM 64MB</span>
        </div>
      </div>

      <div className="terminal-columns">
        <article className="problem-pane">
          <div className="pane-tabs">
            <button className="is-active">PROBLEM</button>
            <button disabled>EDITORIAL</button>
          </div>
          <div className="pane-scroll">
            <p className="eyebrow">CH.01 // FIRST TRANSMISSION</p>
            <h1>Signal Fire</h1>
            <div className="problem-meta">
              <span>DIFFICULTY ◆◇◇◇◇</span>
              <span>REWARD +120 XP</span>
            </div>
            <p>
              The outpost relay has slept for 4,096 cycles. Two energy cells
              remain, carrying <code>a</code> and <code>b</code> units.
            </p>
            <p>
              Read both values and output their sum to ignite the signal fire.
            </p>

            <h2>INPUT</h2>
            <p>
              One line containing two integers <code>a</code> and <code>b</code>.
            </p>
            <pre className="constraint-box">-10⁹ ≤ a, b ≤ 10⁹</pre>

            <h2>OUTPUT</h2>
            <p>Print one integer: the combined energy.</p>

            <h2>SAMPLE</h2>
            <div className="sample-grid">
              <div>
                <span>INPUT</span>
                <pre>7 35</pre>
              </div>
              <div>
                <span>OUTPUT</span>
                <pre>42</pre>
              </div>
            </div>

            <button
              className="hint-toggle"
              onClick={() => setHintOpen((open) => !open)}
            >
              {hintOpen ? "[-] HIDE TRANSMISSION" : "[+] REQUEST TRANSMISSION"}
            </button>
            {hintOpen && (
              <div className="hint-card">
                <strong>CODEX WHISPER</strong>
                <p>
                  The relay listens through <code>cout</code>. Send it the value
                  of <code>a + b</code>.
                </p>
                <button onClick={insertHint}>[ INSERT HINT INTO EDITOR ]</button>
              </div>
            )}
          </div>
        </article>

        <section className="editor-pane" aria-label="Code editor">
          <div className="editor-header">
            <span>● main.cpp</span>
            <span>GNU C++14 // UTF-8</span>
          </div>
          <div className="editor-wrap">
            <div className="line-numbers" aria-hidden="true">
              {lineNumbers.map((line) => (
                <span key={line}>{String(line).padStart(2, "0")}</span>
              ))}
            </div>
            <textarea
              aria-label="C++ solution"
              spellCheck={false}
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (judgeState !== "idle") {
                  setJudgeState("idle");
                  setResults(
                    tests.map((test) => ({ ...test, verdict: "WAIT" })),
                  );
                }
              }}
            />
          </div>
          <div className="console-pane" aria-live="polite">
            <div className="console-heading">
              <span>OUTPUT.log</span>
              <button onClick={() => setConsoleText("$ console --cleared")}>
                CLEAR
              </button>
            </div>
            <pre>{consoleText}</pre>
          </div>
        </section>

        <aside className="judge-pane">
          <div className="judge-header">
            <span>JUDGE_NODE</span>
            <span className={`judge-light judge-light--${judgeState}`} />
          </div>
          <div className="judge-summary">
            <span>STATUS</span>
            <strong>
              {judgeState === "idle" && "READY"}
              {judgeState === "queued" && "QUEUED"}
              {judgeState === "compiling" && "COMPILING"}
              {judgeState === "running" && "RUNNING"}
              {judgeState === "accepted" && "ACCEPTED"}
              {judgeState === "failed" && "FAILED"}
              {judgeState === "offline" && "OFFLINE"}
            </strong>
          </div>

          <div className="case-list">
            {results.map((result) => (
              <div className="case-row" key={result.id}>
                <span>CASE #{result.id}</span>
                <strong className={`verdict verdict--${result.verdict.toLowerCase()}`}>
                  {result.verdict}
                </strong>
                <small>{result.time ?? "--"}</small>
                <small>{result.memory ?? "--"}</small>
              </div>
            ))}
          </div>

          <div className="judge-note">
            <span>ISOLATED JUDGE</span>
            <p>
              One submission uses one disposable container. Hidden cases run
              as reset, resource-limited child processes with early exit.
            </p>
          </div>

          {judgeState === "accepted" && (
            <div className="reward-card">
              <span>QUEST CLEARED</span>
              <strong>+120 XP</strong>
              <p>Forked Path is now available.</p>
              <button onClick={onExit}>[ RETURN TO MAP ]</button>
            </div>
          )}
        </aside>
      </div>

      <div className="mission-actions">
        <span>autosave: device-local</span>
        <div>
          <button className="sample-button" onClick={runSample}>
            &gt; RUN SAMPLE
          </button>
          <button
            className="submit-button"
            onClick={submit}
            disabled={["queued", "compiling", "running"].includes(judgeState)}
          >
            {judgeState === "queued" && "[ QUEUED... ]"}
            {judgeState === "compiling" && "[ COMPILING... ]"}
            {judgeState === "running" && "[ JUDGING... ]"}
            {!["queued", "compiling", "running"].includes(judgeState) &&
              "[ SUBMIT SOLUTION ]"}
          </button>
        </div>
      </div>
    </section>
  );
}
