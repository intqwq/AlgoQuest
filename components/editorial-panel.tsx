"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  createEditorialPost,
  EditorialEligibility,
  EditorialKind,
  EditorialPost,
  loadQuestEditorial,
} from "@/lib/api-client";
import type { Locale } from "@/lib/i18n";
import type { Quest } from "@/lib/quests";

const copies = {
  en: {
    title: "EDITORIAL ARCHIVE",
    discussion: "DISCUSSIONS",
    solution: "SOLUTIONS",
    close: "CLOSE",
    refresh: "REFRESH",
    newPost: "NEW POST",
    postTitle: "TITLE",
    content: "CONTENT",
    publish: "PUBLISH",
    submitReview: "SUBMIT FOR REVIEW",
    pending: "PENDING REVIEW",
    rejected: "REJECTED",
    empty: "NO PUBLISHED POSTS YET.",
    discussionGate: "Make at least one submission on this quest to post.",
    solutionGate: "Clear this quest before publishing a solution.",
    discussionHint: "Discussions publish immediately after the submission requirement is met.",
    solutionModerationHint: "Player solutions appear after an administrator or site owner approves them.",
    directHint: "Your role publishes immediately.",
  },
  "zh-CN": {
    title: "题解与讨论",
    discussion: "讨论区",
    solution: "题解区",
    close: "关闭",
    refresh: "刷新",
    newPost: "发布内容",
    postTitle: "标题",
    content: "正文",
    publish: "直接发布",
    submitReview: "提交审核",
    pending: "等待审核",
    rejected: "未通过审核",
    empty: "暂时没有已发布内容。",
    discussionGate: "本关至少提交过一次后，才可以参与讨论。",
    solutionGate: "通关本关后，才可以发布题解。",
    discussionHint: "满足提交条件后，讨论会立即公开，无需审核。",
    solutionModerationHint: "普通玩家发布的题解需由管理员或站长审核后公开。",
    directHint: "你的身份可以直接发布。",
  },
  ja: {
    title: "解説とディスカッション",
    discussion: "ディスカッション",
    solution: "解説",
    close: "閉じる",
    refresh: "更新",
    newPost: "新規投稿",
    postTitle: "タイトル",
    content: "本文",
    publish: "すぐ公開",
    submitReview: "審査へ送信",
    pending: "審査待ち",
    rejected: "却下",
    empty: "公開済みの投稿はまだありません。",
    discussionGate: "このクエストに一度以上提出すると投稿できます。",
    solutionGate: "このクエストをクリアすると解説を投稿できます。",
    discussionHint: "提出条件を満たしたディスカッションは審査なしですぐ公開されます。",
    solutionModerationHint: "プレイヤーの解説は管理者またはサイトオーナーの承認後に公開されます。",
    directHint: "この権限ではすぐ公開されます。",
  },
} as const;

function roleLabel(role: EditorialPost["author"]["role"]) {
  return role === "owner" ? "SITE OWNER" : role.toUpperCase();
}

export function EditorialPanel({
  quest,
  locale,
  open,
  onClose,
}: {
  quest: Quest;
  locale: Locale;
  open: boolean;
  onClose: () => void;
}) {
  const copy = copies[locale];
  const [kind, setKind] = useState<EditorialKind>("discussion");
  const [posts, setPosts] = useState<EditorialPost[]>([]);
  const [eligibility, setEligibility] = useState<EditorialEligibility>({
    discussion: false,
    solution: false,
    directPublish: false,
  });
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await loadQuestEditorial(quest.id);
    setPosts(result.posts);
    setEligibility(result.eligibility);
  }, [quest.id]);

  useEffect(() => {
    if (!open) return;
    // Opening the modal intentionally synchronizes its server-backed feed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch((error) =>
      setMessage(error instanceof Error ? error.message : "EDITORIAL LINK FAILED"),
    );
  }, [open, refresh]);

  const visiblePosts = useMemo(
    () => posts.filter((post) => post.kind === kind),
    [kind, posts],
  );
  const canPost = eligibility[kind];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canPost) return;
    setBusy(true);
    setMessage("");
    try {
      const post = await createEditorialPost(quest.id, { kind, title, content });
      setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
      setTitle("");
      setContent("");
      setMessage(
        post.status === "published"
          ? copy.publish
          : copy.pending,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "POST FAILED");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="editorial-overlay">
      <section className="editorial-panel" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>EDITORIAL://QUEST_{quest.index}</span>
            <h2>{copy.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setMessage("");
              onClose();
            }}
          >
            [ {copy.close} ]
          </button>
        </header>
        <nav>
          {(["discussion", "solution"] as EditorialKind[]).map((item) => (
            <button
              type="button"
              key={item}
              className={kind === item ? "is-active" : ""}
              onClick={() => {
                setKind(item);
                setMessage("");
              }}
            >
              [ {copy[item]} ]
            </button>
          ))}
          <button type="button" onClick={() => void refresh()}>[ {copy.refresh} ]</button>
        </nav>
        <div key={kind} className="editorial-body page-transition">
          <div className="editorial-feed">
            {visiblePosts.length ? (
              visiblePosts.map((post) => (
                <article key={post.id} className={`editorial-post editorial-post--${post.status}`}>
                  <div>
                    <span className={`editorial-role editorial-role--${post.author.role}`}>
                      {roleLabel(post.author.role)}
                    </span>
                    {post.status !== "published" && (
                      <span>{post.status === "pending" ? copy.pending : copy.rejected}</span>
                    )}
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.content}</p>
                  <div className="editorial-post__meta">
                    <strong>{post.author.displayName}</strong>
                    <time>{new Date(post.createdAt).toLocaleString()}</time>
                  </div>
                </article>
              ))
            ) : (
              <p className="editorial-empty">&gt; {copy.empty}</p>
            )}
          </div>
          <form className="editorial-compose" onSubmit={submit}>
            <h3>{copy.newPost}</h3>
            <p>{kind === "discussion" ? copy.discussionGate : copy.solutionGate}</p>
            <p>
    {kind === "discussion"
      ? copy.discussionHint
      : eligibility.directPublish
        ? copy.directHint
        : copy.solutionModerationHint}
  </p>
            <label>
              {copy.postTitle}
              <input
                value={title}
                minLength={3}
                maxLength={160}
                disabled={!canPost || busy}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              {copy.content}
              <textarea
                value={content}
                minLength={10}
                maxLength={60 * 1024}
                disabled={!canPost || busy}
                onChange={(event) => setContent(event.target.value)}
              />
            </label>
            {message && <p className="editorial-message">{message}</p>}
            <button type="submit" disabled={!canPost || busy}>
              [ {kind === "discussion" || eligibility.directPublish
      ? copy.publish
      : copy.submitReview} ]
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
