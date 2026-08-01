"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  createOjEditorialPost,
  EditorialEligibility,
  EditorialKind,
  EditorialPost,
  loadOjEditorial,
  Player,
} from "@/lib/api-client";
import {
  EditorialComposer,
  EditorialRichText,
  emptyEditorialDocument,
} from "@/components/editorial-rich-text";
import type { Locale } from "@/lib/i18n";

const copy = {
  en: {
    title: "SOLUTIONS & DISCUSSION", discussion: "DISCUSSION", solution: "SOLUTIONS",
    refresh: "REFRESH", empty: "No published posts yet.", newPost: "NEW POST", postTitle: "TITLE",
    content: "CONTENT", publish: "PUBLISH", review: "SUBMIT FOR REVIEW", pending: "PENDING REVIEW",
    login: "Log in to join the discussion.", discussionGate: "Submit once on this problem before posting.",
    solutionGate: "Earn AC on this problem before publishing a solution.", tooShort: "Write at least 10 characters.",
    tooLarge: "The document is too large.", loadError: "Editorial service is temporarily unavailable.",
  },
  "zh-CN": {
    title: "题解与讨论", discussion: "讨论区", solution: "题解区", refresh: "刷新",
    empty: "暂时没有已发布内容。", newPost: "发布内容", postTitle: "标题", content: "正文",
    publish: "发布", review: "提交审核", pending: "等待审核", login: "登录后参与讨论。",
    discussionGate: "至少提交过一次本题后才可以发言。", solutionGate: "本题 AC 后才可以发布题解。",
    tooShort: "正文至少需要 10 个字符。", tooLarge: "文档体积过大。", loadError: "题解服务暂时不可用。",
  },
  ja: {
    title: "解説とディスカッション", discussion: "ディスカッション", solution: "解説",
    refresh: "更新", empty: "公開済みの投稿はまだありません。", newPost: "新規投稿",
    postTitle: "タイトル", content: "本文", publish: "公開", review: "審査へ送信",
    pending: "審査待ち", login: "ログインすると参加できます。",
    discussionGate: "この問題に一度提出すると投稿できます。", solutionGate: "この問題を AC すると解説を投稿できます。",
    tooShort: "本文を10文字以上入力してください。", tooLarge: "文書サイズが大きすぎます。",
    loadError: "解説サービスを利用できません。",
  },
} as const;

const emptyEligibility: EditorialEligibility = {
  discussion: false,
  solution: false,
  directPublish: false,
};

export function OjEditorial({
  publicId,
  player,
  locale,
  onLogin,
}: {
  publicId: number;
  player?: Player;
  locale: Locale;
  onLogin: () => void;
}) {
  const c = copy[locale];
  const [kind, setKind] = useState<EditorialKind>("discussion");
  const [posts, setPosts] = useState<EditorialPost[]>([]);
  const [eligibility, setEligibility] = useState(emptyEligibility);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState(emptyEditorialDocument);
  const [contentLength, setContentLength] = useState(0);
  const [tooLarge, setTooLarge] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await loadOjEditorial(publicId);
      setPosts(result.posts);
      setEligibility(result.eligibility);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.loadError);
    }
  }, [c.loadError, publicId]);

  useEffect(() => {
    // The selected OJ problem owns a separate server-backed editorial feed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const visible = useMemo(
    () => posts.filter((post) => post.kind === kind),
    [kind, posts],
  );
  const canPost = eligibility[kind];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!player) {
      onLogin();
      return;
    }
    if (!canPost || contentLength < 10 || tooLarge) {
      setMessage(tooLarge ? c.tooLarge : contentLength < 10 ? c.tooShort : kind === "solution" ? c.solutionGate : c.discussionGate);
      return;
    }
    setBusy(true);
    try {
      const post = await createOjEditorialPost(publicId, {
        kind,
        title,
        content,
        contentFormat: "tiptap-json-v1",
      });
      setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
      setTitle("");
      setContent(emptyEditorialDocument);
      setContentLength(0);
      setComposerKey((value) => value + 1);
      setMessage(post.status === "published" ? c.publish : c.pending);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.loadError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="resource-editorial" aria-label={c.title}>
      <header>
        <div><span>OJ://{publicId}/EDITORIAL</span><h2>{c.title}</h2></div>
        <button type="button" onClick={() => void refresh()}>[ {c.refresh} ]</button>
      </header>
      <nav>
        {(["discussion", "solution"] as EditorialKind[]).map((value) => (
          <button type="button" key={value} className={kind === value ? "is-active" : ""} onClick={() => setKind(value)}>
            [ {c[value]} ]
          </button>
        ))}
      </nav>
      <div className="resource-editorial__layout">
        <div className="resource-editorial__feed">
          {visible.length ? visible.map((post) => (
            <article key={post.id}>
              <div className="resource-editorial__meta">
                <span className={`editorial-role editorial-role--${post.author.role}`}>{post.author.role.toUpperCase()}</span>
                {post.author.handle ? <Link href={`/player/${post.author.handle}`}>@{post.author.handle}</Link> : <strong>{post.author.displayName}</strong>}
                <time>{new Date(post.createdAt).toLocaleString()}</time>
              </div>
              <h3>{post.title}</h3>
              <EditorialRichText content={post.content} contentFormat={post.contentFormat} />
            </article>
          )) : <p className="editorial-empty">&gt; {c.empty}</p>}
        </div>
        <form className="resource-editorial__composer" onSubmit={submit}>
          <h3>{c.newPost}</h3>
          <p>{!player ? c.login : kind === "solution" ? c.solutionGate : c.discussionGate}</p>
          <label>{c.postTitle}<input minLength={3} maxLength={160} value={title} disabled={!canPost || busy} onChange={(event) => setTitle(event.target.value)} /></label>
          <div><span>{c.content}</span><EditorialComposer key={composerKey} locale={locale} disabled={!canPost || busy} onChange={(value, length, oversized) => { setContent(value); setContentLength(length); setTooLarge(oversized); }} /></div>
          {message && <p className="editorial-message">{message}</p>}
          {!player ? <button type="button" onClick={onLogin}>[ {c.login} ]</button> : <button type="submit" disabled={!canPost || busy || contentLength < 10 || tooLarge}>[ {kind === "solution" && !eligibility.directPublish ? c.review : c.publish} ]</button>}
        </form>
      </div>
    </section>
  );
}
