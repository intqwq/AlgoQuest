"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "./api";
import type { DiffResult, SubmissionPage } from "./types";
import styles from "../learning-system.module.css";

export function SubmissionsPanel() {
  const [page, setPage] = useState<SubmissionPage>();
  const [number, setNumber] = useState(1);
  const [questId, setQuestId] = useState("");
  const [verdict, setVerdict] = useState("");
  const [mode, setMode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [diff, setDiff] = useState<DiffResult>();
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const query = new URLSearchParams({ page: String(number), limit: "15" });
      if (questId) query.set("questId", questId);
      if (verdict) query.set("verdict", verdict);
      if (mode) query.set("mode", mode);
      if (from) query.set("from", from);
      if (to) query.set("to", `${to}T23:59:59.999Z`);
      setPage(await apiJson<SubmissionPage>(`/me/submissions?${query}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SUBMISSION_HISTORY_FAILED");
    }
  }, [number, questId, verdict, mode, from, to]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const compare = async (id: string, against = "previous") => {
    setDiff(await apiJson<DiffResult>(`/me/submissions/${id}/diff?against=${against}`));
  };

  if (!page) return <p className={styles.message}>{error || "LOADING SUBMISSIONS..."}</p>;
  return (
    <div className={styles.stack}>
      <div className={styles.metrics}>
        <Metric label="TOTAL" value={page.statistics.total} />
        <Metric label="AC" value={page.statistics.accepted} />
        <Metric label="RATE" value={`${page.statistics.acceptanceRate}%`} />
        <Metric label="AVG SCORE" value={page.statistics.averageScore.toFixed(1)} />
      </div>
      <section className={styles.card}>
        <div className={styles.formRow}>
          <input value={questId} placeholder="quest-id" onChange={(e) => setQuestId(e.target.value)} />
          <select value={verdict} onChange={(e) => setVerdict(e.target.value)}>
            <option value="">ALL VERDICTS</option>
            {Object.keys(page.statistics.verdictCounts).map((value) => <option key={value}>{value}</option>)}
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value)}><option value="">ALL MODES</option><option value="submit">SUBMIT</option><option value="sample">SAMPLE</option></select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          <button onClick={() => { setNumber(1); void load(); }}>FILTER</button>
        </div>
      </section>
      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table><thead><tr><th>DATE</th><th>QUEST</th><th>MODE</th><th>VERDICT</th><th>SCORE</th><th>DIFF</th></tr></thead>
          <tbody>{page.submissions.map((item) => (
            <tr key={item.id}>
              <td>{new Date(item.createdAt).toLocaleString()}</td><td><code>{item.questId}</code></td><td>{item.mode}</td>
              <td><Verdict value={item.verdict ?? item.status} /></td><td>{item.score}</td>
              <td><button onClick={() => void compare(item.id)}>PREVIOUS</button> <button onClick={() => void compare(item.id, "accepted")}>LAST AC</button></td>
            </tr>
          ))}</tbody></table>
        </div>
        <div className={styles.pager}>
          <button disabled={number <= 1} onClick={() => setNumber((value) => value - 1)}>PREV</button>
          <span>{page.pagination.page} / {page.pagination.pages} · {page.pagination.total}</span>
          <button disabled={number >= page.pagination.pages} onClick={() => setNumber((value) => value + 1)}>NEXT</button>
        </div>
      </section>
      {diff && (
        <section className={styles.card}>
          <div className={styles.rowBetween}><strong>CODE DIFF // {diff.current.questId}</strong><button onClick={() => setDiff(undefined)}>CLOSE</button></div>
          <p>+{diff.summary.added} / -{diff.summary.removed} / ={diff.summary.unchanged}</p>
          <pre className={styles.diff}>{diff.operations.map((line, index) => (
            <span key={index} data-kind={line.type}>{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "} {line.line}{"\n"}</span>
          ))}</pre>
        </section>
      )}
    </div>
  );
}

function Verdict({ value }: { value: string }) {
  return <b className={styles.verdict} data-verdict={value}>{value}</b>;
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>;
}
