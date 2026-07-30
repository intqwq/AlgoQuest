"use client";

import Editor, { loader, OnMount } from "@monaco-editor/react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  apiUrl,
  authenticatedFetch,
  SaveSubmission,
} from "@/lib/api-client";
import type { Locale } from "@/lib/i18n";
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
  submissionId: string;
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

const missionMessages = {
  en: {
    worldMap: "WORLD_MAP",
    activeMission: "ACTIVE MISSION",
    problem: "PROBLEM",
    guide: "MISSION GUIDE",
    input: "INPUT",
    output: "OUTPUT",
    sample: "SAMPLE",
    hintShow: "[+] REQUEST TRANSMISSION",
    hintHide: "[-] HIDE TRANSMISSION",
    insertHint: "INSERT HINT INTO EDITOR",
    runSample: "RUN SAMPLE",
    submit: "SUBMIT SOLUTION",
    judging: "JUDGING...",
    compiling: "COMPILING...",
    queued: "QUEUED...",
    congratulations: "CONGRATULATIONS!",
    accepted: "ACCEPTED",
    allPassed: "All test cases passed.",
    continue: "RETURN TO MAP",
    fullRun: "Every test case runs even after one fails.",
  },
  "zh-CN": {
    worldMap: "世界地图",
    activeMission: "当前关卡",
    problem: "题目",
    guide: "操作引导",
    input: "输入",
    output: "输出",
    sample: "样例",
    hintShow: "[+] 请求提示",
    hintHide: "[-] 收起提示",
    insertHint: "将提示插入编辑器",
    runSample: "运行样例",
    submit: "提交答案",
    judging: "评测中……",
    compiling: "编译中……",
    queued: "排队中……",
    congratulations: "恭喜通关！",
    accepted: "答案正确（AC）",
    allPassed: "所有测试点均已通过。",
    continue: "返回地图",
    fullRun: "即使某个测试点失败，其余测试点仍会全部评测。",
  },
  ja: {
    worldMap: "ワールドマップ",
    activeMission: "進行中のクエスト",
    problem: "問題",
    guide: "操作ガイド",
    input: "入力",
    output: "出力",
    sample: "サンプル",
    hintShow: "[+] ヒントを受信",
    hintHide: "[-] ヒントを閉じる",
    insertHint: "ヒントをエディタへ挿入",
    runSample: "サンプル実行",
    submit: "解答を提出",
    judging: "ジャッジ中…",
    compiling: "コンパイル中…",
    queued: "待機中…",
    congratulations: "クリアおめでとう！",
    accepted: "正解（AC）",
    allPassed: "すべてのテストケースに合格しました。",
    continue: "マップへ戻る",
    fullRun: "一つ失敗しても、残りのテストケースをすべて実行します。",
  },
} as const;

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function formatMemory(memoryKb: number) {
  if (memoryKb < 1024) return `${memoryKb} KB`;
  return `${(memoryKb / 1024).toFixed(2)} MB`;
}

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
      ACCOUNT_REQUIRED: "Log in with a verified player account to use the judge.",
      EMAIL_NOT_VERIFIED: "Verify your email before entering a mission.",
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
    submissionId: submission.id,
    verdict: submission.verdict,
    compilerOutput: submission.compilerOutput,
    error: submission.error,
    cases: submission.cases,
  };
}

export function MissionTerminal({
  quest,
  nextQuestTitle,
  initialCode,
  history,
  onExit,
  onComplete,
  onDraftChange,
  onSubmission,
  locale,
}: {
  quest: Quest;
  nextQuestTitle?: string;
  initialCode?: string;
  history: SaveSubmission[];
  onExit: () => void;
  onComplete: (questId: string, score: number) => void;
  onDraftChange: (questId: string, source: string) => void;
  onSubmission: (submission: SaveSubmission) => void;
  locale: Locale;
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

  const [code, setCode] = useState(initialCode ?? problem.starterCode);
  const [judgeState, setJudgeState] = useState<JudgeState>("idle");
  const [results, setResults] = useState<CaseResult[]>(emptyResults);
  const [consoleText, setConsoleText] = useState(
    "$ judge --awaiting-source\n> Edit main.cpp, then run the sample.",
  );
  const [hintOpen, setHintOpen] = useState(false);
  const [acceptedDialog, setAcceptedDialog] = useState(false);
  const [guideProgress, setGuideProgress] = useState(0);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [editorReady, setEditorReady] = useState(false);
  const copy = missionMessages[locale];

  useEffect(() => {
    let active = true;
    void Promise.all([
      import("monaco-editor"),
      import("monaco-editor/editor/editor.worker?worker"),
    ]).then(([monaco, workerModule]) => {
      const EditorWorker = workerModule.default;
      (
        window as typeof window & {
          MonacoEnvironment?: { getWorker: () => Worker };
        }
      ).MonacoEnvironment = {
        getWorker: () => new EditorWorker(),
      };
      loader.config({ monaco });
      if (active) setEditorReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDraftChange(quest.id, code);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [code, onDraftChange, quest.id]);

  const questHistory = useMemo(
    () => history.filter((item) => item.questId === quest.id).slice(0, 8),
    [history, quest.id],
  );

  const handleEditorMount: OnMount = (editor) => {
    const position = editor.getPosition();
    if (position) {
      setCursor({ line: position.lineNumber, column: position.column });
    }
    editor.onDidChangeCursorPosition((event) => {
      setCursor({
        line: event.position.lineNumber,
        column: event.position.column,
      });
    });
    editor.focus();
  };

  const formatFailure = (response: JudgeResponse) => {
    if (response.verdict === "CE") {
      return `$ compile --std=gnu++14\n[ COMPILE ERROR ]\n${response.compilerOutput ?? "Compiler produced no diagnostics."}`;
    }
    if (response.verdict === "JE") {
      return `$ verdict\n[ JUDGE ERROR ]\n${response.error ?? "The runner exited without diagnostics."}\n> Check the Judge service logs and rerun the deployment smoke test.`;
    }
    if (response.verdict === "WA") {
      return "$ verdict\n[ WA ]";
    }
    const failed = response.cases.find((item) => item.verdict !== "AC");
    if (!failed) return `$ verdict\n[ ${response.verdict} ]`;
    const details = failed.stderr ? `\n${failed.stderr}` : "";
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
              memory: formatMemory(result.memoryKb),
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
        `$ judge --hidden-cases\n[ RUNNING ] ${submission.cases.length} / ${caseIds.length} complete\n> Cases execute as isolated child processes inside the same submission container.\n> ${copy.fullRun}`,
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

  const recordSubmission = (
    response: JudgeResponse,
    mode: "sample" | "submit",
  ) => {
    const now = new Date().toISOString();
    onSubmission({
      id: response.submissionId,
      judgeSubmissionId: response.submissionId,
      questId: quest.id,
      status: "DONE",
      verdict: response.verdict,
      score: response.verdict === "AC" ? 100 : 0,
      source: code,
      language: "cpp14",
      mode,
      details: response,
      createdAt: now,
      updatedAt: now,
    });
  };

  const runSample = async () => {
    if (["queued", "compiling", "running"].includes(judgeState)) return;
    setGuideProgress((current) => Math.max(current, 2));
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
        setGuideProgress((current) => Math.max(current, 3));
        setResults((current) =>
          current.map((result, index) =>
            index === 0
              ? {
                  ...result,
                  verdict: "AC",
                  time: `${sample.timeMs} ms`,
                  memory: formatMemory(sample.memoryKb),
                }
              : result,
          ),
        );
        setConsoleText(
          `$ run --sample\nINPUT    ${problem.sampleInput}\nEXPECTED ${problem.sampleOutput}\nRECEIVED ${problem.sampleOutput}\nTIME     ${sample.timeMs} ms\nMEMORY   ${formatMemory(sample.memoryKb)}\n[ SAMPLE PASSED ]`,
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
                    memory: formatMemory(sample.memoryKb),
                  }
                : result,
            ),
          );
        }
        setConsoleText(formatFailure(response));
        setJudgeState("failed");
      }
      recordSubmission(response, "sample");
    } catch (error) {
      handleRequestError(error);
    }
  };

  const submit = async () => {
    if (["queued", "compiling", "running"].includes(judgeState)) return;
    setGuideProgress((current) => Math.max(current, 4));
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
                memory: formatMemory(result.memoryKb),
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
        setGuideProgress(problem.guidance.length);
        setAcceptedDialog(true);
        setConsoleText(
          `$ verdict\n[ ACCEPTED ] ${response.cases.length} / ${response.cases.length} cases\nTIME   ${maxTime} ms max\nMEMORY ${formatMemory(maxMemory)} max\nSCORE  100 / 100\nREWARD +${quest.xp} XP`,
        );
        onComplete(quest.id, 100);
      } else {
        setJudgeState("failed");
        setConsoleText(formatFailure(response));
      }
      recordSubmission(response, "submit");
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
      {acceptedDialog && (
        <div className="ac-overlay" role="presentation">
          <section
            className="ac-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ac-dialog-title"
          >
            <div className="ac-burst" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <i
                  key={index}
                  style={{ "--burst-index": index } as CSSProperties}
                />
              ))}
            </div>
            <span className="ac-dialog__verdict">AC</span>
            <p>{copy.congratulations}</p>
            <h2 id="ac-dialog-title">{copy.accepted}</h2>
            <strong>+{quest.xp} XP</strong>
            <p>
              {copy.allPassed}
              {nextQuestTitle ? ` ${nextQuestTitle}` : ""}
            </p>
            <div>
              <button type="button" onClick={() => setAcceptedDialog(false)}>
                [ OK ]
              </button>
              <button type="button" onClick={onExit}>
                [ {copy.continue} ]
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="mission-toolbar">
        <button className="back-button" onClick={onExit}>
          &lt; {copy.worldMap}
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
            <button className="is-active">{copy.problem}</button>
            <button disabled>EDITORIAL</button>
          </div>
          <div className="pane-scroll">
            <p className="eyebrow">{`${quest.chapter} // ${copy.activeMission}`}</p>
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

            <section className="mission-guide" aria-label={copy.guide}>
              <div className="mission-guide__title">
                <span>{copy.guide}</span>
                <strong>
                  {Math.min(guideProgress, problem.guidance.length)}/
                  {problem.guidance.length}
                </strong>
              </div>
              <ol>
                {problem.guidance.map((step, index) => (
                  <li
                    className={
                      index < guideProgress
                        ? "is-complete"
                        : index === guideProgress
                          ? "is-current"
                          : ""
                    }
                    key={step}
                  >
                    <span>{index < guideProgress ? "✓" : index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            <h2>{copy.input}</h2>
            <p>{problem.input}</p>
            <pre className="constraint-box">{problem.constraints}</pre>

            <h2>{copy.output}</h2>
            <p>{problem.output}</p>

            <h2>{copy.sample}</h2>
            <div className="sample-grid">
              <div>
                <span>{copy.input}</span>
                <pre>{problem.sampleInput}</pre>
              </div>
              <div>
                <span>{copy.output}</span>
                <pre>{problem.sampleOutput}</pre>
              </div>
            </div>

            <button
              className="hint-toggle"
              onClick={() => setHintOpen((open) => !open)}
            >
              {hintOpen ? copy.hintHide : copy.hintShow}
            </button>
            {hintOpen && (
              <div className="hint-card">
                <strong>CODEX WHISPER</strong>
                <p>{problem.hint}</p>
                <button onClick={insertHint}>[ {copy.insertHint} ]</button>
              </div>
            )}
          </div>
        </article>

        <section className="editor-pane" aria-label="Code editor">
          <div className="editor-header">
            <span>● main.cpp</span>
            <span>
              Ln {cursor.line}, Col {cursor.column}
              {" // Spaces: 4 // UTF-8"}
            </span>
          </div>
          <div className="editor-wrap">
            {editorReady ? (
              <Editor
              height="100%"
              language="cpp"
              theme="vs-dark"
              value={code}
              onMount={handleEditorMount}
              onChange={(value) => {
                setCode(value ?? "");
                if ((value ?? "") !== problem.starterCode) {
                  setGuideProgress((current) => Math.max(current, 2));
                }
                if (judgeState !== "idle") {
                  setJudgeState("idle");
                  setResults(emptyResults());
                }
              }}
              loading={<div className="editor-loading">BOOTING EDITOR...</div>}
              options={{
                automaticLayout: true,
                autoIndent: "full",
                bracketPairColorization: { enabled: true },
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                fontFamily:
                  '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
                fontLigatures: true,
                fontSize: 14,
                formatOnPaste: true,
                formatOnType: true,
                guides: {
                  bracketPairs: true,
                  bracketPairsHorizontal: "active",
                  highlightActiveBracketPair: true,
                  indentation: true,
                },
                insertSpaces: true,
                matchBrackets: "always",
                minimap: { enabled: true, maxColumn: 80, scale: 1 },
                padding: { top: 14, bottom: 14 },
                renderLineHighlight: "all",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                tabSize: 4,
              }}
              />
            ) : (
              <div className="editor-loading">BOOTING EDITOR...</div>
            )}
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

          <div className="submission-history">
            <div className="submission-history__title">
              <span>SUBMISSION HISTORY</span>
              <strong>{questHistory.length.toString().padStart(2, "0")}</strong>
            </div>
            {questHistory.length ? (
              questHistory.map((item) => (
                <button
                  type="button"
                  key={item.judgeSubmissionId}
                  onClick={() => {
                    setCode(item.source);
                    setConsoleText(
                      `$ history --restore ${item.judgeSubmissionId}\n[ ${item.verdict ?? item.status} ] ${new Date(item.createdAt).toLocaleString()}\n> Source restored to main.cpp. Submit it again only when you are ready.`,
                    );
                  }}
                >
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  <strong
                    className={`verdict verdict--${(
                      item.verdict ?? "wait"
                    ).toLowerCase()}`}
                  >
                    {item.verdict ?? item.status}
                  </strong>
                  <small>{item.mode.toUpperCase()}</small>
                </button>
              ))
            ) : (
              <p>NO EVALUATIONS RECORDED FOR THIS QUEST.</p>
            )}
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
        <span>autosave: code + evaluations // device + cloud</span>
        <div>
          <button className="sample-button" onClick={runSample}>
            &gt; {copy.runSample}
          </button>
          <button
            className="submit-button"
            onClick={submit}
            disabled={["queued", "compiling", "running"].includes(judgeState)}
          >
            {judgeState === "queued" && `[ ${copy.queued} ]`}
            {judgeState === "compiling" && `[ ${copy.compiling} ]`}
            {judgeState === "running" && `[ ${copy.judging} ]`}
            {!["queued", "compiling", "running"].includes(judgeState) &&
              `[ ${copy.submit} ]`}
          </button>
        </div>
      </div>
    </section>
  );
}
