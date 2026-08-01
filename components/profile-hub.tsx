"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  loadMyPublicProfile,
  Player,
  ProfileContributions,
  PublicPlayerData,
  updateMyPublicProfile,
} from "@/lib/api-client";
import type { Locale } from "@/lib/i18n";

type EditableProfile = {
  handle: string;
  bio: string;
  isPublic: boolean;
  showCode: boolean;
  createdAt: string;
  updatedAt: string;
};

const copy = {
  en: {
    eyebrow: "PLAYER DATABASE", title: "Personal Page", subtitle: "Your persistent AlgoQuest identity, activity, and public contributions.",
    login: "Log in to open your personal page.", edit: "PROFILE SETTINGS", handle: "PUBLIC HANDLE", bio: "BIO",
    public: "Publish profile", code: "Allow accepted-code display", save: "SAVE PROFILE", publicPage: "OPEN PUBLIC PAGE",
    quests: "CLEARED", submissions: "SUBMISSIONS", acceptance: "AC RATE", streak: "STREAK", xp: "XP",
    problems: "AUTHORED OJ PROBLEMS", contributions: "SOLUTIONS & DISCUSSIONS", achievements: "ACHIEVEMENTS",
    emptyProblems: "No published OJ problems yet.", emptyPosts: "No published community contributions yet.",
    saved: "Profile saved.", loadError: "Profile service is temporarily unavailable.",
  },
  "zh-CN": {
    eyebrow: "玩家数据库", title: "个人页面", subtitle: "集中展示你的 AlgoQuest 身份、学习记录与公开社区贡献。",
    login: "登录后打开个人页面。", edit: "个人资料设置", handle: "公开用户名", bio: "个人简介",
    public: "公开个人页面", code: "允许展示通过代码", save: "保存资料", publicPage: "查看公开页面",
    quests: "通关", submissions: "提交", acceptance: "通过率", streak: "连续学习", xp: "经验值",
    problems: "我发布的 OJ 题目", contributions: "题解与讨论", achievements: "成就",
    emptyProblems: "还没有已发布的 OJ 题目。", emptyPosts: "还没有已发布的社区内容。",
    saved: "个人资料已保存。", loadError: "个人页面服务暂时不可用。",
  },
  ja: {
    eyebrow: "プレイヤーデータベース", title: "個人ページ", subtitle: "AlgoQuest でのプロフィール、学習履歴、公開投稿をまとめて表示します。",
    login: "ログインすると個人ページを開けます。", edit: "プロフィール設定", handle: "公開ハンドル", bio: "自己紹介",
    public: "プロフィールを公開", code: "正解コードの表示を許可", save: "保存", publicPage: "公開ページを開く",
    quests: "クリア", submissions: "提出", acceptance: "正解率", streak: "連続日数", xp: "XP",
    problems: "作成した OJ 問題", contributions: "解説とディスカッション", achievements: "実績",
    emptyProblems: "公開済みの OJ 問題はありません。", emptyPosts: "公開済みの投稿はありません。",
    saved: "プロフィールを保存しました。", loadError: "プロフィールを利用できません。",
  },
} as const;

function postHref(post: ProfileContributions["posts"][number]) {
  if (post.scope === "oj") return `/?portal=oj&problem=${encodeURIComponent(post.targetId)}`;
  if (post.scope === "community") return "/?portal=community";
  return `/#mission/${encodeURIComponent(post.targetId)}`;
}

export function ProfileHub({ player, locale, onLogin }: { player?: Player; locale: Locale; onLogin: () => void }) {
  const c = copy[locale];
  const [profile, setProfile] = useState<EditableProfile>();
  const [draft, setDraft] = useState<EditableProfile>();
  const [statistics, setStatistics] = useState<PublicPlayerData["statistics"]>();
  const [contributions, setContributions] = useState<ProfileContributions>({ problems: [], posts: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!player) return;
    setBusy(true);
    try {
      const result = await loadMyPublicProfile();
      setProfile(result.profile);
      setDraft(result.profile);
      setStatistics(result.statistics);
      setContributions(result.contributions);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }, [c.loadError, player]);

  useEffect(() => {
    // The dedicated profile tab follows the authenticated account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const result = await updateMyPublicProfile(draft);
      setProfile(result.profile);
      setDraft(result.profile);
      setMessage(c.saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.loadError);
    } finally {
      setBusy(false);
    }
  };

  if (!player) {
    return <section className="profile-shell profile-shell--locked"><p className="eyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p>{c.login}</p><button onClick={onLogin}>[ LOGIN ]</button></section>;
  }

  return <section className="profile-shell" id="profile-top">
    <header className="profile-hero"><div><p className="eyebrow">{c.eyebrow}</p><h1>{c.title}<span>.usr</span></h1><p>{c.subtitle}</p></div><div><span>@{profile?.handle ?? "..."}</span><strong>{player.displayName}</strong><small>{player.role.toUpperCase()}</small></div></header>
    {message && <p className="profile-message" role="status">{message}</p>}
    {statistics && <section className="profile-metrics"><Metric label={c.quests} value={statistics.clearedCount} /><Metric label={c.submissions} value={statistics.submissionCount} /><Metric label={c.acceptance} value={`${statistics.acceptanceRate}%`} /><Metric label={c.streak} value={`${statistics.currentStreak}D`} /><Metric label={c.xp} value={statistics.totalXp} /></section>}
    <div className="profile-layout">
      <section className="profile-settings"><h2>{c.edit}</h2>{draft && <><label>{c.handle}<input value={draft.handle} onChange={(event) => setDraft({ ...draft, handle: event.target.value.toLowerCase() })} /></label><label>{c.bio}<textarea maxLength={280} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} /></label><label className="profile-check"><input type="checkbox" checked={draft.isPublic} onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })} /> {c.public}</label><label className="profile-check"><input type="checkbox" checked={draft.showCode} onChange={(event) => setDraft({ ...draft, showCode: event.target.checked })} /> {c.code}</label><div><button disabled={busy} onClick={() => void save()}>[ {c.save} ]</button>{draft.isPublic && <Link href={`/player/${draft.handle}`}>[ {c.publicPage} ]</Link>}</div></>}</section>
      <section className="profile-contributions"><h2>{c.problems}</h2>{!contributions.problems.length && <p>&gt; {c.emptyProblems}</p>}<div className="profile-problem-grid">{contributions.problems.map((problem) => <Link href={`/?portal=oj&problem=${problem.publicId}`} key={problem.publicId}><span>OJ #{problem.publicId}{" // "}D{problem.difficulty}</span><strong>{problem.title}</strong><small>{problem.tags.slice(0, 4).join(" · ")}</small></Link>)}</div></section>
      <section className="profile-contributions"><h2>{c.contributions}</h2>{!contributions.posts.length && <p>&gt; {c.emptyPosts}</p>}<div className="profile-post-list">{contributions.posts.map((post) => <Link href={postHref(post)} key={post.id}><span>{post.scope.toUpperCase()}{" // "}{post.kind.toUpperCase()}</span><strong>{post.title}</strong><time>{new Date(post.createdAt).toLocaleString()}</time></Link>)}</div></section>
      {statistics && <section className="profile-achievements"><h2>{c.achievements}</h2><div>{statistics.achievements.map((item) => <article key={item.id}><b>{item.icon}</b><span><strong>{item.title}</strong><small>{item.description}</small></span></article>)}</div></section>}
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
