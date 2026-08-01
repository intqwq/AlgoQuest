"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EditorialRichText } from "@/components/editorial-rich-text";
import {
  AdminQuestRecord,
  archiveAdminQuest,
  EditorialPost,
  JudgeQuestDefinition,
  loadEditorialModeration,
  loadAdminQuests,
  loadManagedPlayers,
  loadServerOverview,
  ManagedPlayer,
  moderateEditorialPost,
  Player,
  saveAdminQuest,
  ServerOverview,
  updateManagedPlayer,
  updateServerSettings,
} from "@/lib/api-client";
import type { Locale } from "@/lib/i18n";
import type { Quest } from "@/lib/quests";

type Tab = "players" | "quests" | "editorial" | "server";

const copies = {
  en: {
    title: "CONTROL DECK",
    players: "PLAYERS",
    quests: "QUESTS",
    server: "SERVER",
    editorial: "MODERATION",
    search: "Search name or email",
    save: "SAVE CHANGES",
    verified: "EMAIL VERIFIED",
    role: "ACCOUNT ROLE",
    submissions: "SUBMISSIONS",
    cleared: "CLEARED",
    newQuest: "ADD QUEST",
    editQuest: "EDIT QUEST",
    archive: "ARCHIVE QUEST",
    restoreHint: "Archived quests stay in the database and disappear from the player map.",
    publicFields: "PUBLIC QUEST INFORMATION",
    judgeFields: "TRUSTED JUDGE TESTS",
    builtInTests: "Built-in hidden tests remain on the Judge service.",
    testJson: "TEST CASES JSON",
    registration: "ALLOW REGISTRATION",
    judge: "JUDGE ENABLED",
    cooldown: "SUBMISSION COOLDOWN (SECONDS)",
    maintenance: "MAINTENANCE MESSAGE",
    refresh: "REFRESH",
    close: "CLOSE",
    approve: "APPROVE",
    reject: "REJECT",
    noPending: "NO POSTS WAITING FOR REVIEW.",
  },
  "zh-CN": {
    title: "管理控制台",
    players: "玩家",
    quests: "关卡",
    server: "服务器",
    editorial: "内容审核",
    search: "搜索玩家名或邮箱",
    save: "保存更改",
    verified: "邮箱已验证",
    role: "账号身份",
    submissions: "提交数",
    cleared: "通关数",
    newQuest: "增添关卡",
    editQuest: "编辑关卡",
    archive: "归档关卡",
    restoreHint: "归档不会清除数据库记录，但玩家地图将不再显示该关卡。",
    publicFields: "玩家可见的关卡信息",
    judgeFields: "仅服务端可见的评测数据",
    builtInTests: "内置隐藏测试继续安全保存在 Judge 服务中。",
    testJson: "测试点 JSON",
    registration: "允许注册",
    judge: "启用评测",
    cooldown: "提交冷却（秒）",
    maintenance: "维护通知",
    refresh: "刷新",
    close: "关闭",
    approve: "通过并发布",
    reject: "拒绝",
    noPending: "目前没有等待审核的内容。",
  },
  ja: {
    title: "管理コンソール",
    players: "プレイヤー",
    quests: "クエスト",
    server: "サーバー",
    editorial: "投稿審査",
    search: "名前またはメールを検索",
    save: "変更を保存",
    verified: "メール認証済み",
    role: "アカウント権限",
    submissions: "提出数",
    cleared: "クリア数",
    newQuest: "クエスト追加",
    editQuest: "クエスト編集",
    archive: "クエストをアーカイブ",
    restoreHint: "アーカイブ後もDB記録は残り、プレイヤーマップから非表示になります。",
    publicFields: "公開クエスト情報",
    judgeFields: "サーバー限定ジャッジデータ",
    builtInTests: "組み込み隠しテストは Judge サービスに安全に残ります。",
    testJson: "テストケース JSON",
    registration: "登録を許可",
    judge: "ジャッジ有効",
    cooldown: "提出クールダウン（秒）",
    maintenance: "メンテナンス通知",
    refresh: "更新",
    close: "閉じる",
    approve: "承認して公開",
    reject: "却下",
    noPending: "審査待ちの投稿はありません。",
  },
} as const;

function blankQuest(index: number): Quest {
  const id = `custom-quest-${Date.now().toString(36)}`;
  return {
    id,
    index: String(index).padStart(2, "0"),
    title: "New Quest",
    subtitle: "Custom mission",
    difficulty: 1,
    xp: 100,
    status: "locked",
    prerequisites: [],
    chapter: "CUSTOM / CAMPAIGN",
    gridArea: id,
    mapPosition: { x: 50, y: 50 },
    description: "Describe the new mission.",
    skills: ["C++14"],
    sortOrder: index,
    translations: {
      "zh-CN": {
        title: "新关卡",
        subtitle: "自定义任务",
        description: "请填写关卡描述。",
      },
      ja: {
        title: "新しいクエスト",
        subtitle: "カスタムミッション",
        description: "クエストの説明を入力してください。",
      },
    },
    problem: {
      story: ["Explain the challenge and its place in the adventure."],
      guidance: ["Read the input and output.", "Implement the solution.", "Run the sample, then submit."],
      input: "Describe the input.",
      constraints: "Describe the constraints.",
      output: "Describe the output.",
      sampleInput: "1",
      sampleOutput: "1",
      hint: "Add a useful hint.",
      hintMarker: "    // TODO: solve the quest",
      hintCode: "    cout << 1 << '\\n';",
      starterCode:
        "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    // TODO: solve the quest\n    return 0;\n}\n",
      testCaseCount: 1,
      passScore: 100,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  };
}

function defaultJudge(quest: Quest): JudgeQuestDefinition {
  return {
    language: "cpp14",
    timeLimitMs: Math.round((quest.problem?.timeLimitSeconds ?? 1) * 1000),
    memoryLimitMb: quest.problem?.memoryLimitMb ?? 64,
    compileLimitMs: 15000,
    passScore: quest.problem?.passScore ?? 100,
    tests: [
      {
        id: "01",
        input: `${quest.problem?.sampleInput ?? ""}\n`,
        expected: `${quest.problem?.sampleOutput ?? ""}\n`,
      },
    ],
  };
}

function PlayerEditor({
  item,
  owner,
  copy,
  onSaved,
}: {
  item: ManagedPlayer;
  owner: boolean;
  copy: (typeof copies)[Locale];
  onSaved: (player: ManagedPlayer) => void;
}) {
  const [name, setName] = useState(item.displayName);
  const [verified, setVerified] = useState(item.emailVerified);
  const [role, setRole] = useState<"player" | "admin">(
    item.role === "admin" ? "admin" : "player",
  );
  const [busy, setBusy] = useState(false);

  return (
    <article className={`managed-player managed-player--${item.role}`}>
      <div className="managed-player__heading">
        <strong>{item.displayName}</strong>
        <span>{item.role.toUpperCase()}</span>
      </div>
      <code>{item.email}</code>
      <div className="managed-player__stats">
        <span>{copy.cleared}: {item.clearedCount}</span>
        <span>{copy.submissions}: {item.submissionCount}</span>
      </div>
      <label>
        DISPLAY NAME
        <input value={name} maxLength={64} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={verified}
          onChange={(event) => setVerified(event.target.checked)}
        />
        {copy.verified}
      </label>
      {owner && item.role !== "owner" && (
        <label>
          {copy.role}
          <select value={role} onChange={(event) => setRole(event.target.value as "player" | "admin")}>
            <option value="player">PLAYER</option>
            <option value="admin">ADMIN</option>
          </select>
        </label>
      )}
      <button
        type="button"
        disabled={busy || item.role === "owner"}
        onClick={() => {
          setBusy(true);
          void updateManagedPlayer(item.id, {
            displayName: name,
            emailVerified: verified,
            role,
          })
            .then((updated) => onSaved({ ...item, ...updated }))
            .finally(() => setBusy(false));
        }}
      >
        [ {copy.save} ]
      </button>
    </article>
  );
}

export function AdminConsole({
  player,
  locale,
  builtInQuests,
  onCatalogChange,
}: {
  player?: Player;
  locale: Locale;
  builtInQuests: Quest[];
  onCatalogChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("players");
  const [players, setPlayers] = useState<ManagedPlayer[]>([]);
  const [records, setRecords] = useState<AdminQuestRecord[]>([]);
  const [server, setServer] = useState<ServerOverview>();
  const [editorials, setEditorials] = useState<EditorialPost[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [questDraft, setQuestDraft] = useState<Quest>();
  const [judgeDraft, setJudgeDraft] = useState<JudgeQuestDefinition | null>(null);
  const [testsText, setTestsText] = useState("[]");
  const [translationsText, setTranslationsText] = useState("{}");
  const [creating, setCreating] = useState(false);
  const copy = copies[locale];
  const allowed = player?.role === "admin" || player?.role === "owner";

  const refreshPlayers = useCallback(() => {
    return loadManagedPlayers(query).then(setPlayers);
  }, [query]);
  const refreshQuests = useCallback(async () => {
    const nextRecords = await loadAdminQuests();
    setRecords(nextRecords);
    return nextRecords;
  }, []);
  const refreshServer = useCallback(() => loadServerOverview().then(setServer), []);
  const refreshEditorials = useCallback(
    () => loadEditorialModeration("pending").then(setEditorials),
    [],
  );
  const selectQuest = useCallback(
    (quest: Quest, record?: AdminQuestRecord, isNew = false) => {
      const publicCopy = structuredClone(quest);
      const judgeCopy = record?.judgeDefinition
        ? structuredClone(record.judgeDefinition)
        : isNew
          ? defaultJudge(publicCopy)
          : null;
      setSelectedId(quest.id);
      setQuestDraft(publicCopy);
      setJudgeDraft(judgeCopy);
      setTestsText(JSON.stringify(judgeCopy?.tests ?? [], null, 2));
      setTranslationsText(JSON.stringify(publicCopy.translations ?? {}, null, 2));
      setCreating(isNew);
      setMessage("");
    },
    [],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      if (!allowed) return;
      const detail = (event as CustomEvent<{ questId?: string }>).detail;
      setOpen(true);
      if (detail?.questId) {
        setTab("quests");
        void refreshQuests()
          .then((nextRecords) => {
            const record = nextRecords.find((item) => item.id === detail.questId);
            const quest =
              record?.publicDefinition ??
              builtInQuests.find((item) => item.id === detail.questId);
            if (quest) selectQuest(quest, record);
          })
          .catch((error) =>
            setMessage(error instanceof Error ? error.message : "QUEST LINK FAILED"),
          );
      }
      setMessage("");
    };
    window.addEventListener("algoquest:open-admin", handler);
    return () => window.removeEventListener("algoquest:open-admin", handler);
  }, [allowed, builtInQuests, refreshQuests, selectQuest]);

  /* eslint-disable react-hooks/set-state-in-effect -- remote tab synchronization */
  useEffect(() => {
    if (!open) return;
    const load =
      tab === "players"
        ? refreshPlayers()
        : tab === "quests"
          ? refreshQuests()
          : tab === "editorial"
            ? refreshEditorials()
            : refreshServer();
    void load.catch((error) =>
      setMessage(error instanceof Error ? error.message : "CONTROL LINK FAILED"),
    );
  }, [open, refreshEditorials, refreshPlayers, refreshQuests, refreshServer, tab]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const questOptions = useMemo(() => {
    const overrides = new Map(records.map((record) => [record.id, record]));
    const merged = builtInQuests.map((quest) => ({
      quest: overrides.get(quest.id)?.publicDefinition ?? quest,
      record: overrides.get(quest.id),
      builtIn: true,
    }));
    for (const record of records) {
      if (!builtInQuests.some((quest) => quest.id === record.id)) {
        merged.push({
          quest: record.publicDefinition,
          record,
          builtIn: false,
        });
      }
    }
    return merged.sort(
      (left, right) =>
        (left.quest.sortOrder ?? Number(left.quest.index) ?? 9999) -
        (right.quest.sortOrder ?? Number(right.quest.index) ?? 9999),
    );
  }, [builtInQuests, records]);

  const saveQuest = async (event: FormEvent) => {
    event.preventDefault();
    if (!questDraft?.problem) return;
    setMessage("");
    try {
      let publicDefinition: Quest = {
        ...questDraft,
        translations: JSON.parse(translationsText),
      };
      let nextJudge = judgeDraft;
      if (judgeDraft) {
        const tests = JSON.parse(testsText) as JudgeQuestDefinition["tests"];
        nextJudge = {
          ...judgeDraft,
          tests,
          timeLimitMs: Math.round(questDraft.problem.timeLimitSeconds * 1000),
          memoryLimitMb: questDraft.problem.memoryLimitMb,
          passScore: questDraft.problem.passScore,
        };
        publicDefinition = {
          ...publicDefinition,
          problem: {
            ...publicDefinition.problem!,
            testCaseCount: tests.length,
          },
        };
      }
      await saveAdminQuest(
        questDraft.id,
        publicDefinition,
        nextJudge,
        creating,
      );
      setCreating(false);
      setMessage("QUEST CATALOG UPDATED");
      await refreshQuests();
      onCatalogChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QUEST SAVE FAILED");
    }
  };

  if (!allowed) return null;

  return (
    <>
      {open && (
        <div className="admin-overlay">
          <section className={`admin-console admin-console--${player?.role}`} role="dialog" aria-modal="true">
            <header>
              <div>
                <span>{player?.role === "owner" ? "SITE_OWNER.sys" : "ADMIN.sys"}</span>
                <h2>{copy.title}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)}>[ {copy.close} ]</button>
            </header>
            <nav>
              {(["players", "quests", "editorial"] as Tab[]).map((item) => (
                <button
                  key={item}
                  className={tab === item ? "is-active" : ""}
                  onClick={() => setTab(item)}
                >
                  [ {copy[item]} ]
                </button>
              ))}
              {player?.role === "owner" && (
                <button className={tab === "server" ? "is-active" : ""} onClick={() => setTab("server")}>
                  [ {copy.server} ]
                </button>
              )}
            </nav>
            {message && <p className="admin-message">{message}</p>}

            {tab === "players" && (
              <div className="admin-content">
                <form
                  className="admin-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void refreshPlayers();
                  }}
                >
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} />
                  <button>[ {copy.search} ]</button>
                </form>
                <div className="managed-player-grid">
                  {players.map((item) => (
                    <PlayerEditor
                      key={item.id}
                      item={item}
                      owner={player?.role === "owner"}
                      copy={copy}
                      onSaved={(updated) =>
                        setPlayers((current) =>
                          current.map((candidate) => candidate.id === updated.id ? updated : candidate),
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === "quests" && (
              <div className="admin-content admin-quest-layout">
                <aside className="admin-quest-list">
                  <button
                    className="admin-add-quest"
                    onClick={() => selectQuest(blankQuest(builtInQuests.length + records.length + 1), undefined, true)}
                  >
                    + {copy.newQuest}
                  </button>
                  {questOptions.map(({ quest, record }) => (
                    <button
                      key={quest.id}
                      className={selectedId === quest.id ? "is-active" : ""}
                      onClick={() => selectQuest(quest, record)}
                    >
                      <span>{quest.index}</span>
                      <strong>{quest.title}</strong>
                      <small>{record?.archived ? "ARCHIVED" : "ACTIVE"}</small>
                    </button>
                  ))}
                </aside>
                {questDraft?.problem ? (
                  <form className="admin-quest-form" onSubmit={saveQuest}>
                    <h3>{creating ? copy.newQuest : copy.editQuest}</h3>
                    <p className="admin-section-label">{copy.publicFields}</p>
                    <div className="admin-form-grid">
                      <label>ID<input value={questDraft.id} disabled={!creating} onChange={(event) => setQuestDraft({ ...questDraft, id: event.target.value })} /></label>
                      <label>INDEX<input value={questDraft.index} onChange={(event) => setQuestDraft({ ...questDraft, index: event.target.value })} /></label>
                      <label>TITLE (EN)<input value={questDraft.title} onChange={(event) => setQuestDraft({ ...questDraft, title: event.target.value })} /></label>
                      <label>SUBTITLE (EN)<input value={questDraft.subtitle} onChange={(event) => setQuestDraft({ ...questDraft, subtitle: event.target.value })} /></label>
                      <label>难度 / 難易度<input type="number" min={1} max={5} value={questDraft.difficulty} onChange={(event) => setQuestDraft({ ...questDraft, difficulty: Number(event.target.value) as Quest["difficulty"] })} /></label>
                      <label>XP<input type="number" min={0} value={questDraft.xp} onChange={(event) => setQuestDraft({ ...questDraft, xp: Number(event.target.value) })} /></label>
                      <label>MAP X<input type="number" min={2} max={98} value={questDraft.mapPosition.x} onChange={(event) => setQuestDraft({ ...questDraft, mapPosition: { ...questDraft.mapPosition, x: Number(event.target.value) } })} /></label>
                      <label>MAP Y<input type="number" min={2} max={98} value={questDraft.mapPosition.y} onChange={(event) => setQuestDraft({ ...questDraft, mapPosition: { ...questDraft.mapPosition, y: Number(event.target.value) } })} /></label>
                    </div>
                    <label>PREREQUISITES (comma separated)<input value={questDraft.prerequisites.join(", ")} onChange={(event) => setQuestDraft({ ...questDraft, prerequisites: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
                    <label>DESCRIPTION (EN)<textarea value={questDraft.description} onChange={(event) => setQuestDraft({ ...questDraft, description: event.target.value })} /></label>
                    <label>STORY (one paragraph per line)<textarea value={questDraft.problem.story.join("\n")} onChange={(event) => setQuestDraft({ ...questDraft, problem: { ...questDraft.problem!, story: event.target.value.split("\n").filter(Boolean) } })} /></label>
                    <label>GUIDANCE (one step per line)<textarea value={questDraft.problem.guidance.join("\n")} onChange={(event) => setQuestDraft({ ...questDraft, problem: { ...questDraft.problem!, guidance: event.target.value.split("\n").filter(Boolean) } })} /></label>
                    <div className="admin-form-grid">
                      <label>PASS SCORE<input type="number" min={1} max={100} value={questDraft.problem.passScore} onChange={(event) => setQuestDraft({ ...questDraft, problem: { ...questDraft.problem!, passScore: Number(event.target.value) } })} /></label>
                      <label>TIME (s)<input type="number" min={0.1} max={10} step={0.1} value={questDraft.problem.timeLimitSeconds} onChange={(event) => setQuestDraft({ ...questDraft, problem: { ...questDraft.problem!, timeLimitSeconds: Number(event.target.value) } })} /></label>
                      <label>MEMORY (MB)<input type="number" min={16} max={512} value={questDraft.problem.memoryLimitMb} onChange={(event) => setQuestDraft({ ...questDraft, problem: { ...questDraft.problem!, memoryLimitMb: Number(event.target.value) } })} /></label>
                    </div>
                    <label>STARTER CODE<textarea className="admin-code-input" value={questDraft.problem.starterCode} onChange={(event) => setQuestDraft({ ...questDraft, problem: { ...questDraft.problem!, starterCode: event.target.value } })} /></label>
                    <label>TRANSLATIONS JSON<textarea className="admin-code-input" value={translationsText} onChange={(event) => setTranslationsText(event.target.value)} /></label>
                    <p className="admin-section-label">{copy.judgeFields}</p>
                    {judgeDraft ? (
                      <label>{copy.testJson}<textarea className="admin-code-input admin-tests-input" value={testsText} onChange={(event) => setTestsText(event.target.value)} /></label>
                    ) : (
                      <p className="admin-secure-note">{copy.builtInTests}</p>
                    )}
                    <div className="admin-quest-actions">
                      <button type="submit">[ {copy.save} ]</button>
                      {!creating && (
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => {
                            void (async () => {
                              const existing = records.find((item) => item.id === questDraft.id);
                              if (!existing) {
                                await saveAdminQuest(questDraft.id, questDraft, null, false);
                              }
                              await archiveAdminQuest(questDraft.id);
                              await refreshQuests();
                              setQuestDraft(undefined);
                              onCatalogChange();
                            })().catch((error) => setMessage(error instanceof Error ? error.message : "ARCHIVE FAILED"));
                          }}
                        >
                          [ {copy.archive} ]
                        </button>
                      )}
                    </div>
                    <p className="admin-secure-note">{copy.restoreHint}</p>
                  </form>
                ) : (
                  <div className="admin-empty">&gt; SELECT_OR_CREATE_QUEST</div>
                )}
              </div>
            )}

            {tab === "editorial" && (
              <div className="admin-content moderation-list">
                {editorials.length ? editorials.map((post) => (
                  <article key={post.id} className="moderation-card">
                    <div>
                      <span>{`${post.kind.toUpperCase()} // ${post.questId}`}</span>
                      <strong className={`editorial-role editorial-role--${post.author.role}`}>
                        {`${post.author.role.toUpperCase()} // ${post.author.displayName}`}
                      </strong>
                    </div>
                    <h3>{post.title}</h3>
                    <EditorialRichText
                      content={post.content}
                      contentFormat={post.contentFormat}
                      className="moderation-card__content"
                    />
                    <time>{new Date(post.createdAt).toLocaleString()}</time>
                    <div>
                      <button
                        type="button"
                        onClick={() => void moderateEditorialPost(post.id, "published")
                          .then(() => refreshEditorials())
                          .catch((error) => setMessage(error instanceof Error ? error.message : "MODERATION FAILED"))}
                      >
                        [ {copy.approve} ]
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void moderateEditorialPost(post.id, "rejected")
                          .then(() => refreshEditorials())
                          .catch((error) => setMessage(error instanceof Error ? error.message : "MODERATION FAILED"))}
                      >
                        [ {copy.reject} ]
                      </button>
                    </div>
                  </article>
                )) : <div className="admin-empty">&gt; {copy.noPending}</div>}
              </div>
            )}

            {tab === "server" && player?.role === "owner" && server && (
              <form
                className="admin-content owner-server"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void updateServerSettings({
                    registrationEnabled: form.get("registrationEnabled") === "on",
                    judgeEnabled: form.get("judgeEnabled") === "on",
                    maintenanceMessage: String(form.get("maintenanceMessage") ?? ""),
                    submissionCooldownSeconds: Number(form.get("submissionCooldownSeconds") ?? 5),
                  }).then((settings) => setServer({ ...server, settings }));
                }}
              >
                <div className="server-stat-grid">
                  {Object.entries(server.statistics).map(([key, value]) => (
                    <div key={key}><span>{key.toUpperCase()}</span><strong>{Number(value).toLocaleString()}</strong></div>
                  ))}
                </div>
                <div className="server-runtime">
                  <code>{server.runtime.platform} / {server.runtime.architecture}</code>
                  <code>{server.runtime.node}</code>
                  <code>UPTIME {server.runtime.uptimeSeconds}s</code>
                </div>
                <label className="admin-check"><input name="registrationEnabled" type="checkbox" defaultChecked={server.settings.registrationEnabled} />{copy.registration}</label>
                <label className="admin-check"><input name="judgeEnabled" type="checkbox" defaultChecked={server.settings.judgeEnabled} />{copy.judge}</label>
                <label>{copy.cooldown}<input name="submissionCooldownSeconds" type="number" min={5} max={300} defaultValue={server.settings.submissionCooldownSeconds} /></label>
                <label>{copy.maintenance}<textarea name="maintenanceMessage" maxLength={240} defaultValue={server.settings.maintenanceMessage} /></label>
                <button>[ {copy.save} ]</button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
