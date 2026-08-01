"use client";

import { useMemo, useState } from "react";
import {
  CodexCategory,
  codexCategories,
  codexEntries,
  localizeCodex,
} from "@/lib/codex";
import type { Locale } from "@/lib/i18n";
import type { Quest } from "@/lib/quests";

const copies = {
  en: {
    eyebrow: "REFERENCE ARCHIVE // LIVE",
    title: "ALGORITHM CODEX",
    description:
      "Search compact field notes, complexity rules and C++14 patterns. Every entry links back to the mission that teaches it.",
    all: "ALL FILES",
    search: "Search concepts, tags or quests",
    discovered: "DISCOVERED",
    preview: "PREVIEW",
    entries: "FILES",
    completion: "ARCHIVE SYNC",
    noMatches: "NO CODEX FILE MATCHES THIS QUERY.",
    time: "TIME",
    space: "SPACE",
    checklist: "MISSION CHECKLIST",
    implementation: "REFERENCE IMPLEMENTATION // C++14",
    relatedQuest: "RELATED QUEST",
    openQuest: "OPEN QUEST",
    unavailableQuest: "QUEST RECORD UNAVAILABLE",
    reading: "READING FILE",
  },
  "zh-CN": {
    eyebrow: "知识档案 // 在线",
    title: "算法知识库",
    description:
      "搜索简明知识笔记、复杂度规则和 C++14 模板。每个条目都可返回对应的教学关卡。",
    all: "全部条目",
    search: "搜索概念、标签或关卡",
    discovered: "已掌握",
    preview: "预览",
    entries: "条目",
    completion: "知识库进度",
    noMatches: "没有符合当前条件的知识条目。",
    time: "时间",
    space: "空间",
    checklist: "解题检查表",
    implementation: "参考实现 // C++14",
    relatedQuest: "相关关卡",
    openQuest: "打开关卡",
    unavailableQuest: "相关关卡记录不可用",
    reading: "正在阅读",
  },
  ja: {
    eyebrow: "リファレンスアーカイブ // ONLINE",
    title: "アルゴリズム CODEX",
    description:
      "要点、計算量、C++14 パターンを検索できます。各項目から対応する学習クエストへ戻れます。",
    all: "すべて",
    search: "概念・タグ・クエストを検索",
    discovered: "習得済み",
    preview: "プレビュー",
    entries: "ファイル",
    completion: "アーカイブ進捗",
    noMatches: "条件に一致する CODEX ファイルがありません。",
    time: "時間",
    space: "空間",
    checklist: "チェックリスト",
    implementation: "参考実装 // C++14",
    relatedQuest: "関連クエスト",
    openQuest: "クエストを開く",
    unavailableQuest: "関連クエストを利用できません",
    reading: "閲覧中",
  },
} as const;

type CategoryFilter = "all" | CodexCategory;

export function CodexLibrary({
  locale,
  questCatalog,
  cleared,
  onOpenQuest,
}: {
  locale: Locale;
  questCatalog: Quest[];
  cleared: Set<string>;
  onOpenQuest: (questId: string) => void;
}) {
  const copy = copies[locale];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState(codexEntries[0].id);

  const questById = useMemo(
    () => new Map(questCatalog.map((quest) => [quest.id, quest])),
    [questCatalog],
  );

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return codexEntries.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      if (!normalized) return true;
      const quest = questById.get(entry.questId);
      const searchable = [
        localizeCodex(entry.title, locale),
        localizeCodex(entry.summary, locale),
        entry.tags.join(" "),
        quest?.title ?? "",
        quest?.skills.join(" ") ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(normalized);
    });
  }, [category, locale, query, questById]);

  const selected =
    filteredEntries.find((entry) => entry.id === selectedId) ??
    filteredEntries[0];
  const discoveredCount = codexEntries.filter((entry) =>
    cleared.has(entry.questId),
  ).length;
  const progress = Math.round((discoveredCount / codexEntries.length) * 100);
  const relatedQuest = selected ? questById.get(selected.questId) : undefined;

  return (
    <section className="codex-section" id="codex" aria-labelledby="codex-title">
      <div className="codex-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id="codex-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="codex-progress" aria-label={`${copy.completion}: ${progress}%`}>
          <div>
            <span>{copy.completion}</span>
            <strong>{String(progress).padStart(3, "0")}%</strong>
          </div>
          <div className="codex-progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <small>
            {discoveredCount} / {codexEntries.length} {copy.entries}
          </small>
        </div>
      </div>

      <div className="codex-toolbar">
        <label className="codex-search">
          <span>&gt; SEARCH_</span>
          <input
            type="search"
            value={query}
            placeholder={copy.search}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="codex-filters" aria-label="Codex categories">
          <button
            type="button"
            className={category === "all" ? "is-active" : ""}
            onClick={() => setCategory("all")}
          >
            [ {copy.all} ]
          </button>
          {codexCategories.map((item) => (
            <button
              type="button"
              className={category === item.id ? "is-active" : ""}
              key={item.id}
              onClick={() => setCategory(item.id)}
            >
              [ {localizeCodex(item.label, locale)} ]
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="codex-layout">
          <nav className="codex-index" aria-label="Codex entries">
            <div className="codex-index-heading">
              <span>INDEX.dat</span>
              <strong>{filteredEntries.length}</strong>
            </div>
            <div className="codex-entry-list">
              {filteredEntries.map((entry) => {
                const discovered = cleared.has(entry.questId);
                return (
                  <button
                    type="button"
                    key={entry.id}
                    className={selected.id === entry.id ? "is-active" : ""}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <span className="codex-entry-marker">{entry.marker}</span>
                    <span>
                      <strong>{localizeCodex(entry.title, locale)}</strong>
                      <small>{entry.tags.slice(0, 3).join(" / ")}</small>
                    </span>
                    <em className={discovered ? "is-discovered" : ""}>
                      {discovered ? copy.discovered : copy.preview}
                    </em>
                  </button>
                );
              })}
            </div>
          </nav>

          <article className="codex-reader page-transition" key={selected.id}>
            <header className="codex-reader-bar">
              <span>
                {copy.reading}{" // "}{selected.marker}
              </span>
              <span>{selected.category.toUpperCase()}</span>
            </header>
            <div className="codex-reader-body">
              <div className="codex-title-row">
                <div>
                  <p>{localizeCodex(selected.summary, locale)}</p>
                  <h3>{localizeCodex(selected.title, locale)}</h3>
                </div>
                <span
                  className={`codex-state ${
                    cleared.has(selected.questId) ? "is-discovered" : ""
                  }`}
                >
                  {cleared.has(selected.questId) ? copy.discovered : copy.preview}
                </span>
              </div>

              <p className="codex-explanation">
                {localizeCodex(selected.explanation, locale)}
              </p>

              <div className="codex-complexity">
                <div>
                  <span>{copy.time}</span>
                  <strong>{selected.timeComplexity}</strong>
                </div>
                <div>
                  <span>{copy.space}</span>
                  <strong>{selected.spaceComplexity}</strong>
                </div>
              </div>

              <section className="codex-checklist">
                <h4>{copy.checklist}</h4>
                <ul>
                  {selected.checkpoints.map((checkpoint) => (
                    <li key={checkpoint.en}>
                      <span>[ ]</span>
                      {localizeCodex(checkpoint, locale)}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="codex-code">
                <div>
                  <span>{copy.implementation}</span>
                  <span>main.cpp</span>
                </div>
                <pre>
                  <code>{selected.code}</code>
                </pre>
              </section>

              <div className="codex-tags">
                {selected.tags.map((tag) => (
                  <code key={tag}>#{tag}</code>
                ))}
              </div>

              <div className="codex-quest-link">
                <div>
                  <span>{copy.relatedQuest}</span>
                  {relatedQuest ? (
                    <strong>
                      QUEST {relatedQuest.index}{" // "}{relatedQuest.title}
                    </strong>
                  ) : (
                    <strong>{copy.unavailableQuest}</strong>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!relatedQuest}
                  onClick={() => onOpenQuest(selected.questId)}
                >
                  &gt; {copy.openQuest}_
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : (
        <div className="codex-empty">&gt; {copy.noMatches}</div>
      )}
    </section>
  );
}

