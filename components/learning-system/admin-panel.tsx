"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, parseJson, pretty } from "./api";
import type { CodexEntry, QuestDraft, QuestVersion, UnlockRule } from "./types";
import styles from "../learning-system.module.css";

type AdminTab = "drafts" | "rules" | "codex";

const defaultPublic = (id = "custom-quest") => ({
  id, index: "++", title: "Custom Quest", subtitle: "Administrator draft",
  difficulty: 2, xp: 200, status: "locked", prerequisites: [], chapter: "CUSTOM / LAB",
  gridArea: id, mapPosition: { x: 50, y: 50 }, description: "Describe the mission.",
  skills: ["implementation"], sortOrder: 5000,
  problem: { story: ["Write the story."], guidance: ["Explain the invariant."], input: "Input.", constraints: "Constraints.", output: "Output.", sampleInput: "1", sampleOutput: "1", hint: "Hint.", hintMarker: "// TODO", hintCode: "", starterCode: "#include <bits/stdc++.h>\nusing namespace std;\nint main() { return 0; }", testCaseCount: 3, passScore: 100, timeLimitSeconds: 1, memoryLimitMb: 64 },
});
const defaultJudge = () => ({ language: "cpp14", timeLimitMs: 1000, memoryLimitMb: 64, compileLimitMs: 15000, passScore: 100, tests: [{ input: "1\n", expected: "1\n" }, { input: "2\n", expected: "2\n" }, { input: "3\n", expected: "3\n" }] });

export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>("drafts");
  return <div className={styles.stack}>
    <div className={styles.tabs}>{(["drafts", "rules", "codex"] as AdminTab[]).map((item) => <button key={item} data-active={tab === item} onClick={() => setTab(item)}>{item.toUpperCase()}</button>)}</div>
    {tab === "drafts" && <DraftsAdmin />}
    {tab === "rules" && <RulesAdmin />}
    {tab === "codex" && <CodexAdmin />}
  </div>;
}

function DraftsAdmin() {
  const [items, setItems] = useState<QuestDraft[]>([]);
  const [selected, setSelected] = useState<string>();
  const [questId, setQuestId] = useState("custom-quest");
  const [title, setTitle] = useState("Custom Quest");
  const [publicJson, setPublicJson] = useState(pretty(defaultPublic()));
  const [judgeJson, setJudgeJson] = useState(pretty(defaultJudge()));
  const [versions, setVersions] = useState<QuestVersion[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown>>();
  const [message, setMessage] = useState("");
  const load = useCallback(async () => setItems((await apiJson<{ drafts: QuestDraft[] }>("/admin/quest-drafts")).drafts), []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const choose = (item: QuestDraft) => {
    setSelected(item.id); setQuestId(item.questId); setTitle(item.title);
    setPublicJson(pretty(item.publicDefinition)); setJudgeJson(pretty(item.judgeDefinition)); setPreview(undefined);
    void apiJson<{ versions: QuestVersion[] }>(`/admin/quests/${item.questId}/versions`).then((body) => setVersions(body.versions));
  };
  const payload = () => ({ questId, title, publicDefinition: parseJson(publicJson, "PUBLIC_DEFINITION"), judgeDefinition: parseJson(judgeJson, "JUDGE_DEFINITION") });
  const save = async () => {
    try {
      const body = await apiJson<{ draft: QuestDraft }>(selected ? `/admin/quest-drafts/${selected}` : "/admin/quest-drafts", { method: selected ? "PUT" : "POST", body: JSON.stringify(payload()) });
      setSelected(body.draft.id); setMessage(`SAVED REVISION ${body.draft.revision}`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "SAVE_FAILED"); }
  };
  const act = async (action: "preview" | "publish") => {
    if (!selected) return setMessage("SAVE_DRAFT_FIRST");
    try {
      const body = await apiJson<Record<string, unknown>>(`/admin/quest-drafts/${selected}/${action}`, { method: "POST", body: JSON.stringify({ note: `Admin ${action}` }) });
      if (action === "preview") setPreview(body.preview as Record<string, unknown>);
      else { setMessage("PUBLISHED"); setVersions((await apiJson<{ versions: QuestVersion[] }>(`/admin/quests/${questId}/versions`)).versions); }
    } catch (error) { setMessage(error instanceof Error ? error.message : `${action.toUpperCase()}_FAILED`); }
  };
  return <div className={styles.adminGrid}>
    <aside className={styles.card}><div className={styles.rowBetween}><strong>DRAFTS</strong><button onClick={() => { setSelected(undefined); setQuestId("custom-quest"); setTitle("Custom Quest"); setPublicJson(pretty(defaultPublic())); setJudgeJson(pretty(defaultJudge())); }}>NEW</button></div>
      <div className={styles.list}>{items.map((item) => <button className={styles.listButton} key={item.id} data-active={selected === item.id} onClick={() => choose(item)}><b>{item.title}</b><small>{item.questId} · r{item.revision} · {item.status}</small></button>)}</div>
    </aside>
    <section className={styles.card}>
      <div className={styles.formRow}><input value={questId} onChange={(e) => setQuestId(e.target.value)} placeholder="quest-id" /><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title" /></div>
      <label>PUBLIC DEFINITION<textarea className={styles.jsonEditor} value={publicJson} onChange={(e) => setPublicJson(e.target.value)} /></label>
      <label>JUDGE DEFINITION<textarea className={styles.jsonEditor} value={judgeJson} onChange={(e) => setJudgeJson(e.target.value)} /></label>
      <div className={styles.formRow}><button onClick={() => void save()}>SAVE DRAFT</button><button onClick={() => void act("preview")}>PREVIEW</button><button onClick={() => void act("publish")}>PUBLISH</button></div>
      {message && <p className={styles.message}>{message}</p>}
      {preview && <pre className={styles.preview}>{pretty(preview)}</pre>}
      {!!versions.length && <div className={styles.list}><strong>VERSIONS</strong>{versions.map((item) => <div className={styles.listRow} key={item.version}><span>v{item.version} · {item.note}</span><button onClick={() => void apiJson(`/admin/quests/${questId}/versions/${item.version}/rollback`, { method: "POST", body: JSON.stringify({ note: `Rollback to v${item.version}` }) }).then(() => setMessage(`ROLLED BACK TO V${item.version}`))}>ROLLBACK</button></div>)}</div>}
    </section>
  </div>;
}

function RulesAdmin() {
  const [rules, setRules] = useState<UnlockRule[]>([]);
  const [questId, setQuestId] = useState("nameless-room");
  const [label, setLabel] = useState("Sustained learner");
  const [enabled, setEnabled] = useState(true);
  const [ruleJson, setRuleJson] = useState(pretty({ all: [{ clearedAtLeast: 5 }, { acceptedCountAtLeast: 5 }, { streakAtLeast: 2 }] }));
  const [message, setMessage] = useState("");
  const load = useCallback(async () => setRules((await apiJson<{ rules: UnlockRule[] }>("/admin/unlock-rules")).rules), []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const select = (rule: UnlockRule) => { setQuestId(rule.questId); setLabel(rule.label); setEnabled(rule.enabled); setRuleJson(pretty(rule.rule)); };
  const save = async () => { try { await apiJson(`/admin/unlock-rules/${questId}`, { method: "PUT", body: JSON.stringify({ label, enabled, rule: parseJson(ruleJson, "UNLOCK_RULE") }) }); setMessage("RULE SAVED"); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "RULE_FAILED"); } };
  return <div className={styles.adminGrid}><aside className={styles.card}><strong>RULES</strong><div className={styles.list}>{rules.map((rule) => <button key={rule.questId} className={styles.listButton} onClick={() => select(rule)}><b>{rule.questId}</b><small>{rule.enabled ? "ENABLED" : "DISABLED"} · {rule.label}</small></button>)}</div></aside>
    <section className={styles.card}><div className={styles.formRow}><input value={questId} onChange={(e) => setQuestId(e.target.value)} /><input value={label} onChange={(e) => setLabel(e.target.value)} /></div><label className={styles.check}><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled</label><textarea className={styles.jsonEditor} value={ruleJson} onChange={(e) => setRuleJson(e.target.value)} /><button onClick={() => void save()}>SAVE RULE</button>{message && <p className={styles.message}>{message}</p>}</section></div>;
}

function CodexAdmin() {
  const [entries, setEntries] = useState<CodexEntry[]>([]);
  const [selected, setSelected] = useState<string>();
  const blank = useMemo<CodexEntry>(() => ({ id: "custom-entry", category: "algorithms", questId: "signal-fire", marker: "++", title: { en: "Custom entry", "zh-CN": "自定义条目", ja: "カスタム" }, summary: { en: "Summary", "zh-CN": "摘要", ja: "概要" }, explanation: { en: "Explanation", "zh-CN": "说明", ja: "説明" }, checkpoints: [{ en: "Check the invariant.", "zh-CN": "检查不变量。", ja: "不変条件を確認。" }], timeComplexity: "O(n)", spaceComplexity: "O(1)", tags: ["custom"], code: "// C++14", published: true, sortOrder: 5000 }), []);
  const [json, setJson] = useState(pretty(blank)); const [message, setMessage] = useState("");
  const load = useCallback(async () => setEntries((await apiJson<{ entries: CodexEntry[] }>("/admin/codex")).entries), []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const save = async () => { try { const value = parseJson(json, "CODEX_ENTRY"); const path = selected ? `/admin/codex/${selected}` : "/admin/codex"; const body = await apiJson<{ entry: CodexEntry }>(path, { method: selected ? "PUT" : "POST", body: JSON.stringify(value) }); setSelected(body.entry.id); setJson(pretty(body.entry)); setMessage("CODEX SAVED"); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "CODEX_FAILED"); } };
  return <div className={styles.adminGrid}><aside className={styles.card}><div className={styles.rowBetween}><strong>CODEX+</strong><button onClick={() => { setSelected(undefined); setJson(pretty(blank)); }}>NEW</button></div><div className={styles.list}>{entries.map((entry) => <button className={styles.listButton} key={entry.id} onClick={() => { setSelected(entry.id); setJson(pretty(entry)); }}><b>{entry.marker} {entry.title.en}</b><small>{entry.id} · {entry.published ? "PUBLIC" : "DRAFT"}</small></button>)}</div></aside>
    <section className={styles.card}><textarea className={styles.jsonEditorTall} value={json} onChange={(e) => setJson(e.target.value)} /><div className={styles.formRow}><button onClick={() => void save()}>SAVE ENTRY</button>{selected && <button onClick={() => void apiJson(`/admin/codex/${selected}`, { method: "DELETE" }).then(() => { setSelected(undefined); setJson(pretty(blank)); void load(); })}>DELETE</button>}</div>{message && <p className={styles.message}>{message}</p>}</section></div>;
}
