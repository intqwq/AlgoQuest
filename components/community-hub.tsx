"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CommunityCategory,
  CommunityUser,
  createCommunityPost,
  EditorialPost,
  loadCommunityPosts,
  Player,
  searchCommunityUsers,
} from "@/lib/api-client";
import {
  EditorialComposer,
  EditorialRichText,
  emptyEditorialDocument,
} from "@/components/editorial-rich-text";
import type { Locale } from "@/lib/i18n";

type View = "discussions" | "users";

const copy = {
  en: {
    eyebrow: "ALGOQUEST COMMUNITY", title: "Community Hub", subtitle: "Discuss algorithms, ask for help, share builds, and meet the people behind the submissions.",
    discussions: "DISCUSSIONS", users: "FIND PLAYERS", searchPosts: "Search discussions", searchUsers: "Handle, name, or bio",
    allCategories: "All categories", search: "SEARCH", newPost: "START A DISCUSSION", category: "CATEGORY", postTitle: "TITLE",
    content: "CONTENT", publish: "PUBLISH", login: "LOGIN TO POST", empty: "No discussions match this search.", noUsers: "No public players match this search.",
    problems: "PROBLEMS", solutions: "SOLUTIONS", posts: "DISCUSSIONS", joined: "JOINED", documentTooLarge: "The document is too large.",
    minimumContent: "Write at least 10 characters before publishing.", loadError: "Community service is temporarily unavailable.",
  },
  "zh-CN": {
    eyebrow: "ALGOQUEST 社区", title: "社区中心", subtitle: "交流算法、求助答疑、展示作品，也能认识每一道提交背后的玩家。",
    discussions: "讨论区", users: "搜索用户", searchPosts: "搜索讨论内容", searchUsers: "搜索用户名、昵称或简介",
    allCategories: "全部分区", search: "搜索", newPost: "发起讨论", category: "分区", postTitle: "标题", content: "正文",
    publish: "发布", login: "登录后发帖", empty: "没有符合条件的讨论。", noUsers: "没有符合条件的公开用户。",
    problems: "原创题目", solutions: "题解", posts: "讨论", joined: "加入时间", documentTooLarge: "文档体积过大。",
    minimumContent: "正文至少需要 10 个字符。", loadError: "社区服务暂时不可用。",
  },
  ja: {
    eyebrow: "ALGOQUEST コミュニティ", title: "コミュニティ・ハブ", subtitle: "アルゴリズムを語り、質問し、作品を共有し、提出の向こうにいるプレイヤーと出会えます。",
    discussions: "ディスカッション", users: "プレイヤー検索", searchPosts: "投稿を検索", searchUsers: "ハンドル、名前、プロフィール",
    allCategories: "すべてのカテゴリ", search: "検索", newPost: "投稿を作成", category: "カテゴリ", postTitle: "タイトル",
    content: "本文", publish: "公開", login: "ログインして投稿", empty: "該当する投稿はありません。", noUsers: "該当する公開プレイヤーはいません。",
    problems: "作成問題", solutions: "解説", posts: "投稿", joined: "参加日", documentTooLarge: "文書サイズが大きすぎます。",
    minimumContent: "本文を10文字以上入力してください。", loadError: "コミュニティを利用できません。",
  },
} as const;

export function CommunityHub({ player, locale, onLogin }: { player?: Player; locale: Locale; onLogin: () => void }) {
  const c = copy[locale];
  const [view, setView] = useState<View>("discussions");
  const [posts, setPosts] = useState<EditorialPost[]>([]);
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState("");
  const [draftCategory, setDraftCategory] = useState("general");
  const [content, setContent] = useState(emptyEditorialDocument);
  const [contentLength, setContentLength] = useState(0);
  const [tooLarge, setTooLarge] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canPost = Boolean(player && !player.isGuest && player.emailVerified);

  const refreshPosts = useCallback(async () => {
    const result = await loadCommunityPosts({ query: appliedQuery, category, page, limit: 20 });
    setPosts(result.posts);
    setCategories(result.categories);
    setTotal(result.total);
  }, [appliedQuery, category, page]);

  const refreshUsers = useCallback(async () => {
    const result = await searchCommunityUsers(appliedQuery, page);
    setUsers(result.users);
    setTotal(result.total);
  }, [appliedQuery, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBusy(true);
      const request = view === "discussions" ? refreshPosts() : refreshUsers();
      void request.catch((error) => setMessage(error instanceof Error ? error.message : c.loadError)).finally(() => setBusy(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [c.loadError, refreshPosts, refreshUsers, view]);

  const categoryNames = useMemo(
    () => new Map(categories.map((item) => [item.id, item.label[locale]])),
    [categories, locale],
  );

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(query.trim());
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!canPost) { onLogin(); return; }
    if (contentLength < 10 || tooLarge) {
      setMessage(tooLarge ? c.documentTooLarge : c.minimumContent);
      return;
    }
    setBusy(true);
    try {
      const post = await createCommunityPost({ category: draftCategory, title, content, contentFormat: "tiptap-json-v1" });
      setPosts((current) => [post, ...current]);
      setTitle("");
      setContent(emptyEditorialDocument);
      setContentLength(0);
      setComposerKey((value) => value + 1);
      setMessage(c.publish);
      setView("discussions");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.loadError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="community-shell" id="community-top">
      <header className="community-hero">
        <div><p className="eyebrow">{c.eyebrow}</p><h1>{c.title}<span>.net</span></h1><p>{c.subtitle}</p></div>
        <div className="community-counter"><strong>{total}</strong><span>{view === "discussions" ? c.discussions : c.users}</span></div>
      </header>
      <nav className="community-tabs">
        <button className={view === "discussions" ? "is-active" : ""} onClick={() => { setView("discussions"); setPage(1); }}>[ {c.discussions} ]</button>
        <button className={view === "users" ? "is-active" : ""} onClick={() => { setView("users"); setPage(1); }}>[ {c.users} ]</button>
      </nav>
      <form className="community-search" onSubmit={applySearch}>
        <label><span>{view === "discussions" ? c.searchPosts : c.searchUsers}</span><input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        {view === "discussions" && <label><span>{c.category}</span><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">{c.allCategories}</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label[locale]}</option>)}</select></label>}
        <button type="submit">&gt; {c.search}_</button>
      </form>
      {message && <p className="community-message" role="status">{message}</p>}

      {view === "discussions" ? <div className="community-layout">
        <div className="community-feed">
          {!busy && !posts.length && <p className="community-empty">&gt; {c.empty}</p>}
          {posts.map((post) => <article key={post.id}>
            <header><div><span>{categoryNames.get(post.targetId) ?? post.targetId}</span><h2>{post.title}</h2></div><time>{new Date(post.createdAt).toLocaleString()}</time></header>
            <EditorialRichText content={post.content} contentFormat={post.contentFormat} />
            <footer>{post.author.handle ? <Link href={`/player/${post.author.handle}`}>@{post.author.handle}</Link> : <strong>{post.author.displayName}</strong>}<span className={`editorial-role editorial-role--${post.author.role}`}>{post.author.role.toUpperCase()}</span></footer>
          </article>)}
        </div>
        <form className="community-compose" onSubmit={publish}>
          <h2>{c.newPost}</h2>
          <label>{c.category}<select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.label[locale]}</option>)}</select></label>
          <label>{c.postTitle}<input minLength={3} maxLength={160} disabled={!canPost || busy} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <div><span>{c.content}</span><EditorialComposer key={composerKey} locale={locale} disabled={!canPost || busy} onChange={(value, length, oversized) => { setContent(value); setContentLength(length); setTooLarge(oversized); }} /></div>
          <button type={canPost ? "submit" : "button"} onClick={canPost ? undefined : onLogin} disabled={busy || (canPost && (contentLength < 10 || tooLarge))}>[ {canPost ? c.publish : c.login} ]</button>
        </form>
      </div> : <div className="community-users">
        {!busy && !users.length && <p className="community-empty">&gt; {c.noUsers}</p>}
        {users.map((user) => <Link href={`/player/${user.handle}`} className="community-user-card" key={user.handle}>
          <header><span>@{user.handle}</span><h2>{user.displayName}</h2></header><p>{user.bio || "// ..."}</p>
          <dl><div><dt>{c.problems}</dt><dd>{user.ojProblemCount}</dd></div><div><dt>{c.solutions}</dt><dd>{user.solutionCount}</dd></div><div><dt>{c.posts}</dt><dd>{user.discussionCount}</dd></div></dl>
          <time>{c.joined}{" // "}{new Date(user.joinedAt).toLocaleDateString()}</time>
        </Link>)}
      </div>}
      <div className="community-pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>←</button><span>PAGE {page} / {Math.max(1, Math.ceil(total / (view === "users" ? 24 : 20)))}</span><button disabled={page * (view === "users" ? 24 : 20) >= total} onClick={() => setPage((value) => value + 1)}>→</button></div>
    </section>
  );
}
