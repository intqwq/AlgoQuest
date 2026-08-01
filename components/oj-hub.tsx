"use client";

import Editor from "@monaco-editor/react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  adminUpdateOjProblem,
  archiveOjProblem,
  AuthApiError,
  deleteOjProblem,
  JudgeSubmissionState,
  loadJudgeSubmission,
  loadMyOjProblems,
  loadOjModeration,
  loadOjProblem,
  loadOjProblems,
  loadOjTags,
  moderateOjProblem,
  OjProblem,
  OjProblemDraft,
  OjProblemInput,
  OjProblemStatus,
  OjProblemSummary,
  OjTagCategory,
  OjTestCase,
  Player,
  resubmitOjProblem,
  submitOjProblem,
  submitOjSolution,
} from "@/lib/api-client";
import {
  EditorialComposer,
  EditorialRichText,
  emptyEditorialDocument,
  richEditorialContentFormat,
} from "@/components/editorial-rich-text";
import type { Locale } from "@/lib/i18n";

type OjView = "index" | "problem" | "submit" | "mine" | "review";

const copy = {
  en: {
    eyebrow: "COMMUNITY ONLINE JUDGE", title: "Problem Archive", subtitle: "Search, solve, and publish original algorithm problems.",
    index: "PROBLEMS", submitProblem: "SUBMIT PROBLEM", mine: "MY PROBLEMS", review: "REVIEW QUEUE",
    search: "ID or title", allDifficulty: "All difficulties", allTags: "All tags", filter: "SEARCH",
    id: "ID", problem: "PROBLEM", difficulty: "DIFFICULTY", tags: "TAGS", acceptance: "ACCEPTANCE", noProblems: "No matching problems.",
    previous: "PREVIOUS", next: "NEXT", back: "BACK TO INDEX", author: "AUTHOR", limits: "LIMITS", samples: "SAMPLES",
    input: "INPUT", output: "OUTPUT", solution: "YOUR C++14 SOLUTION", submit: "SUBMIT SOLUTION", login: "LOGIN TO SUBMIT",
    queued: "Submission accepted by queue.", status: "STATUS", cases: "TEST CASES", compiler: "COMPILER OUTPUT",
    problemTitle: "Problem title", statement: "Problem statement", time: "Time limit (ms)", memory: "Memory limit (MB)",
    chooseTags: "Algorithm tags", tagSearch: "Search tags", std: "Standard C++14 solution", tests: "TEST DATA",
    addCase: "ADD TEST", sample: "Public sample", remove: "REMOVE", sendReview: "SEND FOR REVIEW", updateReview: "UPDATE & RESUBMIT",
    required: "Add a title, a complete statement, 1–12 tags, standard code, and at least one public sample test.",
    submitted: "Problem sent to the moderation queue.", pending: "PENDING", published: "PUBLISHED", rejected: "REJECTED",
    publicId: "PUBLIC ID", awaitingId: "Assigned after approval", reviewNote: "Review note", approve: "APPROVE & ASSIGN ID", reject: "REJECT",
    emptyMine: "You have not submitted a problem yet.", emptyReview: "The review queue is clear.", edit: "EDIT & RESUBMIT",
    hidden: "Hidden judge data", stdSource: "Standard solution", testCount: "tests", loadError: "OJ service is temporarily unavailable.",
    runSample: "RUN THIS SAMPLE", received: "ACTUAL OUTPUT", expected: "EXPECTED OUTPUT", stderr: "RUNTIME DIAGNOSTICS",
    modify: "MODIFY", archive: "ARCHIVE", restore: "RESTORE", delete: "DELETE PERMANENTLY", archived: "ARCHIVED",
    confirmDelete: "Permanently delete this problem and its drafts? This cannot be undone.", tagCategories: "TAG CATEGORIES",
  },
  "zh-CN": {
    eyebrow: "社区在线评测", title: "OJ 题库", subtitle: "检索与挑战题目，也可以提交你的原创算法题。",
    index: "题目列表", submitProblem: "提交题目", mine: "我的投稿", review: "审核队列",
    search: "输入题号或标题", allDifficulty: "全部难度", allTags: "全部标签", filter: "查找",
    id: "题号", problem: "题目", difficulty: "难度", tags: "算法标签", acceptance: "通过率", noProblems: "没有符合条件的题目。",
    previous: "上一页", next: "下一页", back: "返回题库", author: "出题人", limits: "限制", samples: "样例",
    input: "输入", output: "输出", solution: "提交 C++14 代码", submit: "提交评测", login: "登录后提交",
    queued: "提交已进入评测队列。", status: "状态", cases: "测试点", compiler: "编译器输出",
    problemTitle: "题目标题", statement: "题面（请完整描述输入、输出、约束）", time: "时间限制（ms）", memory: "空间限制（MB）",
    chooseTags: "算法标签", tagSearch: "搜索标签", std: "C++14 标准代码答案", tests: "测试点与对应答案",
    addCase: "添加测试点", sample: "公开为样例", remove: "删除", sendReview: "提交管理员审核", updateReview: "修改并重新审核",
    required: "请填写标题、完整题面、1–12 个标签、std，并至少将一个测试点设为公开样例。",
    submitted: "题目已进入管理员审核队列。", pending: "审核中", published: "已通过", rejected: "未通过",
    publicId: "公开题号", awaitingId: "审核通过后分配", reviewNote: "审核意见", approve: "通过并分配题号", reject: "驳回",
    emptyMine: "你还没有投稿题目。", emptyReview: "当前没有待审核题目。", edit: "修改并重新提交",
    hidden: "仅审核与判题服务可见", stdSource: "标准代码", testCount: "个测试点", loadError: "OJ 服务暂时不可用。",
    runSample: "运行此样例", received: "实际输出", expected: "期望输出", stderr: "运行时诊断",
    modify: "管理员修改", archive: "归档", restore: "恢复", delete: "永久删除", archived: "已归档",
    confirmDelete: "确定永久删除这道题及其修订吗？此操作不可撤销。", tagCategories: "标签分类",
  },
  ja: {
    eyebrow: "コミュニティ・オンラインジャッジ", title: "OJ 問題庫", subtitle: "問題を検索して解き、オリジナル問題も投稿できます。",
    index: "問題一覧", submitProblem: "問題を投稿", mine: "自分の投稿", review: "審査キュー",
    search: "問題番号またはタイトル", allDifficulty: "すべての難易度", allTags: "すべてのタグ", filter: "検索",
    id: "番号", problem: "問題", difficulty: "難易度", tags: "タグ", acceptance: "正解率", noProblems: "該当する問題はありません。",
    previous: "前へ", next: "次へ", back: "問題一覧へ", author: "作問者", limits: "制限", samples: "サンプル",
    input: "入力", output: "出力", solution: "C++14 解答", submit: "提出する", login: "ログインして提出",
    queued: "ジャッジキューに入りました。", status: "状態", cases: "テスト", compiler: "コンパイラ出力",
    problemTitle: "問題タイトル", statement: "問題文（入出力と制約を含む）", time: "時間制限（ms）", memory: "メモリ制限（MB）",
    chooseTags: "アルゴリズムタグ", tagSearch: "タグを検索", std: "C++14 標準解答", tests: "テストデータ",
    addCase: "テストを追加", sample: "公開サンプル", remove: "削除", sendReview: "審査に提出", updateReview: "更新して再審査",
    required: "タイトル、完全な問題文、1〜12個のタグ、標準解答、公開サンプルを入力してください。",
    submitted: "管理者の審査キューに送信しました。", pending: "審査中", published: "公開済み", rejected: "却下",
    publicId: "公開番号", awaitingId: "承認時に割り当て", reviewNote: "審査コメント", approve: "承認して番号を付与", reject: "却下",
    emptyMine: "投稿した問題はありません。", emptyReview: "審査待ちはありません。", edit: "修正して再提出",
    hidden: "審査・ジャッジ専用", stdSource: "標準解答", testCount: "テスト", loadError: "OJ サービスを利用できません。",
    runSample: "このサンプルを実行", received: "実際の出力", expected: "期待される出力", stderr: "実行時診断",
    modify: "管理者編集", archive: "アーカイブ", restore: "復元", delete: "完全に削除", archived: "アーカイブ済み",
    confirmDelete: "この問題と改訂を完全に削除しますか？元に戻せません。", tagCategories: "タグ分類",
  },
} as const;

const difficultyNames = {
  en: ["Starter", "Easy", "Basic", "Intermediate", "Challenging", "Advanced", "Expert", "Master", "Olympiad", "Legend"],
  "zh-CN": ["入门", "简单", "基础", "普及", "提高", "进阶", "省选", "NOI", "国际竞赛", "传说"],
  ja: ["入門", "易しい", "基礎", "中級", "挑戦", "上級", "エキスパート", "マスター", "五輪級", "伝説"],
} as const;

const defaultCode = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`;

const blankTest = (sample = false): OjTestCase => ({ input: "", expected: "", sample });

function errorText(error: unknown, fallback: string) {
  return error instanceof AuthApiError ? error.code : error instanceof Error ? error.message : fallback;
}

function Difficulty({ value, locale }: { value: number; locale: Locale }) {
  return (
    <span className={`oj-difficulty oj-difficulty--${value}`}>
      <span>{String(value).padStart(2, "0")}</span>
      {difficultyNames[locale][value - 1]}
    </span>
  );
}

export function OjHub({
  player,
  locale,
  onLogin,
}: {
  player?: Player;
  locale: Locale;
  onLogin: () => void;
}) {
  const c = copy[locale];
  const canSubmit = Boolean(player && !player.isGuest && player.emailVerified);
  const canManage = player?.role === "admin" || player?.role === "owner";
  const [view, setView] = useState<OjView>("index");
  const [tags, setTags] = useState<string[]>([]);
  const [tagCategories, setTagCategories] = useState<OjTagCategory[]>([]);
  const [problems, setProblems] = useState<OjProblemSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState(0);
  const [tag, setTag] = useState("");
  const [filters, setFilters] = useState({ query: "", difficulty: 0, tag: "" });
  const [selected, setSelected] = useState<OjProblem>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [mine, setMine] = useState<OjProblemDraft[]>([]);
  const [reviewQueue, setReviewQueue] = useState<OjProblemDraft[]>([]);
  const [reviewStatus, setReviewStatus] = useState<OjProblemStatus>("pending");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [code, setCode] = useState(defaultCode);
  const [judge, setJudge] = useState<JudgeSubmissionState>();
  const [judging, setJudging] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [adminEditing, setAdminEditing] = useState(false);
  const [statementTextLength, setStatementTextLength] = useState(0);
  const [statementTooLarge, setStatementTooLarge] = useState(false);
  const [activeSample, setActiveSample] = useState<number>();
  const [form, setForm] = useState<OjProblemInput>({
    title: "",
    statement: emptyEditorialDocument,
    statementFormat: richEditorialContentFormat,
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    difficulty: 3,
    tags: [],
    tests: [blankTest(true), blankTest(false)],
    stdSource: defaultCode,
  });

  const refreshIndex = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadOjProblems({
        query: filters.query,
        difficulty: filters.difficulty || undefined,
        tag: filters.tag,
        page,
        limit: 30,
      });
      setProblems(result.problems);
      setTotal(result.total);
      setMessage("");
    } catch (error) {
      setMessage(errorText(error, c.loadError));
    } finally {
      setLoading(false);
    }
  }, [c.loadError, filters, page]);

  useEffect(() => {
    void loadOjTags()
      .then((result) => { setTags(result.tags); setTagCategories(result.categories); })
      .catch(() => { setTags([]); setTagCategories([]); });
  }, []);

  useEffect(() => {
    if (view !== "index") return;
    const timer = window.setTimeout(() => void refreshIndex(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshIndex, view]);

  useEffect(() => {
    if (view === "mine" && canSubmit) {
      const timer = window.setTimeout(() => {
        setLoading(true);
        void loadMyOjProblems()
          .then((items) => { setMine(items); setMessage(""); })
          .catch((error) => setMessage(errorText(error, c.loadError)))
          .finally(() => setLoading(false));
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [c.loadError, canSubmit, view]);

  useEffect(() => {
    if (view === "review" && canManage) {
      const timer = window.setTimeout(() => {
        setLoading(true);
        void loadOjModeration(reviewStatus)
          .then((items) => { setReviewQueue(items); setMessage(""); })
          .catch((error) => setMessage(errorText(error, c.loadError)))
          .finally(() => setLoading(false));
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [c.loadError, canManage, reviewStatus, view]);

  const visibleTags = useMemo(() => {
    const normalized = tagQuery.trim().toLowerCase();
    return tags.filter((item) => !normalized || item.toLowerCase().includes(normalized)).slice(0, 48);
  }, [tagQuery, tags]);

  const visibleTagCategories = useMemo(() => {
    const available = new Set(visibleTags);
    if (!tagCategories.length) {
      return [{ id: "all", label: { en: "Algorithms", "zh-CN": "算法", ja: "アルゴリズム" }, tags: visibleTags }];
    }
    return tagCategories
      .map((category) => ({ ...category, tags: category.tags.filter((item) => available.has(item)) }))
      .filter((category) => category.tags.length);
  }, [tagCategories, visibleTags]);

  const openProblem = async (publicId: number) => {
    setLoading(true);
    try {
      setSelected(await loadOjProblem(publicId));
      setJudge(undefined);
      setCode(defaultCode);
      setView("problem");
      setMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage(errorText(error, c.loadError));
    } finally {
      setLoading(false);
    }
  };

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilters({ query: query.trim(), difficulty, tag });
  };

  const toggleTag = (value: string) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(value)
        ? current.tags.filter((item) => item !== value)
        : current.tags.length < 12 ? [...current.tags, value] : current.tags,
    }));
  };

  const updateTest = (index: number, update: Partial<OjTestCase>) => {
    setForm((current) => ({
      ...current,
      tests: current.tests.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item),
    }));
  };

  const resetForm = () => {
    setEditingId(undefined);
    setAdminEditing(false);
    setStatementTextLength(0);
    setStatementTooLarge(false);
    setForm({
      title: "", statement: emptyEditorialDocument, statementFormat: richEditorialContentFormat,
      timeLimitMs: 1000, memoryLimitMb: 256,
      difficulty: 3, tags: [], tests: [blankTest(true), blankTest(false)], stdSource: defaultCode,
    });
  };

  const editDraft = (problem: OjProblemDraft, asAdmin = false) => {
    setEditingId(problem.id);
    setAdminEditing(asAdmin);
    setForm({
      title: problem.title,
      statement: problem.statement,
      statementFormat: problem.statementFormat ?? "plain",
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
      difficulty: problem.difficulty,
      tags: problem.tags,
      tests: problem.tests.map((item) => ({ ...item })),
      stdSource: problem.stdSource,
    });
    setView("submit");
    setMessage(problem.reviewNote);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sendProblem = async (event: FormEvent) => {
    event.preventDefault();
    if (
      form.title.trim().length < 3 || statementTextLength < 20 || statementTooLarge ||
      !form.stdSource.trim() || form.tags.length < 1 || form.tags.length > 12 ||
      !form.tests.length || !form.tests.some((item) => item.sample)
    ) {
      setMessage(c.required);
      return;
    }
    setLoading(true);
    try {
      const wasAdminEditing = Boolean(editingId && adminEditing);
      if (wasAdminEditing) await adminUpdateOjProblem(editingId!, form);
      else if (editingId) await resubmitOjProblem(editingId, form);
      else await submitOjProblem(form);
      resetForm();
      setMessage(c.submitted);
      setView(wasAdminEditing ? "review" : "mine");
    } catch (error) {
      setMessage(errorText(error, c.loadError));
    } finally {
      setLoading(false);
    }
  };

  const judgeSolution = async (sampleIndex?: number) => {
    if (!selected || judging) return;
    if (!canSubmit) { onLogin(); return; }
    setJudging(true);
    setActiveSample(sampleIndex);
    try {
      let state = await submitOjSolution(
        selected.publicId,
        code,
        sampleIndex === undefined ? { mode: "submit" } : { mode: "sample", sampleIndex },
      );
      setJudge(state);
      setMessage(c.queued);
      let polls = 0;
      while (!["DONE", "ERROR"].includes(state.status) && polls < 180) {
        await new Promise((resolve) => window.setTimeout(resolve, state.pollAfterMs ?? 1000));
        state = await loadJudgeSubmission(state.id);
        setJudge(state);
        polls += 1;
      }
    } catch (error) {
      setMessage(errorText(error, c.loadError));
    } finally {
      setJudging(false);
      setActiveSample(undefined);
    }
  };

  const reviewProblem = async (problemId: string, status: "published" | "rejected") => {
    setLoading(true);
    try {
      const reviewNote = reviewNotes[problemId] ?? "";
      await moderateOjProblem(problemId, status, reviewNote);
      setReviewQueue((current) => current.filter((item) => item.id !== problemId));
      setMessage(status === "published" ? c.published : c.rejected);
      if (status === "published") void refreshIndex();
    } catch (error) {
      setMessage(errorText(error, c.loadError));
    } finally {
      setLoading(false);
    }
  };

  const archiveProblem = async (problemId: string) => {
    setLoading(true);
    try {
      await archiveOjProblem(problemId);
      setReviewQueue((current) => current.filter((item) => item.id !== problemId));
      setMessage(c.archived);
      void refreshIndex();
    } catch (error) {
      setMessage(errorText(error, c.loadError));
    } finally {
      setLoading(false);
    }
  };

  const removeProblem = async (problemId: string) => {
    if (!window.confirm(c.confirmDelete)) return;
    setLoading(true);
    try {
      await deleteOjProblem(problemId);
      setReviewQueue((current) => current.filter((item) => item.id !== problemId));
      setMine((current) => current.filter((item) => item.id !== problemId));
      setMessage(c.delete);
      void refreshIndex();
    } catch (error) {
      setMessage(errorText(error, c.loadError));
    } finally {
      setLoading(false);
    }
  };

  const acceptance = (problem: OjProblemSummary) => problem.submissionCount
    ? `${Math.round((problem.acceptedCount / problem.submissionCount) * 100)}%`
    : "—";

  return (
    <section className="oj-shell" id="oj-top">
      <header className="oj-hero">
        <div>
          <p className="eyebrow">{c.eyebrow}</p>
          <h1>{c.title}<span>.exe</span></h1>
          <p>{c.subtitle}</p>
        </div>
        <div className="oj-hero-stat"><strong>{total}</strong><span>ONLINE PROBLEMS</span></div>
      </header>

      <nav className="oj-tabs" aria-label="OJ navigation">
        <button className={view === "index" || view === "problem" ? "is-active" : ""} onClick={() => setView("index")}>[ {c.index} ]</button>
        <button onClick={() => canSubmit ? setView("submit") : onLogin()}>[ {c.submitProblem} ]</button>
        {canSubmit && <button className={view === "mine" ? "is-active" : ""} onClick={() => setView("mine")}>[ {c.mine} ]</button>}
        {canManage && <button className={view === "review" ? "is-active" : ""} onClick={() => setView("review")}>[ {c.review} ]</button>}
      </nav>

      {message && <div className="oj-message" role="status">{message}</div>}

      {view === "index" && (
        <div className="oj-index">
          <form className="oj-filters" onSubmit={applySearch}>
            <label><span>{c.search}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="1000 / A+B" /></label>
            <label><span>{c.difficulty}</span><select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))}><option value={0}>{c.allDifficulty}</option>{difficultyNames[locale].map((name, index) => <option value={index + 1} key={name}>{index + 1}{" // "}{name}</option>)}</select></label>
            <label><span>{c.tags}</span><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">{c.allTags}</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button type="submit">&gt; {c.filter}_</button>
          </form>
          <div className="oj-table" role="table" aria-label={c.index}>
            <div className="oj-table__head" role="row"><span>{c.id}</span><span>{c.problem}</span><span>{c.difficulty}</span><span>{c.tags}</span><span>{c.acceptance}</span></div>
            {!loading && !problems.length && <div className="oj-empty">{c.noProblems}</div>}
            {problems.map((problem) => (
              <button className="oj-problem-row" role="row" key={problem.publicId} onClick={() => void openProblem(problem.publicId)}>
                <strong>#{problem.publicId}</strong>
                <span className="oj-problem-name"><b>{problem.title}</b><small>{problem.author.displayName}</small></span>
                <Difficulty value={problem.difficulty} locale={locale} />
                <span className="oj-row-tags">{problem.tags.slice(0, 3).map((item) => <em key={item}>{item}</em>)}</span>
                <span>{acceptance(problem)}<small>{problem.acceptedCount}/{problem.submissionCount}</small></span>
              </button>
            ))}
          </div>
          <div className="oj-pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>[ {c.previous} ]</button><span>PAGE {page} / {Math.max(1, Math.ceil(total / 30))}</span><button disabled={page * 30 >= total} onClick={() => setPage((value) => value + 1)}>[ {c.next} ]</button></div>
        </div>
      )}

      {view === "problem" && selected && (
        <div className="oj-problem-view">
          <button className="oj-back" onClick={() => setView("index")}>← {c.back}</button>
          <article className="oj-statement">
            <header><div><span>OJ #{selected.publicId}</span><h2>{selected.title}</h2></div><Difficulty value={selected.difficulty} locale={locale} /></header>
            <div className="oj-problem-meta"><span>{c.author}: <strong>{selected.author.displayName}</strong></span><span>{c.limits}: <strong>{selected.timeLimitMs} ms / {selected.memoryLimitMb} MB</strong></span><span>{c.acceptance}: <strong>{acceptance(selected)}</strong></span></div>
            <EditorialRichText
              content={selected.statement}
              contentFormat={selected.statementFormat ?? "plain"}
              className="oj-statement-text"
            />
            <div className="oj-statement-tags">{selected.tags.map((item) => <code key={item}>{item}</code>)}</div>
            <h3>{c.samples}</h3>
            {selected.samples.map((sample, index) => <div className="oj-sample" key={sample.id ?? `${sample.input}-${index}`}><div><span>{c.input} #{index + 1}</span><pre>{sample.input}</pre></div><div><span>{c.output} #{index + 1}</span><pre>{sample.output}</pre></div><button type="button" className="oj-run-sample" disabled={judging} onClick={() => void judgeSolution(index)}>{judging && activeSample === index ? `[ ${judge?.status ?? "QUEUED"} ]` : `[ ${c.runSample} #${index + 1} ]`}</button></div>)}
          </article>
          <section className="oj-code-panel">
            <div className="oj-code-panel__bar"><span>● main.cpp</span><span>GNU++14{" // "}UTF-8</span></div>
            <Editor height="480px" language="cpp" theme="vs-dark" value={code} onChange={(value) => setCode(value ?? "")} options={{ automaticLayout: true, fontSize: 14, minimap: { enabled: true }, tabSize: 4, insertSpaces: true, bracketPairColorization: { enabled: true }, scrollBeyondLastLine: false }} />
            <button className="oj-submit-code" disabled={judging} onClick={() => void judgeSolution()}>{canSubmit ? (judging && activeSample === undefined ? `[ ${judge?.status ?? "QUEUED"} ]` : `> ${c.submit}_`) : `[ ${c.login} ]`}</button>
          </section>
          {judge && <section className={`oj-result oj-result--${judge.verdict === "AC" ? "ac" : "other"}`}><header><span>{c.status}</span><strong>{judge.verdict ?? judge.status}</strong><span>{judge.score ?? 0}/100</span></header>{judge.compilerOutput && <div><h3>{c.compiler}</h3><pre>{judge.compilerOutput}</pre></div>}{judge.error && <div><h3>{c.stderr}</h3><pre>{judge.error}</pre></div>}<div><h3>{c.cases}</h3><div className="oj-case-grid">{judge.cases.map((item) => <details key={item.id} open={judge.cases.length === 1 && item.verdict !== "AC"}><summary><b>#{item.id}</b><em>{item.verdict}</em><small>{item.timeMs ?? 0} ms / {item.memoryKb ?? 0} KB</small></summary>{item.input !== undefined && <div><h4>{c.input}</h4><pre>{item.input}</pre></div>}{item.expected !== undefined && <div><h4>{c.expected}</h4><pre>{item.expected}</pre></div>}{item.received !== undefined && <div><h4>{c.received}</h4><pre>{item.received}</pre></div>}{item.stderr && <div><h4>{c.stderr}{item.exitCode !== undefined ? ` // EXIT ${item.exitCode}` : ""}{item.signal ? ` // SIGNAL ${item.signal}` : ""}</h4><pre>{item.stderr}</pre></div>}</details>)}</div></div></section>}
        </div>
      )}

      {view === "submit" && canSubmit && (
        <form className="oj-authoring" onSubmit={sendProblem}>
          <header><div><p className="eyebrow">PROBLEM FORGE</p><h2>{adminEditing ? c.modify : editingId ? c.updateReview : c.submitProblem}</h2></div><span>{c.hidden}</span></header>
          <div className="oj-form-grid">
            <label className="oj-wide"><span>{c.problemTitle}</span><input required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label><span>{c.time}</span><input type="number" min={100} max={10000} step={100} value={form.timeLimitMs} onChange={(event) => setForm({ ...form, timeLimitMs: Number(event.target.value) })} /></label>
            <label><span>{c.memory}</span><input type="number" min={16} max={512} step={16} value={form.memoryLimitMb} onChange={(event) => setForm({ ...form, memoryLimitMb: Number(event.target.value) })} /></label>
            <label><span>{c.difficulty}</span><select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: Number(event.target.value) })}>{difficultyNames[locale].map((name, index) => <option value={index + 1} key={name}>{index + 1}{" // "}{name}</option>)}</select></label>
            <div className="oj-wide oj-rich-statement"><span>{c.statement}</span><EditorialComposer
              key={editingId ?? "new-oj-problem"}
              locale={locale}
              disabled={loading}
              initialContent={form.statement}
              contentFormat={form.statementFormat}
              documentKey={editingId ?? "new-oj-problem"}
              placeholder={c.statement}
              onChange={(statement, count, tooLarge) => {
                setStatementTextLength(count);
                setStatementTooLarge(tooLarge);
                setForm((current) => ({ ...current, statement, statementFormat: richEditorialContentFormat }));
              }}
            /></div>
          </div>
          <section className="oj-tag-picker"><div><strong>{c.chooseTags}</strong><span>{form.tags.length}/12</span></div><input value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} placeholder={c.tagSearch} /><div className="oj-selected-tags">{form.tags.map((item) => <button type="button" key={item} onClick={() => toggleTag(item)}>{item} ×</button>)}</div><div className="oj-tag-categories"><span>{c.tagCategories}</span>{visibleTagCategories.map((category) => <section key={category.id}><h3>{category.label[locale]}</h3><div className="oj-tag-options">{category.tags.map((item) => <button type="button" className={form.tags.includes(item) ? "is-selected" : ""} key={item} onClick={() => toggleTag(item)}>{item}</button>)}</div></section>)}</div></section>
          <section className="oj-test-editor"><header><div><strong>{c.tests}</strong><span>{form.tests.length}/50 {c.testCount}</span></div><button type="button" disabled={form.tests.length >= 50} onClick={() => setForm({ ...form, tests: [...form.tests, blankTest()] })}>+ {c.addCase}</button></header>{form.tests.map((item, index) => <article key={index}><div className="oj-test-number"><strong>#{String(index + 1).padStart(2, "0")}</strong><label><input type="checkbox" checked={item.sample} onChange={(event) => updateTest(index, { sample: event.target.checked })} /> {c.sample}</label><button type="button" disabled={form.tests.length <= 1} onClick={() => setForm({ ...form, tests: form.tests.filter((_, itemIndex) => itemIndex !== index) })}>{c.remove}</button></div><label><span>{c.input}</span><textarea value={item.input} onChange={(event) => updateTest(index, { input: event.target.value })} /></label><label><span>{c.output}</span><textarea value={item.expected} onChange={(event) => updateTest(index, { expected: event.target.value })} /></label></article>)}</section>
          <label className="oj-std"><span>{c.std}</span><textarea required rows={18} maxLength={64 * 1024} value={form.stdSource} onChange={(event) => setForm({ ...form, stdSource: event.target.value })} /></label>
          <p className="oj-authoring-note">{c.required}</p><button className="primary-button" disabled={loading || statementTooLarge} type="submit">&gt; {adminEditing ? c.modify : editingId ? c.updateReview : c.sendReview}_</button>
        </form>
      )}

      {view === "mine" && canSubmit && <div className="oj-private-list"><header><p className="eyebrow">AUTHOR CONSOLE</p><h2>{c.mine}</h2></header>{!loading && !mine.length && <div className="oj-empty">{c.emptyMine}</div>}{mine.map((problem) => <article key={problem.id}><div><span className={`oj-status oj-status--${problem.status}`}>{c[problem.status]}</span><h3>{problem.title}</h3><p>{problem.publicId ? `${c.publicId}: #${problem.publicId}` : c.awaitingId}</p>{problem.reviewNote && <blockquote><strong>{c.reviewNote}</strong>{problem.reviewNote}</blockquote>}</div><div className="oj-private-actions"><span>{new Date(problem.updatedAt).toLocaleString()}</span>{problem.status !== "archived" && <button onClick={() => editDraft(problem)}>[ {c.edit} ]</button>}{problem.publicId && <button onClick={() => void openProblem(problem.publicId!)}>[ #{problem.publicId} ]</button>}</div></article>)}</div>}

      {view === "review" && canManage && <div className="oj-review"><header><div><p className="eyebrow">MODERATION DECK</p><h2>{c.review}</h2></div><select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as OjProblemStatus)}><option value="pending">{c.pending}</option><option value="published">{c.published}</option><option value="rejected">{c.rejected}</option><option value="archived">{c.archived}</option></select></header>{!loading && !reviewQueue.length && <div className="oj-empty">{c.emptyReview}</div>}{reviewQueue.map((problem) => <article key={problem.id}><header><div><span>{problem.author.displayName}{" // "}{new Date(problem.createdAt).toLocaleString()}</span><h3>{problem.title}</h3></div><Difficulty value={problem.difficulty} locale={locale} /></header><div className="oj-review-meta"><span>{problem.timeLimitMs} ms</span><span>{problem.memoryLimitMb} MB</span><span>{problem.tests.length} {c.testCount}</span>{problem.tags.map((item) => <code key={item}>{item}</code>)}</div><EditorialRichText content={problem.statement} contentFormat={problem.statementFormat ?? "plain"} className="oj-review-statement" /><details><summary>{c.tests}{" // "}{c.hidden}</summary>{problem.tests.map((item, index) => <div className="oj-review-test" key={index}><strong>#{index + 1}{item.sample ? " // SAMPLE" : ""}</strong><pre>{item.input}</pre><pre>{item.expected}</pre></div>)}</details><details><summary>{c.stdSource}{" // "}GNU++14</summary><pre className="oj-review-code">{problem.stdSource}</pre></details>{reviewStatus === "pending" && <div className="oj-review-actions"><textarea placeholder={c.reviewNote} value={reviewNotes[problem.id] ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [problem.id]: event.target.value }))} /><button className="is-approve" disabled={loading} onClick={() => void reviewProblem(problem.id, "published")}>{c.approve}</button><button className="is-reject" disabled={loading} onClick={() => void reviewProblem(problem.id, "rejected")}>{c.reject}</button></div>}<div className="oj-admin-actions"><button type="button" onClick={() => editDraft(problem, true)}>[ {c.modify} ]</button>{problem.status !== "archived" && <button type="button" onClick={() => void archiveProblem(problem.id)}>[ {c.archive} ]</button>}<button type="button" className="is-danger" onClick={() => void removeProblem(problem.id)}>[ {c.delete} ]</button></div></article>)}</div>}
    </section>
  );
}
