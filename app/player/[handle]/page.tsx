"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./page.module.css";

type PublicData = {
  profile: { handle: string; displayName: string; bio: string; showCode: boolean; joinedAt: string };
  statistics: {
    clearedCount: number; submissionCount: number; acceptedCount: number; acceptanceRate: number;
    currentStreak: number; longestStreak: number; totalXp: number;
    achievements: Array<{ id: string; icon: string; title: string; description: string; unlockedAt: string }>;
    recentClears: Array<{ questId: string; bestScore: number; clearedAt: string }>;
  };
};

export default function PublicPlayerPage() {
  const { handle } = useParams<{ handle: string }>();
  const [data, setData] = useState<PublicData>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!handle) return;
    void fetch(`/api/v1/players/${encodeURIComponent(handle)}`, { headers: { accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? `HTTP_${response.status}`);
        setData(body);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "PROFILE_LOAD_FAILED"));
  }, [handle]);
  return <main className={styles.page}><div className={styles.shell}>
    <Link href="/">&lt; RETURN TO ALGOQUEST</Link>
    {error && <p className={styles.notice}>{error}</p>}
    {!data && !error && <p className={styles.notice}>LOADING PUBLIC PLAYER RECORD...</p>}
    {data && <>
      <header><span>PUBLIC PLAYER RECORD // @{data.profile.handle}</span><h1>{data.profile.displayName}</h1><p>{data.profile.bio || "No biography has been published."}</p><small>JOINED {new Date(data.profile.joinedAt).toLocaleDateString()}</small></header>
      <section className={styles.metrics}>
        <Metric label="CLEARED" value={data.statistics.clearedCount} />
        <Metric label="XP" value={data.statistics.totalXp} />
        <Metric label="AC RATE" value={`${data.statistics.acceptanceRate}%`} />
        <Metric label="STREAK" value={`${data.statistics.currentStreak}D`} />
      </section>
      <section className={styles.block}><h2>ACHIEVEMENTS</h2><div className={styles.badges}>{data.statistics.achievements.map((item) => <article key={item.id}><b>{item.icon}</b><div><strong>{item.title}</strong><p>{item.description}</p></div><time>{new Date(item.unlockedAt).toLocaleDateString()}</time></article>)}</div></section>
      <section className={styles.block}><h2>RECENT CLEARS</h2><div className={styles.table}><table><thead><tr><th>QUEST</th><th>SCORE</th><th>CLEARED</th></tr></thead><tbody>{data.statistics.recentClears.map((item) => <tr key={`${item.questId}-${item.clearedAt}`}><td>{item.questId}</td><td>{item.bestScore}</td><td>{new Date(item.clearedAt).toLocaleString()}</td></tr>)}</tbody></table></div></section>
    </>}
  </div></main>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
