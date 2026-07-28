"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountPanel } from "@/components/account-panel";
import { MissionTerminal } from "@/components/mission-terminal";
import {
  loadCurrentPlayer,
  loadQuestProgress,
  Player,
  saveQuestProgress,
} from "@/lib/api-client";
import { isQuestUnlocked, Quest, QuestStatus, quests } from "@/lib/quests";

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

const progressStorageKey = "algoquest.cleared-quests";

function loadLocalProgress() {
  const cleared = new Set<string>();
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(progressStorageKey) ?? "[]",
    ) as unknown;
    if (Array.isArray(saved)) {
      saved.forEach((questId) => {
        if (typeof questId === "string") cleared.add(questId);
      });
    }
  } catch {
    // A damaged local save must not prevent the game from opening.
  }
  if (window.localStorage.getItem("algoquest.signal-fire") === "cleared") {
    cleared.add("signal-fire");
  }
  return cleared;
}

export default function Home() {
  const [selected, setSelected] = useState<Quest>(quests[0]);
  const [notice, setNotice] = useState("SYSTEM READY // SELECT A QUEST");
  const [screen, setScreen] = useState<"world" | "mission">("world");
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [player, setPlayer] = useState<Player>();

  const refreshAccountProgress = useCallback(() => {
    void Promise.all([loadQuestProgress(), loadCurrentPlayer()])
      .then(([progress, currentPlayer]) => {
        setPlayer(currentPlayer);
        setCleared((current) => {
          const merged = new Set(current);
          progress
            .filter((item) => item.status === "cleared")
            .forEach((item) => merged.add(item.questId));
          window.localStorage.setItem(
            progressStorageKey,
            JSON.stringify([...merged]),
          );
          return merged;
        });
      })
      .catch(() => {
        // Local progress remains usable while the account service is offline.
      });
  }, []);

  useEffect(() => {
    // Browser persistence is intentionally synchronized after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCleared(loadLocalProgress());
    refreshAccountProgress();

    const syncScreenFromHash = () => {
      const missionId = window.location.hash.match(/^#mission\/([a-z0-9-]+)$/)?.[1];
      const mission = quests.find(
        (quest) => quest.id === missionId && quest.problem,
      );
      if (mission) {
        setSelected(mission);
        setScreen("mission");
      } else {
        setScreen("world");
      }
    };

    syncScreenFromHash();
    window.addEventListener("hashchange", syncScreenFromHash);
    return () => window.removeEventListener("hashchange", syncScreenFromHash);
  }, [refreshAccountProgress]);

  const completeQuest = (questId: string, score: number) => {
    setCleared((current) => {
      const updated = new Set(current);
      updated.add(questId);
      window.localStorage.setItem(
        progressStorageKey,
        JSON.stringify([...updated]),
      );
      return updated;
    });
    void saveQuestProgress(questId, score).catch(() => {
      // The accepted submission is still visible locally and can sync later.
    });
  };

  const openQuest = (quest: Quest) => {
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
          <a className="active" href="#map">
            [ WORLD_MAP ]
          </a>
          <a href="#missions">[ MISSIONS ]</a>
          <a href="#codex">[ CODEX ]</a>
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
        <span>LATENCY 12ms</span>
      </div>

      {screen === "mission" ? (
        <MissionTerminal
          key={selected.id}
          quest={selected}
          nextQuestTitle={nextAfterSelected?.title}
          onExit={exitMission}
          onComplete={completeQuest}
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
              onClick={() => setNotice("SAVE SLOT // LOCAL SYNC ONLINE")}
            >
              [ VIEW_SAVE ]
            </button>
          </div>
        </div>

        <aside className="character-card" aria-label="Player status">
          <div className="panel-heading">
            <span>PLAYER.dat</span>
            <span>● ONLINE</span>
          </div>
          <pre className="avatar" aria-hidden="true">{String.raw`
       /\_/\
      ( o.o )   < READY
       > ^ <
     __/| |\__
    /___| |___\
       /_ _\
      /_/ \_\
`}</pre>
          <div className="stat-row">
            <span>RANK</span>
            <strong>UNRANKED</strong>
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
