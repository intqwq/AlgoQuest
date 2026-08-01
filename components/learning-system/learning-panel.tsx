"use client";

import { useState } from "react";
import { apiJson } from "./api";
import type { Dashboard, PublicProfile } from "./types";
import styles from "../learning-system.module.css";

export function LearningPanel({
  dashboard,
  onDashboard,
}: {
  dashboard: Dashboard;
  onDashboard: (value: Dashboard) => void;
}) {
  const [minutes, setMinutes] = useState(25);
  const [kind, setKind] = useState("practice");
  const [note, setNote] = useState("");
  const [daily, setDaily] = useState(dashboard.goal.dailyMinutes);
  const [weekly, setWeekly] = useState(dashboard.goal.weeklyQuestTarget);
  const [busy, setBusy] = useState(false);

  const logSession = async () => {
    setBusy(true);
    try {
      const body = await apiJson<{ dashboard: Dashboard }>("/learning/sessions", {
        method: "POST",
        body: JSON.stringify({ minutes, kind, note }),
      });
      onDashboard(body.dashboard);
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  const saveGoal = async () => {
    setBusy(true);
    try {
      await apiJson("/learning/goal", {
        method: "PUT",
        body: JSON.stringify({ dailyMinutes: daily, weeklyQuestTarget: weekly }),
      });
      onDashboard({
        ...dashboard,
        goal: { ...dashboard.goal, dailyMinutes: daily, weeklyQuestTarget: weekly },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.stack}>
      <div className={styles.metrics}>
        <Metric label="CLEARED" value={dashboard.metrics.clearedCount} />
        <Metric label="XP" value={dashboard.metrics.totalXp} />
        <Metric label="STREAK" value={`${dashboard.metrics.currentStreak}D`} />
        <Metric label="AC RATE" value={`${dashboard.metrics.acceptanceRate}%`} />
      </div>

      <section className={styles.card}>
        <div className={styles.rowBetween}>
          <div>
            <span className={styles.kicker}>NEXT ROUTE</span>
            <h3>{dashboard.recommendation.title}</h3>
            <p>{dashboard.recommendation.reason}</p>
          </div>
          {dashboard.recommendation.questId && (
            <a className={styles.action} href={`#mission/${dashboard.recommendation.questId}`}>
              OPEN QUEST
            </a>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.rowBetween}>
          <strong>DAILY FOCUS</strong>
          <span>{dashboard.goal.todayMinutes} / {dashboard.goal.dailyMinutes} MIN</span>
        </div>
        <div className={styles.progress}>
          <span style={{ width: `${dashboard.goal.completionPercent}%` }} />
        </div>
        <div className={styles.formRow}>
          <input type="number" min={5} max={480} value={daily} onChange={(event) => setDaily(Number(event.target.value))} />
          <input type="number" min={1} max={50} value={weekly} onChange={(event) => setWeekly(Number(event.target.value))} />
          <button disabled={busy} onClick={() => void saveGoal()}>SAVE GOAL</button>
        </div>
      </section>

      <section className={styles.card}>
        <strong>LOG LEARNING SESSION</strong>
        <div className={styles.formRow}>
          <input type="number" min={1} max={480} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="practice">PRACTICE</option>
            <option value="study">STUDY</option>
            <option value="review">REVIEW</option>
          </select>
          <input value={note} placeholder="What did you work on?" onChange={(event) => setNote(event.target.value)} />
          <button disabled={busy} onClick={() => void logSession()}>LOG</button>
        </div>
      </section>

      <section className={styles.card}>
        <strong>30-DAY ACTIVITY</strong>
        <div className={styles.heatmap}>
          {dashboard.timeline.map((day) => (
            <span
              key={day.day}
              title={`${day.day}: ${day.minutes} min, ${day.submissions} submissions`}
              data-level={Math.min(4, Math.ceil((day.minutes + day.submissions * 5) / 15))}
            />
          ))}
        </div>
      </section>

      {!!dashboard.weakAreas.length && (
        <section className={styles.card}>
          <strong>REVIEW QUEUE</strong>
          <div className={styles.list}>
            {dashboard.weakAreas.map((area) => (
              <div key={area.questId} className={styles.listRow}>
                <code>{area.questId}</code>
                <span>{area.misses} misses / {area.accepted} AC</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function BadgesPanel({ dashboard }: { dashboard: Dashboard }) {
  return (
    <div className={styles.badges}>
      {dashboard.achievements.map((item) => (
        <article key={item.id} className={`${styles.badge} ${item.unlocked ? styles.unlocked : ""}`}>
          <b>{item.icon}</b>
          <div><strong>{item.title}</strong><p>{item.description}</p></div>
          <small>{item.unlocked ? "UNLOCKED" : "LOCKED"}</small>
        </article>
      ))}
    </div>
  );
}

export function ProfilePanel({
  profile,
  statistics,
  onProfile,
}: {
  profile: PublicProfile;
  statistics: Dashboard["metrics"];
  onProfile: (value: PublicProfile) => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body = await apiJson<{ profile: PublicProfile }>("/me/public-profile", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setDraft(body.profile);
      onProfile(body.profile);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.stack}>
      <div className={styles.metrics}>
        <Metric label="QUESTS" value={statistics.clearedCount} />
        <Metric label="SUBMISSIONS" value={statistics.submissionCount} />
        <Metric label="LONGEST" value={`${statistics.longestStreak}D`} />
        <Metric label="HIDDEN" value={statistics.unlockedHiddenCount} />
      </div>
      <section className={styles.card}>
        <label>PUBLIC HANDLE<input value={draft.handle} onChange={(event) => setDraft({ ...draft, handle: event.target.value.toLowerCase() })} /></label>
        <label>BIO<textarea value={draft.bio} maxLength={280} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} /></label>
        <label className={styles.check}><input type="checkbox" checked={draft.isPublic} onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })} /> Publish profile</label>
        <div className={styles.formRow}>
          <button disabled={busy} onClick={() => void save()}>SAVE PROFILE</button>
          {draft.isPublic && <a className={styles.action} href={`/player/${draft.handle}`}>VIEW PUBLIC PAGE</a>}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>;
}

