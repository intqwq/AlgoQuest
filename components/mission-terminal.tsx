"use client";

import { useMemo, useState } from "react";
import { apiUrl, authenticatedFetch } from "@/lib/api-client";
import { Quest } from "@/lib/quests";

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
  verdict: "WAIT" | "RUN" | Verdict;
  time?: string;
  memory?: string;
};

type JudgeResponse = {
  verdict: Verdict;
  compilerOutput?: string;
  error?: string;
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

const judgeApi = apiUrl("/judge/submissions");
const transientPollStatuses = new Set([429, 502, 503, 504]);
const maxConsecutivePollFailures = 10;

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function responseBody(response: Response) {
  return response.json().catch(() => ({})) as Promise<{
    error?: string;
    retryAfterMs?: number;
    submission?: Submission;
  }>;
}

async function requestJudge(
  questId: string,
  source: string,
  mode: "sample" | "submit",
  onUpdate: (submission: Submission) => void,
  onConnectionIssue: (attempt: number, retryAfterMs: number) => void,
): Promise<JudgeResponse> {
  const response = await authenticatedFetch(judgeApi, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      questId,
      language: "cpp14",
      source,
      mode,
    }),
  });
  const body = await responseBody(response);
  if (!response.ok && !body.submission) {
    const messages: Record<string, string> = {
      QUEUE_FULL: "The judge queue is full. Wait a moment and retry.",
      SUBMISSION_COOLDOWN: `Submission cooldown: ${Math.ceil((body.retryAfterMs ?? 1000) / 1000)}s remaining.`,
      ACTIVE_SUBMISSION: "This player already has a submission in flight.",
      QUEST_LOCKED: "Clear the prerequisite mission before entering this quest.",
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

  let consecutiveFailures = 0;
  while (!["DONE", "ERROR"].includes(submission.status)) {
    const jitter = Math.floor(Math.random() * 120);
    await delay((submission.pollAfterMs ?? 1000) + jitter);

    try {
      const poll = await authenticatedFetch(
        `${judgeApi.replace(/\/$/, "")}/${submission.id}`,
        { headers: { accept: "application/json" } },
      );
      const polled = await responseBody(poll);
      if (!poll.ok || !polled.submission) {
        if (!transientPollStatuses.has(poll.status)) {
          throw new JudgeRequestError(
            polled.error ?? "POLL_FAILED",
            `Judge status returned HTTP ${poll.status}.`,
          );
        }
        throw new Error(`transient:${poll.status}`);
      }

      submission = polled.submission;
      consecutiveFailures = 0;
      onUpdate(submission);
    } catch (error) {
      if (error instanceof JudgeRequestError) throw error;
      consecutiveFailures += 1;
      if (consecutiveFailures > maxConsecutivePollFailures) {
        throw new JudgeRequestError(
          "POLL_TIMEOUT",
          "Judge status could not be reached after repeated retries. The job remains recoverable on the server.",
        );
      }
      const retryAfterMs = Math.min(
        5000,
        400 * 2 ** Math.min(consecutiveFailures - 1, 4),
      );
      onConnectionIssue(consecutiveFailures, retryAfterMs);
      await delay(retryAfterMs);
    }
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
    error: submission.error,
    cases: submission.cases,
  };
}

export function MissionTerminal({
  quest,
  nextQuestTitle,
  onExit,
  onComplete,
}: {
  quest: Quest;
  nextQuestTitle?: string;
  onExit: () => void;
  onComplete: (questId: string, score: number) => void;
}) {
  const problem = quest.problem;
  if (!problem) {
    throw new Error(`Quest ${quest.id} has no playable problem definition.`);
  }

  const caseIds = useMemo(
    () =>
      Array.from({ length: problem.testCaseCount }, (_, index) =>
        String(index + 1).padStart(2, "0"),
      ),
    [problem.testCaseCount],
  );
  const emptyResults = () =>
    caseIds.map((id) => ({ id, verdict: "WAIT" as const }));

  const [code, setCode] = useState(problem.starterCode);
  const [judgeState, setJudgeState] = useState<JudgeState>("idle");
  const [results, setResults] = useState<CaseResult[]>(emptyResults);
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
    if (response.verdict === "JE") {
      return `$ verdict\n[ JUDGE ERROR ]\n${response.error ?? "The runner exited without diagnostics."}\n> Check the Judge service logs and rerun the deployment smoke test.`;
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
        caseIds.map((id, index) => {
          const result = submission.cases.find((item) => item.id === id);
          if (result) {
            return {
              id,
              verdict: result.verdict,
              time: `${result.timeMs} ms`,
              memory: `${(result.memoryKb / 1024).toFixed(2)} MB`,
            };
          }
          return {
            id,
            verdict:
              index === submission.cases.length
                ? ("RUN" as const)
                : ("WAIT" as const),
          };
        }),
      );
      setConsoleText(
        `$ judge --hidden-cases\n[ RUNNING ] ${submission.cases.length} / ${caseIds.length} complete\n> Cases execute as isolated child processes inside the same submission container.\n> First failure stops the run early.`,
      );
    }
  };

  const showConnectionRetry = (attempt: number, retryAfterMs: number) => {
    setConsoleText(
      `$ judge --status\n[ LINK UNSTABLE ] retry ${attempt}/${maxConsecutivePollFailures}\n> Submission is still active. Reconnecting in ${(retryAfterMs / 1000).toFixed(1)}s; no resubmission is needed.`,
    );
  };

  const handleRequestError = (error: unknown) => {
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
        : "$ judge --connect\n[ JUDGE OFFLINE ]\nThe isolated runner is not reachable. Start the Judge service and rerun its smoke test.",
    );
  };

  const runSample = async () => {
    if (["queued", "compiling", "running"].includes(judgeState)) return;
    setJudgeState("queued");
    setConsoleText("$ run --sample\n> Creating an isolated judge job...");
    try {
      const response = await requestJudge(
        quest.id,
        code,
        "sample",
        applySubmissionUpdate,
        showConnectionRetry,
      );
      const sample = response.cases[0];
      if (sample?.verdict === "AC") {
        setResults((current) =>
          current.map((result, index) =>
            index === 0
              ? {
                  ...result,
                  verdict: "AC",
                  time: `${sample.timeMs} ms`,
                  memory: `${(sample.memoryKb / 1024).toFixed(2)} MB`,
                }
              : result,
          ),
        );
        setConsoleText(
          `$ run --sample\nINPUT    ${problem.sampleInput}\nEXPECTED ${problem.sampleOutput}\nRECEIVED ${problem.sampleOutput}\nTIME     ${sample.timeMs} ms\nMEMORY   ${(sample.memoryKb / 1024).toFixed(2)} MB\n[ SAMPLE PASSED ]`,
        );
        setJudgeState("idle");
      } else {
        if (sample) {
          setResults((current) =>
            current.map((result, index) =>
              index === 0
                ? {
                    ...result,
                    verdict: sample.verdict,
                    time: `${sample.timeMs} ms`,
                    memory: `${(sample.memoryKb / 1024).toFixed(2)} MB`,
                  }
                : result,
            ),
          );
        }
        setConsoleText(formatFailure(response));
        setJudgeState("failed");
      }
    } catch (error) {
      handleRequestError(error);
    }
  };

  const submit = async () => {
    if (["queued", "compiling", "running"].includes(judgeState)) return;
    setJudgeState("queued");
    setResults(emptyResults());
    setConsoleText("$ submit main.cpp\n> Reserving a bounded queue slot...");

    try {
      const response = await requestJudge(
        quest.id,
        code,
        "submit",
        applySubmissionUpdate,
        showConnectionRetry,
      );
      setResults(
        caseIds.map((id) => {
          const result = response.cases.find((item) => item.id === id);
          return result
            ? {
                id,
                verdict: result.verdict,
                time: `${result.timeMs} ms`,
                memory: `${(result.memoryKb / 1024).toFixed(2)} MB`,
              }
            : { id, verdict: "WAIT" };
        }),
      );

      if (response.verdict === "AC") {
        const maxTime = Math.max(...response.cases.map((item) => item.timeMs));
        const maxMemory = Math.max(
          ...response.cases.map((item) => item.memoryKb),
        );
        setJudgeState("accepted");
        setConsoleText(
          `$ verdict\n[ ACCEPTED ] ${response.cases.length} / ${response.cases.length} cases\nTIME   ${maxTime} ms max\nMEMORY ${(maxMemory / 1024).toFixed(2)} MB max\nSCORE  100 / 100\nREWARD +${quest.xp} XP`,
        );
        onComplete(quest.id, 100);
      } else {
        setJudgeState("failed");
        setConsoleText(formatFailure(response));
      }
    } catch (error) {
      handleRequestError(error);
    }
  };

  const insertHint = () => {
    if (!code.includes(problem.hintMarker)) return;
    setCode((current) =>
      current.replace(
        problem.hintMarker,
        `${problem.hintCode}\n\n    // Codex transmission applied.`,
      ),
    );
    setConsoleText("$ codex --apply-hint\n> Guidance inserted into main.cpp.");
  };

  return (
    <section className="mission-terminal">
      <div className="mission-toolbar">
        <button className="back-button" onClick={onExit}>
          &lt; WORLD_MAP
        </button>
        <div className="mission-id">
          <span>QUEST_{quest.index}</span>
          <strong>{quest.title.toUpperCase()}</strong>
        </div>
        <div className="mission-flags">
          <span>C++14</span>
          <span>TIME {problem.timeLimitSeconds.toFixed(1)}s</span>
          <span>MEM {problem.memoryLimitMb}MB</span>
        </div>
      </div>

      <div className="terminal-columns">
        <article className="problem-pane">
          <div className="pane-tabs">
            <button className="is-active">PROBLEM</button>
            <button disabled>EDITORIAL</button>
          </div>
          <div className="pane-scroll">
            <p className="eyebrow">{`${quest.chapter} // ACTIVE MISSION`}</p>
            <h1>{quest.title}</h1>
            <div className="problem-meta">
              <span>
                DIFFICULTY {"◆".repeat(quest.difficulty)}
                {"◇".repeat(5 - quest.difficulty)}
              </span>
              <span>REWARD +{quest.xp} XP</span>
            </div>
            {problem.story.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}

            <h2>INPUT</h2>
            <p>{problem.input}</p>
            <pre className="constraint-box">{problem.constraints}</pre>

            <h2>OUTPUT</h2>
            <p>{problem.output}</p>

            <h2>SAMPLE</h2>
            <div className="sample-grid">
              <div>
                <span>INPUT</span>
                <pre>{problem.sampleInput}</pre>
              </div>
              <div>
                <span>OUTPUT</span>
                <pre>{problem.sampleOutput}</pre>
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
                <p>{problem.hint}</p>
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
                  setResults(emptyResults());
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
                <strong
                  className={`verdict verdict--${result.verdict.toLowerCase()}`}
                >
                  {result.verdict}
                </strong>
                <small>{result.time ?? "--"}</small>
                <small>{result.memory ?? "--"}</small>
              </div>
            ))}
          </div>

          <div className="judge-note">
            <span>RECOVERABLE STATUS LINK</span>
            <p>
              One submission uses one disposable container. Temporary gateway
              failures retry the same job instead of losing its verdict.
            </p>
          </div>

          {judgeState === "accepted" && (
            <div className="reward-card">
              <span>QUEST CLEARED</span>
              <strong>+{quest.xp} XP</strong>
              <p>
                {nextQuestTitle
                  ? `${nextQuestTitle} is now available.`
                  : "Current campaign frontier reached."}
              </p>
              <button onClick={onExit}>[ RETURN TO MAP ]</button>
            </div>
          )}
        </aside>
      </div>

      <div className="mission-actions">
        <span>autosave: device + account progress</span>
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
