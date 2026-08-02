"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, localText } from "./learning-system/api";
import { AdminPanel } from "./learning-system/admin-panel";
import { BadgesPanel, LearningPanel, ProfilePanel } from "./learning-system/learning-panel";
import { SubmissionsPanel } from "./learning-system/submissions-panel";
import type { CodexEntry, Dashboard, Player, PublicProfile } from "./learning-system/types";
import dockLayoutStyles from "./learning-system-dock-layout.module.css";
import styles from "./learning-system.module.css";

type Tab = "learn" | "badges" | "profile" | "submissions" | "codex" | "admin";

export function LearningSystemDock() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("learn");
  const [player, setPlayer] = useState<Player>();
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [profile, setProfile] = useState<PublicProfile>();
  const [codex, setCodex] = useState<CodexEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const token = window.localStorage.getItem("algoquest.session-token");
    if (!token) { setPlayer(undefined); setDashboard(undefined); return; }
    setLoading(true); setError("");
    try {
      const [me, learning, publicProfile, codexBody] = await Promise.all([
        apiJson<{ player: Player }>("/me"),
        apiJson<{ dashboard: Dashboard }>("/learning/dashboard"),
        apiJson<{ profile: PublicProfile }>("/me/public-profile"),
        apiJson<{ entries: CodexEntry[] }>("/codex"),
      ]);
      setPlayer(me.player); setDashboard(learning.dashboard); setProfile(publicProfile.profile); setCodex(codexBody.entries);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "LEARNING_SYSTEM_OFFLINE");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("algoquest:session", refresh);
    if (open) queueMicrotask(() => void load());
    return () => window.removeEventListener("algoquest:session", refresh);
  }, [load, open]);

  const tabs = useMemo(() => {
    const values: Array<[Tab, string]> = [["learn", "LEARN"], ["badges", "BADGES"], ["profile", "PROFILE"], ["submissions", "SUBMISSIONS"], ["codex", "CODEX+"]];
    if (player?.role === "admin" || player?.role === "owner") values.push(["admin", "ADMIN"]);
    return values;
  }, [player?.role]);

  return <>
    <button className={`${styles.launcher} ${dockLayoutStyles.launcher}`} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <span>{dashboard ? `${dashboard.metrics.currentStreak}D` : "AQ"}</span>
      {open ? "CLOSE LEARNING OS" : "LEARNING OS"}
    </button>
    {open && <aside className={`${styles.shell} ${dockLayoutStyles.shell}`} aria-label="Continuous learning system">
      <header className={styles.header}>
        <div><span className={styles.kicker}>ALGOQUEST LEARNING OS</span><h2>{player ? player.displayName : "ACCOUNT REQUIRED"}</h2></div>
        <div className={styles.headerActions}><button onClick={() => void load()}>REFRESH</button><button onClick={() => setOpen(false)}>×</button></div>
      </header>
      {!player || !dashboard || !profile ? (
        <div className={styles.empty}><strong>{loading ? "SYNCING LEARNING GRAPH..." : "VERIFIED ACCOUNT REQUIRED"}</strong><p>{error || "Log in to activate persistent goals, streaks, badges, profiles and submission analytics."}</p></div>
      ) : <>
        <nav className={styles.tabs}>{tabs.map(([value, label]) => <button key={value} data-active={tab === value} onClick={() => setTab(value)}>{label}</button>)}</nav>
        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}
          {tab === "learn" && <LearningPanel dashboard={dashboard} onDashboard={setDashboard} />}
          {tab === "badges" && <BadgesPanel dashboard={dashboard} />}
          {tab === "profile" && <ProfilePanel profile={profile} statistics={dashboard.metrics} onProfile={setProfile} />}
          {tab === "submissions" && <SubmissionsPanel />}
          {tab === "codex" && <CodexPanel entries={codex} />}
          {tab === "admin" && <AdminPanel />}
        </div>
      </>}
    </aside>}
  </>;
}

function CodexPanel({ entries }: { entries: CodexEntry[] }) {
  const [query, setQuery] = useState("");
  const filtered = entries.filter((entry) => `${entry.id} ${entry.tags.join(" ")} ${localText(entry.title)} ${localText(entry.summary)}`.toLowerCase().includes(query.toLowerCase()));
  return <div className={styles.stack}>
    <section className={styles.card}><input value={query} placeholder="Search custom Codex entries" onChange={(e) => setQuery(e.target.value)} /></section>
    <div className={styles.codexGrid}>{filtered.map((entry) => <article className={styles.card} key={entry.id}><span className={styles.kicker}>{entry.marker} {entry.category}</span><h3>{localText(entry.title)}</h3><p>{localText(entry.summary)}</p><p>{localText(entry.explanation)}</p><div className={styles.rowBetween}><code>{entry.timeComplexity}</code><code>{entry.spaceComplexity}</code></div>{entry.code && <pre className={styles.preview}>{entry.code}</pre>}<small>{entry.tags.join(" · ")}</small></article>)}</div>
  </div>;
}
