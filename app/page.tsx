"use client";

import { useEffect, useState } from "react";
import { MissionTerminal } from "@/components/mission-terminal";
import { loadQuestProgress, saveQuestProgress } from "@/lib/api-client";
import { Quest, quests } from "@/lib/quests";

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
  onSelect,
  onOpen,
}: {
  quest: Quest;
  selected: boolean;
  completed: boolean;
  playable: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const disabled = quest.status === "locked";
  return (
    <button
      className={`quest-node quest-node--${quest.status} ${
        selected ? "is-selected" : ""
      } ${completed ? "is-completed" : ""} ${playable ? "is-playable" : ""}`}
      style={{ gridArea: quest.gridArea }}
      onClick={playable ? onOpen : onSelect}
      disabled={disabled}
      aria-label={
        playable
          ? `${quest.title}, playable, enter mission`
          : `${quest.title}, ${quest.status}`
      }
    >
      <span className="node-cap">
        {completed
          ? "[CLEARED]"
          : playable
            ? "[PLAYABLE]"
          : quest.status === "locked"
            ? "[LOCKED]"
            : `[${quest.index}]`}
      </span>
      <span className="node-core">
        {quest.status === "secret" ? "?" : quest.index}
      </span>
      <strong>{quest.title}</strong>
      <small>{quest.subtitle}</small>
      {playable && <span className="node-action">&gt; ENTER</span>}
    </button>
  );
}

export default function Home() {
  const [selected, setSelected] = useState<Quest>(quests[0]);
  const [notice, setNotice] = useState("SYSTEM READY // SELECT A QUEST");
  const [screen, setScreen] = useState<"world" | "mission">("world");
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    // Browser persistence is intentionally synchronized after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCleared(window.localStorage.getItem("algoquest.signal-fire") === "cleared");
    void loadQuestProgress()
      .then((progress) => {
        if (
          progress.some(
            (item) =>
              item.questId === "signal-fire" && item.status === "cleared",
          )
        ) {
          window.localStorage.setItem("algoquest.signal-fire", "cleared");
          setCleared(true);
        }
      })
      .catch(() => {
        // Local progress remains usable while the API service is offline.
      });

    const syncScreenFromHash = () => {
      setScreen(
        window.location.hash === "#mission/signal-fire" ? "mission" : "world",
      );
    };

    syncScreenFromHash();
    window.addEventListener("hashchange", syncScreenFromHash);
    return () => window.removeEventListener("hashchange", syncScreenFromHash);
  }, []);

  const completeFirstQuest = () => {
    window.localStorage.setItem("algoquest.signal-fire", "cleared");
    setCleared(true);
    void saveQuestProgress("signal-fire", 100).catch(() => {
      // The accepted submission is still visible locally and can sync later.
    });
  };

  const openFirstQuest = () => {
    setSelected(quests[0]);
    setNotice("QUEST 01 LAUNCHED // JUDGE LINK ACTIVE");
    setScreen("mission");
    window.history.replaceState(null, "", "#mission/signal-fire");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exitMission = () => {
    setScreen("world");
    setNotice(
      cleared
        ? "QUEST 01 CLEARED // FORKED PATH UNLOCKED"
        : "MISSION SUSPENDED // PROGRESS KEPT",
    );
    window.history.replaceState(null, "", "#map");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
        <div className="player-chip">
          <span className="online-dot" />
          INLINEINT // {cleared ? "LV.02" : "LV.01"}
        </div>
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
          onExit={exitMission}
          onComplete={completeFirstQuest}
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
              onClick={openFirstQuest}
            >
              &gt; {cleared ? "REPLAY QUEST_01" : "START QUEST_01"}
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
            <strong>{cleared ? "120 / 260" : "000 / 120"}</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: cleared ? "46%" : "8%" }} />
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

        <button className="playable-banner" type="button" onClick={openFirstQuest}>
          <span>PLAYABLE NOW</span>
          <strong>QUEST 01 // SIGNAL FIRE</strong>
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
            {quests.map((quest) => (
              <QuestNode
                key={quest.id}
                quest={quest}
                selected={selected.id === quest.id}
                completed={cleared && quest.id === "signal-fire"}
                playable={quest.id === "signal-fire"}
                onSelect={() => {
                  setSelected(quest);
                  setNotice(
                    quest.status === "secret"
                      ? "ANOMALY DETECTED // ACCESS CONDITION UNKNOWN"
                      : `QUEST SELECTED // ${quest.title.toUpperCase()}`,
                  );
                }}
                onOpen={openFirstQuest}
              />
            ))}
          </div>

          <aside className="quest-brief" id="missions">
            <div className="panel-heading">
              <span>{selected.chapter}</span>
              <span>#{selected.index}</span>
            </div>
            <p className="quest-kicker">
              {selected.status === "secret" ? "ENCRYPTED ENCOUNTER" : "MISSION BRIEF"}
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
              disabled={selected.status === "secret"}
              onClick={() => {
                if (selected.id === "signal-fire") {
                  openFirstQuest();
                } else {
                  setNotice(
                    cleared
                      ? "QUEST 02 TERMINAL // CONTENT PACK PENDING"
                      : "COMPLETE QUEST 01 TO OPEN THIS MISSION",
                  );
                }
              }}
            >
              {selected.status === "secret"
                ? "[ ACCESS DENIED ]"
                : selected.id === "signal-fire"
                  ? "> ENTER MISSION_"
                  : "[ PREREQUISITE REQUIRED ]"}
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
