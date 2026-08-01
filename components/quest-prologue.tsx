"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { Quest } from "@/lib/quests";
import { buildQuestStory } from "@/lib/quest-story";

const copy = {
  en: {
    tutorial: "FIRST MISSION // INTERFACE TRAINING",
    required: "REQUIRED ONCE",
    story: "STORY PROLOGUE",
    skip: "SKIP STORY",
    next: "NEXT",
    begin: "ENTER MISSION",
    progress: "TRAINING",
    tutorialSteps: [
      ["READ THE BRIEF", "The left pane contains the story, knowledge guide, input, output and samples. Read the contract before touching code.", "BRIEF"],
      ["WRITE IN MAIN.CPP", "The center editor behaves like VS Code: indentation, bracket colors, matching and cloud draft autosave are already active.", "EDITOR"],
      ["RUN THE SAMPLE", "Use RUN SAMPLE for the visible example. It helps you catch formatting and syntax mistakes without spending a full submission.", "SAMPLE"],
      ["SUBMIT TO THE JUDGE", "SUBMIT SOLUTION compiles real C++14 in isolation and runs every hidden test. AC unlocks the route; WA only reveals the verdict.", "JUDGE"],
      ["RETURN, REVIEW, REPLAY", "Your code and verdict history remain saved. Editorials open beside the problem, and the STORY button can replay this prologue later.", "HISTORY"],
    ],
  },
  "zh-CN": {
    tutorial: "首次关卡 // 网页操作训练",
    required: "仅强制一次",
    story: "关卡序章",
    skip: "跳过故事",
    next: "下一步",
    begin: "进入关卡",
    progress: "训练进度",
    tutorialSteps: [
      ["阅读任务", "左侧包含故事、知识指导、输入输出和样例。动手前先确认题目要求。", "题面"],
      ["在 MAIN.CPP 编程", "中央编辑器拥有类似 VS Code 的自动缩进、括号配色与匹配；草稿会自动保存到云端。", "编辑器"],
      ["运行样例", "“运行样例”只检查可见样例，适合先排除格式与语法问题，不会浪费一次完整提交。", "样例"],
      ["提交给评测机", "“提交答案”会在隔离环境编译真实 C++14，并运行全部隐藏测试。AC 解锁路线；WA 只显示状态。", "评测"],
      ["返回、复盘、重玩", "源码与评测历史会保留；题解区位于题面旁，之后也可点击“故事”重播本关序章。", "历史"],
    ],
  },
  ja: {
    tutorial: "初回クエスト // 画面トレーニング",
    required: "初回のみ必須",
    story: "クエスト序章",
    skip: "物語をスキップ",
    next: "次へ",
    begin: "クエスト開始",
    progress: "訓練進度",
    tutorialSteps: [
      ["任務を読む", "左ペインには物語、学習ガイド、入出力、サンプルがあります。コードを書く前に条件を確認します。", "問題"],
      ["MAIN.CPP に書く", "中央エディタは VS Code のように自動インデント、括弧色分け、対応表示を行い、下書きをクラウド保存します。", "エディタ"],
      ["サンプル実行", "サンプル実行で公開例を確認し、完全提出の前に構文や出力形式のミスを探します。", "サンプル"],
      ["ジャッジへ提出", "提出すると隔離環境で本物の C++14 をコンパイルし、全隠しケースを実行します。AC でルートが開きます。", "ジャッジ"],
      ["戻る・復習・再演", "ソースと判定履歴は保存されます。Editorial は問題の隣にあり、STORY ボタンで序章を再生できます。", "履歴"],
    ],
  },
} as const;

export function QuestPrologue({
  quest,
  locale,
  tutorialRequired,
  onTutorialComplete,
  onStoryComplete,
  onClose,
}: {
  quest: Quest;
  locale: Locale;
  tutorialRequired: boolean;
  onTutorialComplete: () => Promise<void> | void;
  onStoryComplete: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"tutorial" | "story">(
    tutorialRequired ? "tutorial" : "story",
  );
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const ui = copy[locale];
  const scenes = useMemo(() => buildQuestStory(quest, locale), [locale, quest]);
  const tutorialStep = ui.tutorialSteps[index];
  const scene = scenes[index];
  const total = phase === "tutorial" ? ui.tutorialSteps.length : scenes.length;

  const finishStory = async () => {
    setBusy(true);
    try {
      await onStoryComplete();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const advance = async () => {
    if (index + 1 < total) {
      setIndex((current) => current + 1);
      return;
    }
    if (phase === "tutorial") {
      setBusy(true);
      try {
        await onTutorialComplete();
        setPhase("story");
        setIndex(0);
      } finally {
        setBusy(false);
      }
      return;
    }
    await finishStory();
  };

  return (
    <div
      className={`prologue-overlay prologue-overlay--${phase}`}
      role="presentation"
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !busy) {
          event.preventDefault();
          void advance();
        }
      }}
    >
      <section
        className={`prologue-dialog ${scene ? `prologue-dialog--${scene.effect}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prologue-title"
      >
        <header className="prologue-header">
          <span>{phase === "tutorial" ? ui.tutorial : ui.story}</span>
          <strong>{phase === "tutorial" ? ui.required : `QUEST_${quest.index}`}</strong>
        </header>

        {phase === "tutorial" && tutorialStep ? (
          <div className="tutorial-scene">
            <div className="tutorial-web-map" aria-hidden="true">
              {ui.tutorialSteps.map((step, stepIndex) => (
                <span className={stepIndex === index ? "is-active" : ""} key={step[2]}>
                  {step[2]}
                </span>
              ))}
            </div>
            <div className="tutorial-copy">
              <p>{`${ui.progress} // ${index + 1} / ${total}`}</p>
              <h2 id="prologue-title">{tutorialStep[0]}</h2>
              <p>{tutorialStep[1]}</p>
            </div>
          </div>
        ) : scene ? (
          <div className={`story-scene story-scene--${scene.mode}`}>
            <div className="story-stage" aria-hidden="true">
              <span>{scene.note}</span>
              <pre>{scene.glyph}</pre>
              <i />
              <i />
              <i />
            </div>
            <div className="story-dialogue-box">
              <span>{scene.speaker}</span>
              <h2 id="prologue-title">{quest.title}</h2>
              <p>{scene.text}</p>
            </div>
          </div>
        ) : null}

        <footer className="prologue-footer">
          <div className="prologue-dots" aria-label={`${index + 1} / ${total}`}>
            {Array.from({ length: total }, (_, dot) => (
              <i className={dot === index ? "is-active" : ""} key={dot} />
            ))}
          </div>
          <div>
            {phase === "story" && (
              <button type="button" disabled={busy} onClick={() => void finishStory()}>
                [ {ui.skip} ]
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => void advance()} autoFocus>
              [ {phase === "story" && index + 1 === total ? ui.begin : ui.next} ]
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
