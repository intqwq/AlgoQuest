"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadPublicPlayer, PublicPlayerData } from "@/lib/api-client";
import type { Locale } from "@/lib/i18n";
import styles from "./page.module.css";

const copy = {
  en: { back: "RETURN TO ALGOQUEST", record: "PUBLIC PLAYER RECORD", noBio: "No biography has been published.", joined: "JOINED", cleared: "CLEARED", xp: "XP", rate: "AC RATE", streak: "STREAK", achievements: "ACHIEVEMENTS", clears: "RECENT CLEARS", problems: "AUTHORED OJ PROBLEMS", posts: "SOLUTIONS & DISCUSSIONS", emptyProblems: "No published problems.", emptyPosts: "No published posts.", quest: "QUEST", score: "SCORE", clearedAt: "CLEARED" },
  "zh-CN": { back: "返回 ALGOQUEST", record: "公开玩家档案", noBio: "该用户还没有公开简介。", joined: "加入于", cleared: "通关", xp: "经验值", rate: "通过率", streak: "连续学习", achievements: "成就", clears: "最近通关", problems: "发布的 OJ 题目", posts: "题解与讨论", emptyProblems: "暂无已发布题目。", emptyPosts: "暂无已发布内容。", quest: "关卡", score: "分数", clearedAt: "通关时间" },
  ja: { back: "ALGOQUEST に戻る", record: "公開プレイヤー記録", noBio: "プロフィールはまだ公開されていません。", joined: "参加日", cleared: "クリア", xp: "XP", rate: "正解率", streak: "連続日数", achievements: "実績", clears: "最近のクリア", problems: "作成した OJ 問題", posts: "解説とディスカッション", emptyProblems: "公開済みの問題はありません。", emptyPosts: "公開済みの投稿はありません。", quest: "クエスト", score: "スコア", clearedAt: "クリア日時" },
} as const;

function contributionHref(post: PublicPlayerData["contributions"]["posts"][number]) {
  if (post.scope === "oj") return `/?portal=oj&problem=${post.targetId}`;
  if (post.scope === "community") return "/?portal=community";
  return `/#mission/${post.targetId}`;
}

export default function PublicPlayerPage() {
  const { handle } = useParams<{ handle: string }>();
  const [locale, setLocale] = useState<Locale>("en");
  const [data, setData] = useState<PublicPlayerData>();
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("algoquest.locale");
      if (saved === "en" || saved === "zh-CN" || saved === "ja") setLocale(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!handle) return;
    void loadPublicPlayer(handle).then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "PROFILE_LOAD_FAILED"));
  }, [handle]);

  const c = copy[locale];
  return <main className={styles.page} lang={locale === "zh-CN" ? "zh-CN" : locale}><div className={styles.shell}>
    <div className={styles.toolbar}><Link href="/">&lt; {c.back}</Link><div>{(["en", "zh-CN", "ja"] as Locale[]).map((value) => <button key={value} className={locale === value ? styles.active : ""} onClick={() => { setLocale(value); window.localStorage.setItem("algoquest.locale", value); }}>{value === "zh-CN" ? "中文" : value === "ja" ? "日本語" : "EN"}</button>)}</div></div>
    {error && <p className={styles.notice}>{error}</p>}
    {!data && !error && <p className={styles.notice}>LOADING PUBLIC PLAYER RECORD...</p>}
    {data && <>
      <header><span>{c.record}{" // "}@{data.profile.handle}</span><h1>{data.profile.displayName}</h1><p>{data.profile.bio || c.noBio}</p><small>{c.joined} {new Date(data.profile.joinedAt).toLocaleDateString()}</small></header>
      <section className={styles.metrics}><Metric label={c.cleared} value={data.statistics.clearedCount} /><Metric label={c.xp} value={data.statistics.totalXp} /><Metric label={c.rate} value={`${data.statistics.acceptanceRate}%`} /><Metric label={c.streak} value={`${data.statistics.currentStreak}D`} /></section>
      <div className={styles.columns}>
        <section className={styles.block}><h2>{c.problems}</h2>{!data.contributions.problems.length && <p>{c.emptyProblems}</p>}<div className={styles.linkList}>{data.contributions.problems.map((problem) => <Link href={`/?portal=oj&problem=${problem.publicId}`} key={problem.publicId}><span>OJ #{problem.publicId}{" // "}D{problem.difficulty}</span><strong>{problem.title}</strong><small>{problem.tags.slice(0, 5).join(" · ")}</small></Link>)}</div></section>
        <section className={styles.block}><h2>{c.posts}</h2>{!data.contributions.posts.length && <p>{c.emptyPosts}</p>}<div className={styles.linkList}>{data.contributions.posts.map((post) => <Link href={contributionHref(post)} key={post.id}><span>{post.scope.toUpperCase()}{" // "}{post.kind.toUpperCase()}</span><strong>{post.title}</strong><small>{new Date(post.createdAt).toLocaleString()}</small></Link>)}</div></section>
      </div>
      <section className={styles.block}><h2>{c.achievements}</h2><div className={styles.badges}>{data.statistics.achievements.map((item) => <article key={item.id}><b>{item.icon}</b><div><strong>{item.title}</strong><p>{item.description}</p></div><time>{new Date(item.unlockedAt).toLocaleDateString()}</time></article>)}</div></section>
      <section className={styles.block}><h2>{c.clears}</h2><div className={styles.table}><table><thead><tr><th>{c.quest}</th><th>{c.score}</th><th>{c.clearedAt}</th></tr></thead><tbody>{data.statistics.recentClears.map((item) => <tr key={`${item.questId}-${item.clearedAt}`}><td>{item.questId}</td><td>{item.bestScore}</td><td>{new Date(item.clearedAt).toLocaleString()}</td></tr>)}</tbody></table></div></section>
    </>}
  </div></main>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
