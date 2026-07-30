"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { AccountPanel } from "@/components/account-panel";
import {
  loadCurrentPlayer,
  loadPlayerSave,
  PlayerSave,
  Player,
  resolvePlayerSave,
  SaveSubmission,
  saveQuestDraft,
  saveQuestProgress,
} from "@/lib/api-client";
import { isQuestUnlocked, Quest, QuestStatus, quests } from "@/lib/quests";
import {
  addSubmission,
  hasSaveData,
  loadLocalPlayerSave,
  markQuestCleared,
  persistLocalPlayerSave,
  replaceDraft,
  saveSummary,
  savesConflict,
} from "@/lib/player-save";

const MissionTerminal = dynamic(
  () =>
    import("@/components/mission-terminal").then(
      (module) => module.MissionTerminal,
    ),
  {
    ssr: false,
    loading: () => (
      <section className="mission-loading">LOADING MISSION WORKBENCH...</section>
    ),
  },
);

const logo = String.raw`
    _    _              ___                  _
   /_\  | | __ _  ___  / _ \ _   _  ___ ___| |_
  //_\\ | |/ _' |/ _ \| | | | | | |/ _ / __| __|
 /  _  \| | (_| | (_) | |_| | |_| |  __\__ \ |_
 \_/ \_/_|\__, |\___/ \__\_\\__,_|\___|___/\__|
          |___/`;

function Difficulty({ value }: { value: number }) {
  return (
    <span className="difficulty" aria-label={`Difficulty ${value} of 5`}>
      {"◆".repeat(value)}
      <span>{"◇".repeat(5 - value)}</span>
    </span>
  );
}

function QuestNode({
  quest,
  selected,
  completed,
  playable,
  displayStatus,
  onSelect,
  onOpen,
}: {
  quest: Quest;
  selected: boolean;
  completed: boolean;
  playable: boolean;
  displayStatus: QuestStatus;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const disabled = displayStatus === "secret";
  return (
    <button
      className={`quest-node quest-node--${displayStatus} ${
        selected ? "is-selected" : ""
      } ${completed ? "is-completed" : ""} ${playable ? "is-playable" : ""}`}
      style={{ gridArea: quest.gridArea }}
      onClick={playable ? onOpen : onSelect}
      disabled={disabled}
      aria-label={
        playable
          ? `${quest.title}, playable, enter mission`
          : `${quest.title}, ${displayStatus}`
      }
    >
      <span className="node-cap">
        {completed
          ? "[CLEARED]"
          : playable
            ? "[PLAYABLE]"
          : displayStatus === "locked"
            ? "[LOCKED]"
            : `[${quest.index}]`}
      </span>
      <span className="node-core">
        {displayStatus === "secret" ? "?" : quest.index}
      </span>
      <strong>{quest.title}</strong>
      <small>{quest.subtitle}</small>
      {playable && <span className="node-action">&gt; ENTER</span>}
    </button>
  );
}

type SaveConflict = {
  local: PlayerSave;
  cloud: PlayerSave;
};

function openAccount(view: "login" | "register" = "login") {
  window.dispatchEvent(
    new CustomEvent("algoquest:open-account", { detail: { view } }),
  );
}

function SaveCard({
  label,
  save,
}: {
  label: "LOCAL SAVE" | "CLOUD SAVE";
  save: PlayerSave;
}) {
  const summary = saveSummary(save);
  const latestDraft = [...save.drafts].sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  )[0];
  return (
    <div className="save-card">
      <div className="save-card__heading">
        <strong>{label}</strong>
        <span>{label === "LOCAL SAVE" ? "THIS DEVICE" : "PLAYER DATABASE"}</span>
      </div>
      <dl>
        <div>
          <dt>CLEARED</dt>
          <dd>{summary.cleared} QUESTS</dd>
        </div>
        <div>
          <dt>DRAFTS</dt>
          <dd>{summary.drafts} FILES</dd>
        </div>
        <div>
          <dt>EVALUATIONS</dt>
          <dd>{summary.submissions} RECORDS</dd>
        </div>
        <div>
          <dt>LAST UPDATE</dt>
          <dd>
            {Date.parse(summary.updatedAt)
              ? new Date(summary.updatedAt).toLocaleString()
              : "EMPTY"}
          </dd>
        </div>
        <div>
          <dt>LATEST CODE</dt>
          <dd>
            {latestDraft
              ? `${latestDraft.questId} // ${latestDraft.source.split("\n").length} lines`
              : "NO DRAFT"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function Home() {
  const [selected, setSelected] = useState<Quest>(quests[0]);
  const [notice, setNotice] = useState("ACCOUNT REQUIRED // WELCOME MODE");
  const [screen, setScreen] = useState<"world" | "mission">("world");
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [player, setPlayer] = useState<Player>();
  const [playerSave, setPlayerSave] = useState<PlayerSave>();
  const [saveConflict, setSaveConflict] = useState<SaveConflict>();
  const [syncingSave, setSyncingSave] = useState(false);
  const [saveError, setSaveError] = useState("");

  const canPlay = Boolean(
    player && !player.isGuest && player.emailVerified && playerSave,
  );

  const applySave = useCallback((save: PlayerSave) => {
    persistLocalPlayerSave(save);
    setPlayerSave(save);
    setCleared(
      new Set(
        save.progress
          .filter((item) => item.status === "cleared")
          .map((item) => item.questId),
      ),
    );
    setSaveConflict(undefined);
    setSaveError("");
    setNotice("SAVE SYNCHRONIZED // SELECT A QUEST");
  }, []);

  const refreshAccountProgress = useCallback(() => {
    setSyncingSave(true);
    setSaveError("");
    void loadCurrentPlayer()
      .then(async (currentPlayer) => {
        setPlayer(currentPlayer);
        if (
          !currentPlayer ||
          currentPlayer.isGuest ||
          !currentPlayer.emailVerified
        ) {
          setPlayerSave(undefined);
          setCleared(new Set());
          setSaveConflict(undefined);
          setScreen("world");
          setNotice(
            currentPlayer && !currentPlayer.isGuest
              ? "EMAIL VERIFICATION REQUIRED // WELCOME MODE"
              : "ACCOUNT REQUIRED // WELCOME MODE",
          );
          return;
        }

        const [cloud, local] = await Promise.all([
          loadPlayerSave(),
          Promise.resolve(loadLocalPlayerSave(currentPlayer.id)),
        ]);
        if (savesConflict(local, cloud)) {
          setPlayerSave(undefined);
          setCleared(new Set());
          setSaveConflict({ local, cloud });
          setNotice("SAVE CONFLICT // PLAYER DECISION REQUIRED");
          return;
        }

        const canonical =
          hasSaveData(local) && !hasSaveData(cloud)
            ? await resolvePlayerSave("local", local)
            : cloud;
        applySave(canonical);
      })
      .catch((error) => {
        setPlayerSave(undefined);
        setSaveError(
          error instanceof Error ? error.message : "Save service unavailable.",
        );
        setNotice("SAVE LINK OFFLINE // GAMEPLAY LOCKED");
      })
      .finally(() => setSyncingSave(false));
  }, [applySave]);

  useEffect(() => {
    // Initial authentication and save hydration intentionally update page state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshAccountProgress();
  }, [refreshAccountProgress]);

  useEffect(() => {
    const syncScreenFromHash = () => {
      const missionId = window.location.hash.match(/^#mission\/([a-z0-9-]+)$/)?.[1];
      const mission = quests.find(
        (quest) => quest.id === missionId && quest.problem,
      );
      if (mission && canPlay && isQuestUnlocked(mission, cleared)) {
        setSelected(mission);
        setScreen("mission");
      } else {
        setScreen("world");
        if (mission && !canPlay) {
          window.history.replaceState(null, "", "#top");
        }
      }
    };

    syncScreenFromHash();
    window.addEventListener("hashchange", syncScreenFromHash);
    return () => window.removeEventListener("hashchange", syncScreenFromHash);
  }, [canPlay, cleared]);

  const chooseSave = async (choice: "local" | "cloud") => {
    if (!saveConflict) return;
    setSyncingSave(true);
    setSaveError("");
    try {
      const canonical = await resolvePlayerSave(choice, saveConflict.local);
      applySave(canonical);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Save resolution failed.",
      );
    } finally {
      setSyncingSave(false);
    }
  };

  const completeQuest = (questId: string, score: number) => {
    setPlayerSave((current) => {
      if (!current) return current;
      const updated = markQuestCleared(current, questId, score);
      persistLocalPlayerSave(updated);
      setCleared(
        new Set(
          updated.progress
            .filter((item) => item.status === "cleared")
            .map((item) => item.questId),
        ),
      );
      return updated;
    });
    void saveQuestProgress(questId, score).catch(() => {
      setNotice("AC SAVED LOCALLY // CLOUD RETRY REQUIRED");
    });
  };

  const saveDraft = useCallback((questId: string, source: string) => {
    const localDraft = {
      questId,
      source,
      updatedAt: new Date().toISOString(),
    };
    setPlayerSave((current) => {
      if (!current) return current;
      const updated = replaceDraft(current, localDraft);
      persistLocalPlayerSave(updated);
      return updated;
    });
    void saveQuestDraft(questId, source)
      .then((cloudDraft) => {
        setPlayerSave((current) => {
          if (!current) return current;
          const updated = replaceDraft(current, cloudDraft);
          persistLocalPlayerSave(updated);
          return updated;
        });
      })
      .catch(() => setNotice("DRAFT SAVED LOCALLY // CLOUD LINK RETRYING"));
  }, []);

  const recordSubmission = useCallback((submission: SaveSubmission) => {
    setPlayerSave((current) => {
      if (!current) return current;
      const updated = addSubmission(current, submission);
      persistLocalPlayerSave(updated);
      return updated;
    });
  }, []);

  const openQuest = (quest: Quest) => {
    if (!canPlay) {
      setNotice("LOGIN REQUIRED // MISSIONS REMAIN LOCKED");
      openAccount("login");
      return;
    }
    if (!isQuestUnlocked(quest, cleared)) {
      setSelected(quest);
      setNotice(
        quest.status === "secret"
          ? "ANOMALY DETECTED // ACCESS CONDITION UNKNOWN"
          : `ACCESS DENIED // CLEAR ${quest.prerequisites.join(", ").toUpperCase()}`,
      );
      return;
    }
    setSelected(quest);
    setNotice(`QUEST ${quest.index} LAUNCHED // JUDGE LINK ACTIVE`);
    setScreen("mission");
    window.history.replaceState(null, "", `#mission/${quest.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exitMission = () => {
    setScreen("world");
    setNotice(
      cleared.has(selected.id)
        ? `QUEST ${selected.index} CLEARED // ROUTE UPDATED`
        : "MISSION SUSPENDED // PROGRESS KEPT",
    );
    window.history.replaceState(null, "", "#map");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const playableQuests = quests.filter((quest) =>
    isQuestUnlocked(quest, cleared),
  );
  const nextQuest =
    playableQuests.find((quest) => !cleared.has(quest.id)) ??
    playableQuests.at(-1) ??
    quests[0];
  const nextAfterSelected = quests.find((quest) =>
    quest.prerequisites.includes(selected.id),
  );
  const totalXp = quests
    .filter((quest) => cleared.has(quest.id))
    .reduce((sum, quest) => sum + quest.xp, 0);
  const selectedPlayable = isQuestUnlocked(selected, cleared);

  return (
    <main className="site-shell">
      <div className="scanlines" aria-hidden="true" />

      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="AlgoQuest home">
          <span>AQ</span>
          AlgoQuest
        </a>
        <nav aria-label="Main navigation">
          {canPlay ? (
            <>
              <a className="active" href="#map">
                [ WORLD_MAP ]
              </a>
              <a href="#missions">[ MISSIONS ]</a>
              <a href="#codex">[ CODEX ]</a>
            </>
          ) : (
            <>
              <a className="active" href="#top">
                [ WELCOME ]
              </a>
              <a href="#how-it-works">[ HOW_IT_WORKS ]</a>
            </>
          )}
        </nav>
        <AccountPanel
          player={player}
          level={cleared.size + 1}
          onPlayerChange={setPlayer}
          onAccountSync={refreshAccountProgress}
        />
      </header>

      <div className="status-line">
        <span>ALGOQUEST_OS v0.1.0</span>
        <span className="status-message">
          {screen === "mission" ? "MISSION MODE // JUDGE LINK ACTIVE" : notice}
        </span>
        <span>{canPlay ? "CLOUD SAVE ONLINE" : "WELCOME MODE"}</span>
      </div>

      {saveConflict && (
        <div className="save-conflict-overlay">
          <section
            className="save-conflict-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-conflict-title"
          >
            <div className="account-panel__bar">
              <span>SAVE_CONFLICT.exe</span>
              <span>DECISION REQUIRED</span>
            </div>
            <div className="save-conflict-panel__body">
              <p className="eyebrow">TWO SAVE SLOTS DISAGREE</p>
              <h2 id="save-conflict-title">CHOOSE YOUR SAVE</h2>
              <p>
                Code drafts follow the save you choose. Verified judge records
                are retained and merged so an old result cannot vanish.
              </p>
              <div className="save-compare">
                <SaveCard label="LOCAL SAVE" save={saveConflict.local} />
                <SaveCard label="CLOUD SAVE" save={saveConflict.cloud} />
              </div>
              {saveError && <p className="account-message">{saveError}</p>}
              <div className="save-choice-actions">
                <button
                  type="button"
                  disabled={syncingSave}
                  onClick={() => void chooseSave("local")}
                >
                  [ USE LOCAL SAVE ]
                </button>
                <button
                  type="button"
                  disabled={syncingSave}
                  onClick={() => void chooseSave("cloud")}
                >
                  [ USE CLOUD SAVE ]
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {screen === "mission" && canPlay && playerSave ? (
        <MissionTerminal
          key={selected.id}
          quest={selected}
          nextQuestTitle={nextAfterSelected?.title}
          initialCode={
            playerSave.drafts.find((item) => item.questId === selected.id)
              ?.source
          }
          history={playerSave.submissions}
          onExit={exitMission}
          onComplete={completeQuest}
          onDraftChange={saveDraft}
          onSubmission={recordSubmission}
        />
      ) : (
        <>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">COMPETITIVE PROGRAMMING // ADVENTURE MODE</p>
          <pre className="ascii-logo" aria-label="AlgoQuest">
            {logo}
          </pre>
          <h1>
            LEARN THE SPELLS.
            <br />
            <span>CONQUER THE ALGORITHMS.</span>
          </h1>
          <p className="hero-description">
            Your compiler is your blade. Your complexity is your armor. Travel
            from the first line of C++ to the deepest ruins of graph theory.
          </p>
          <div className="hero-actions">
            {canPlay ? (
              <>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => openQuest(nextQuest)}
                >
                  &gt; {cleared.has(nextQuest.id) ? "REPLAY" : "CONTINUE"} QUEST_
                  {nextQuest.index}
                </button>
                <button
                  className="text-button"
                  onClick={refreshAccountProgress}
                >
                  [ SYNC_SAVE ]
                </button>
              </>
            ) : (
              <>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => openAccount("login")}
                >
                  &gt; LOGIN TO BEGIN_
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => openAccount("register")}
                >
                  [ CREATE PLAYER ]
                </button>
              </>
            )}
          </div>
          {!canPlay && (
            <p className="login-gate-note">
              {syncingSave
                ? "CHECKING PLAYER DATABASE..."
                : saveError
                  ? `SAVE LINK ERROR // ${saveError}`
                  : player && !player.isGuest && !player.emailVerified
                    ? "VERIFY YOUR EMAIL TO UNLOCK THE WORLD MAP."
                    : "MISSIONS, EDITOR AND JUDGE UNLOCK AFTER LOGIN."}
            </p>
          )}
        </div>

        <aside className="character-card" aria-label="Player status">
          <div className="panel-heading">
            <span>PLAYER.dat</span>
            <span>● {canPlay ? "ONLINE" : "LOCKED"}</span>
          </div>
          <pre className="avatar" aria-hidden="true">{String.raw`
       /\_/\
      ( o.o )   < ${canPlay ? "READY" : "LOGIN"}
       > ^ <
     __/| |\__
    /___| |___\
       /_ _\
      /_/ \_\
`}</pre>
          <div className="stat-row">
            <span>PLAYER</span>
            <strong>
              {canPlay ? player?.displayName.toUpperCase() : "NOT AUTHENTICATED"}
            </strong>
          </div>
          <div className="stat-row">
            <span>XP</span>
            <strong>{String(totalXp).padStart(3, "0")} / 420</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${Math.min(100, (totalXp / 420) * 100)}%` }} />
          </div>
          <div className="stat-row">
            <span>STREAK</span>
            <strong>01 DAY</strong>
          </div>
        </aside>
      </section>

      {canPlay ? (
      <section className="world-section" id="map">
        <div className="section-title">
          <div>
            <p className="eyebrow">CAMPAIGN_ROUTE // 01</p>
            <h2>THE AWAKENING PATH</h2>
          </div>
          <div className="map-legend">
            <span><i className="legend-dot available" /> AVAILABLE</span>
            <span><i className="legend-dot locked" /> LOCKED</span>
            <span><i className="legend-dot secret" /> SECRET</span>
          </div>
        </div>

        <button
          className="playable-banner"
          type="button"
          onClick={() => openQuest(nextQuest)}
        >
          <span>{cleared.has(nextQuest.id) ? "REPLAYABLE" : "NEXT MISSION"}</span>
          <strong>
            {`QUEST ${nextQuest.index} // ${nextQuest.title.toUpperCase()}`}
          </strong>
          <span>&gt; CLICK TO ENTER_</span>
        </button>

        <div className="world-grid">
          <div className="quest-map" aria-label="Quest map">
            <div className="map-paths" aria-hidden="true">
              <span className="path p1">············</span>
              <span className="path p2">········</span>
              <span className="path p3">··········</span>
              <span className="path p4">············</span>
              <span className="path p5">·······</span>
            </div>
            {quests.map((quest) => {
              const playable = isQuestUnlocked(quest, cleared);
              const completed = cleared.has(quest.id);
              const displayStatus =
                playable || completed ? "available" : quest.status;
              return (
                <QuestNode
                  key={quest.id}
                  quest={quest}
                  selected={selected.id === quest.id}
                  completed={completed}
                  playable={playable}
                  displayStatus={displayStatus}
                  onSelect={() => {
                    setSelected(quest);
                    setNotice(
                      quest.status === "secret"
                        ? "ANOMALY DETECTED // ACCESS CONDITION UNKNOWN"
                        : `QUEST SELECTED // ${quest.title.toUpperCase()}`,
                    );
                  }}
                  onOpen={() => openQuest(quest)}
                />
              );
            })}
          </div>

          <aside className="quest-brief" id="missions">
            <div className="panel-heading">
              <span>{selected.chapter}</span>
              <span>#{selected.index}</span>
            </div>
            <p className="quest-kicker">
              {selected.status === "secret"
                ? "ENCRYPTED ENCOUNTER"
                : selectedPlayable
                  ? "MISSION READY"
                  : "MISSION BRIEF"}
            </p>
            <h3>{selected.title}</h3>
            <p>{selected.description}</p>

            <div className="brief-divider">+------------------------------+</div>
            <div className="brief-row">
              <span>DIFFICULTY</span>
              <Difficulty value={selected.difficulty} />
            </div>
            <div className="brief-row">
              <span>REWARD</span>
              <strong>+{selected.xp} XP</strong>
            </div>
            <div className="brief-row skills-row">
              <span>SKILLS</span>
              <div>
                {selected.skills.map((skill) => (
                  <code key={skill}>{skill}</code>
                ))}
              </div>
            </div>

            <button
              className="launch-button"
              disabled={!selectedPlayable}
              onClick={() => openQuest(selected)}
            >
              {selected.status === "secret"
                ? "[ ACCESS DENIED ]"
                : selectedPlayable
                  ? "> ENTER MISSION_"
                  : `[ CLEAR QUEST ${selected.prerequisites
                      .map(
                        (questId) =>
                          quests.find((quest) => quest.id === questId)?.index ??
                          "??",
                      )
                      .join(" + ")} ]`}
            </button>
          </aside>
        </div>
      </section>
      ) : (
        <section className="welcome-info" id="how-it-works">
          <div className="section-title">
            <div>
              <p className="eyebrow">WELCOME_PROTOCOL // READ ONLY</p>
              <h2>HOW THE ADVENTURE WORKS</h2>
            </div>
            <span className="welcome-lock">[ MISSIONS LOCKED ]</span>
          </div>
          <div className="welcome-grid">
            <article>
              <span>01</span>
              <h3>CREATE A PLAYER</h3>
              <p>
                Register and verify your email. Guests can read this
                introduction, but cannot open problems or call the judge.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>CODE LIKE VS CODE</h3>
              <p>
                Solve C++ missions in a real Monaco editor with automatic
                indentation, bracket matching, nested bracket colors and a
                minimap.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>NEVER LOSE A RUN</h3>
              <p>
                Drafts, source snapshots and every evaluation stay on this
                device and in your player database. Conflicts are always your
                choice.
              </p>
            </article>
          </div>
          <button
            className="primary-button welcome-register"
            type="button"
            onClick={() => openAccount("register")}
          >
            &gt; CREATE PLAYER_
          </button>
        </section>
      )}

      <footer>
        <span>© 2026 ALGOQUEST PROJECT</span>
        <span>BUILD: EARLY_ACCESS // NO PAY-TO-WIN NONSENSE</span>
        <a href="#top">[ BACK_TO_TOP ]</a>
      </footer>
        </>
      )}
    </main>
  );
}
