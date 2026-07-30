"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AccountPanel } from "@/components/account-panel";
import { AdminConsole } from "@/components/admin-console";
import { QuestMap } from "@/components/quest-map";
import {
  loadCurrentPlayer,
  loadQuestCatalog,
  loadPlayerSave,
  PlayerSave,
  Player,
  resolvePlayerSave,
  SaveSubmission,
  saveQuestMapLayout,
  saveQuestDraft,
  saveQuestProgress,
} from "@/lib/api-client";
import { isQuestUnlocked, Quest, quests } from "@/lib/quests";
import {
  arrangeQuestPositions,
  clampMapPosition,
  MapPosition,
  nearestOpenMapPosition,
} from "@/lib/map-layout";
import {
  Locale,
  localeOptions,
  localizeQuest,
  text,
} from "@/lib/i18n";
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
  cloud,
  copy,
}: {
  label: string;
  save: PlayerSave;
  cloud: boolean;
  copy: ReturnType<typeof text>;
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
        <span>{cloud ? copy.playerDatabase : copy.thisDevice}</span>
      </div>
      <dl>
        <div>
          <dt>{copy.clearedCount}</dt>
          <dd>{summary.cleared} QUESTS</dd>
        </div>
        <div>
          <dt>{copy.draftCount}</dt>
          <dd>{summary.drafts} FILES</dd>
        </div>
        <div>
          <dt>{copy.evaluationCount}</dt>
          <dd>{summary.submissions} RECORDS</dd>
        </div>
        <div>
          <dt>{copy.lastUpdate}</dt>
          <dd>
            {Date.parse(summary.updatedAt)
              ? new Date(summary.updatedAt).toLocaleString()
              : copy.empty}
          </dd>
        </div>
        <div>
          <dt>{copy.latestCode}</dt>
          <dd>
            {latestDraft
              ? `${latestDraft.questId} // ${latestDraft.source.split("\n").length} lines`
              : copy.noDraft}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function Home() {
  const [selected, setSelected] = useState<Quest>(quests[0]);
  const [questCatalog, setQuestCatalog] = useState<Quest[]>(quests);
  const [locale, setLocale] = useState<Locale>("en");
  const [notice, setNotice] = useState("ACCOUNT REQUIRED // WELCOME MODE");
  const [screen, setScreen] = useState<"world" | "mission">("world");
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [player, setPlayer] = useState<Player>();
  const [playerSave, setPlayerSave] = useState<PlayerSave>();
  const [saveConflict, setSaveConflict] = useState<SaveConflict>();
  const [syncingSave, setSyncingSave] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [mapEditing, setMapEditing] = useState(false);
  const [mapSaving, setMapSaving] = useState(false);
  const [mapDraft, setMapDraft] = useState<Record<string, MapPosition>>({});
  const copy = text(locale);
  const displayedQuests = useMemo(
    () => questCatalog.map((quest) => localizeQuest(quest, locale)),
    [locale, questCatalog],
  );
  const selectedDisplay =
    displayedQuests.find((quest) => quest.id === selected.id) ?? selected;
  const mapQuests = useMemo(
    () =>
      mapEditing
        ? questCatalog.map((quest) => ({
            ...quest,
            mapPosition: mapDraft[quest.id] ?? quest.mapPosition,
          }))
        : questCatalog,
    [mapDraft, mapEditing, questCatalog],
  );

  const canPlay = Boolean(
    player && !player.isGuest && player.emailVerified && playerSave,
  );

  const refreshQuestCatalog = useCallback(() => {
    void loadQuestCatalog().then(
      ({ quests: overrides, archivedQuestIds, mapLayout }) => {
      const archived = new Set(archivedQuestIds);
      const byId = new Map(overrides.map((quest) => [quest.id, quest]));
      const merged = quests
        .filter((quest) => !archived.has(quest.id))
        .map((quest) => byId.get(quest.id) ?? quest);
      for (const quest of overrides) {
        if (!quests.some((builtIn) => builtIn.id === quest.id)) {
          merged.push(quest);
        }
      }
      merged.sort(
        (left, right) =>
          (left.sortOrder ?? (Number(left.index) || 9999)) -
          (right.sortOrder ?? (Number(right.index) || 9999)),
      );
      const positioned = arrangeQuestPositions(
        merged.map((quest) => ({
          ...quest,
          mapPosition: mapLayout[quest.id] ?? quest.mapPosition,
        })),
      );
      setQuestCatalog(positioned);
      setSelected((current) =>
        positioned.find((quest) => quest.id === current.id) ??
        positioned[0] ??
        current,
      );
      },
    );
  }, []);

  const startMapEditing = () => {
    setMapDraft(
      Object.fromEntries(
        questCatalog.map((quest) => [quest.id, quest.mapPosition]),
      ),
    );
    setMapEditing(true);
    setNotice(copy.mapEditHint);
  };

  const cancelMapEditing = () => {
    setMapEditing(false);
    setMapDraft({});
    setNotice(copy.saveReady);
  };

  const moveMapQuest = (questId: string, desired: MapPosition) => {
    setMapDraft((current) => ({
      ...current,
      [questId]: clampMapPosition(desired),
    }));
  };

  const commitMapQuest = (questId: string, desired: MapPosition) => {
    setMapDraft((current) => ({
      ...current,
      [questId]: nearestOpenMapPosition(questId, desired, current),
    }));
  };

  const saveMapEditing = async () => {
    setMapSaving(true);
    try {
      await saveQuestMapLayout(
        mapQuests.map((quest) => ({
          id: quest.id,
          ...quest.mapPosition,
        })),
      );
      setQuestCatalog(mapQuests);
      setMapEditing(false);
      setMapDraft({});
      setNotice(copy.mapSaved);
      refreshQuestCatalog();
    } catch {
      setNotice(copy.mapSaveFailed);
    } finally {
      setMapSaving(false);
    }
  };

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
    setNotice(copy.saveReady);
  }, [copy.saveReady]);

  useEffect(() => {
    const stored = window.localStorage.getItem("algoquest.locale");
    if (stored === "en" || stored === "zh-CN" || stored === "ja") {
      // Restore the explicit player preference after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocale(stored);
    }
  }, []);

  useEffect(() => {
    refreshQuestCatalog();
  }, [refreshQuestCatalog]);

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
              ? copy.emailRequired
              : copy.accountRequired,
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
        setNotice(copy.saveOffline);
      })
      .finally(() => setSyncingSave(false));
  }, [applySave, copy.accountRequired, copy.emailRequired, copy.saveOffline]);

  useEffect(() => {
    // Initial authentication and save hydration intentionally update page state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshAccountProgress();
  }, [refreshAccountProgress]);

  useEffect(() => {
    const syncScreenFromHash = () => {
      const missionId = window.location.hash.match(/^#mission\/([a-z0-9-]+)$/)?.[1];
      const mission = questCatalog.find(
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
  }, [canPlay, cleared, questCatalog]);

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

  const playableQuests = questCatalog.filter((quest) =>
    isQuestUnlocked(quest, cleared),
  );
  const nextQuest =
    playableQuests.find((quest) => !cleared.has(quest.id)) ??
    playableQuests.at(-1) ??
    questCatalog[0];
  const nextAfterSelected = questCatalog.find((quest) =>
    quest.prerequisites.includes(selected.id),
  );
  const totalXp = questCatalog
    .filter((quest) => cleared.has(quest.id))
    .reduce((sum, quest) => sum + quest.xp, 0);
  const maximumXp = questCatalog.reduce((sum, quest) => sum + quest.xp, 0);
  const selectedPlayable = isQuestUnlocked(selected, cleared);

  return (
    <main className="site-shell" lang={locale === "zh-CN" ? "zh-CN" : locale}>
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
                [ {copy.worldMap} ]
              </a>
              <a href="#missions">[ {copy.missions} ]</a>
              <a href="#codex">[ {copy.codex} ]</a>
            </>
          ) : (
            <>
              <a className="active" href="#top">
                [ {copy.welcome} ]
              </a>
              <a href="#how-it-works">[ {copy.howItWorks} ]</a>
            </>
          )}
        </nav>
        <div className="topbar-actions">
          <div className="locale-switcher" aria-label="Language">
            {localeOptions.map((option) => (
              <button
                type="button"
                className={locale === option.value ? "is-active" : ""}
                key={option.value}
                onClick={() => {
                  setLocale(option.value);
                  window.localStorage.setItem("algoquest.locale", option.value);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <AccountPanel
            player={player}
            level={cleared.size + 1}
            onPlayerChange={setPlayer}
            onAccountSync={refreshAccountProgress}
            locale={locale}
          />
          <AdminConsole
            player={player}
            locale={locale}
            builtInQuests={quests}
            onCatalogChange={refreshQuestCatalog}
          />
        </div>
      </header>

      <div className="status-line">
        <span>ALGOQUEST_OS v0.1.0</span>
        <span className="status-message">
          {screen === "mission" ? copy.missionMode : notice}
        </span>
        <span>{canPlay ? copy.cloudSaveOnline : copy.welcomeMode}</span>
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
              <p className="eyebrow">{copy.saveConflict}</p>
              <h2 id="save-conflict-title">{copy.chooseSave}</h2>
              <p>{copy.conflictDescription}</p>
              <div className="save-compare">
                <SaveCard
                  label={copy.localSave}
                  save={saveConflict.local}
                  cloud={false}
                  copy={copy}
                />
                <SaveCard
                  label={copy.cloudSave}
                  save={saveConflict.cloud}
                  cloud
                  copy={copy}
                />
              </div>
              {saveError && <p className="account-message">{saveError}</p>}
              <div className="save-choice-actions">
                <button
                  type="button"
                  disabled={syncingSave}
                  onClick={() => void chooseSave("local")}
                >
                  [ {copy.useLocal} ]
                </button>
                <button
                  type="button"
                  disabled={syncingSave}
                  onClick={() => void chooseSave("cloud")}
                >
                  [ {copy.useCloud} ]
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {screen === "mission" && canPlay && playerSave ? (
        <MissionTerminal
          key={selected.id}
          quest={selectedDisplay}
          nextQuestTitle={
            nextAfterSelected
              ? localizeQuest(nextAfterSelected, locale).title
              : undefined
          }
          locale={locale}
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
          <p className="eyebrow">{copy.heroEyebrow}</p>
          <pre className="ascii-logo" aria-label="AlgoQuest">
            {logo}
          </pre>
          <h1>
            {copy.heroTitleA}
            <br />
            <span>{copy.heroTitleB}</span>
          </h1>
          <p className="hero-description">{copy.heroDescription}</p>
          <div className="hero-actions">
            {canPlay ? (
              <>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => openQuest(nextQuest)}
                >
                  &gt;{" "}
                  {cleared.has(nextQuest.id)
                    ? copy.replayQuest
                    : copy.continueQuest}{" "}
                  QUEST_
                  {nextQuest.index}
                </button>
                <button
                  className="text-button"
                  onClick={refreshAccountProgress}
                >
                  [ {copy.syncSave} ]
                </button>
              </>
            ) : (
              <>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => openAccount("login")}
                >
                  &gt; {copy.loginToBegin}
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => openAccount("register")}
                >
                  [ {copy.createPlayer} ]
                </button>
              </>
            )}
          </div>
          {!canPlay && (
            <p className="login-gate-note">
              {syncingSave
                ? copy.checkingSave
                : saveError
                  ? `SAVE LINK ERROR // ${saveError}`
                  : player && !player.isGuest && !player.emailVerified
                    ? copy.verifyToUnlock
                    : copy.loginToUnlock}
            </p>
          )}
        </div>

        <aside className="character-card" aria-label="Player status">
          <div className="panel-heading">
            <span>PLAYER.dat</span>
            <span>● {canPlay ? copy.online : copy.offlineLocked}</span>
          </div>
          <pre className="avatar" aria-hidden="true">{String.raw`
       /\_/\
      ( o.o )   < ${canPlay ? copy.readyState : copy.loginState}
       > ^ <
     __/| |\__
    /___| |___\
       /_ _\
      /_/ \_\
`}</pre>
          <div className="stat-row">
            <span>{copy.playerLabel}</span>
            <strong>
              {canPlay ? player?.displayName.toUpperCase() : copy.notAuthenticated}
            </strong>
          </div>
          {canPlay && player && (
            <div className={`stat-row role-title role-title--${player.role}`}>
              <span>{copy.roleLabel}</span>
              <strong>
                {player.role === "owner"
                  ? copy.roleOwner
                  : player.role === "admin"
                    ? copy.roleAdmin
                    : copy.rolePlayer}
              </strong>
            </div>
          )}
          <div className="stat-row">
            <span>XP</span>
            <strong>{String(totalXp).padStart(3, "0")} / {maximumXp}</strong>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${maximumXp ? Math.min(100, (totalXp / maximumXp) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="stat-row">
            <span>{copy.streak}</span>
            <strong>01 {copy.day}</strong>
          </div>
        </aside>
      </section>

      {canPlay ? (
      <section className="world-section" id="map">
        <div className="section-title">
          <div>
            <p className="eyebrow">{copy.campaign}</p>
            <h2>{copy.pathTitle}</h2>
          </div>
          <div className="map-legend">
            <span><i className="legend-dot available" /> {copy.available}</span>
            <span><i className="legend-dot locked" /> {copy.locked}</span>
            <span><i className="legend-dot secret" /> {copy.secret}</span>
          </div>
        </div>

        {(player?.role === "admin" || player?.role === "owner") && (
          <div className="map-edit-toolbar">
            <span>
              {mapEditing ? copy.mapEditHint : "MAP_LAYOUT.cfg // READ ONLY"}
            </span>
            {mapEditing ? (
              <div>
                <button
                  type="button"
                  disabled={mapSaving}
                  onClick={() => void saveMapEditing()}
                >
                  [ {mapSaving ? "SAVING..." : copy.saveMap} ]
                </button>
                <button
                  type="button"
                  disabled={mapSaving}
                  onClick={cancelMapEditing}
                >
                  [ {copy.cancelMap} ]
                </button>
              </div>
            ) : (
              <button type="button" onClick={startMapEditing}>
                [ {copy.editMap} ]
              </button>
            )}
          </div>
        )}

        <button
          className="playable-banner"
          type="button"
          onClick={() => openQuest(nextQuest)}
        >
          <span>
            {cleared.has(nextQuest.id) ? copy.replayable : copy.nextMission}
          </span>
          <strong>
            {`QUEST ${nextQuest.index} // ${localizeQuest(
              nextQuest,
              locale,
            ).title.toUpperCase()}`}
          </strong>
          <span>&gt; {copy.clickEnter}</span>
        </button>

        <div className="world-grid">
          <QuestMap
            questStates={mapQuests.map((quest) => {
              const playable = isQuestUnlocked(quest, cleared);
              const completed = cleared.has(quest.id);
              const displayStatus =
                playable || completed ? "available" : quest.status;
              return {
                base: quest,
                display: localizeQuest(quest, locale),
                completed,
                playable,
                displayStatus,
              };
            })}
            selectedId={selected.id}
            copy={{
              ...copy,
              edit: copy.editQuest,
              dragMap: mapEditing ? copy.mapEditHint : copy.dragMap,
            }}
            onSelect={(quest) => {
              setSelected(quest);
              setNotice(
                quest.status === "secret"
                  ? "ANOMALY DETECTED // ACCESS CONDITION UNKNOWN"
                  : `QUEST SELECTED // ${localizeQuest(
                      quest,
                      locale,
                    ).title.toUpperCase()}`,
              );
            }}
            onOpen={openQuest}
            editable={mapEditing}
            canManage={player?.role === "admin" || player?.role === "owner"}
            onPositionChange={moveMapQuest}
            onPositionCommit={commitMapQuest}
            onEdit={(quest) => {
              window.dispatchEvent(
                new CustomEvent("algoquest:open-admin", {
                  detail: { questId: quest.id },
                }),
              );
            }}
          />

          <aside className="quest-brief" id="missions">
            <div className="panel-heading">
              <span>{selectedDisplay.chapter}</span>
              <span>#{selectedDisplay.index}</span>
            </div>
            <p className="quest-kicker">
              {selected.status === "secret"
                ? copy.encrypted
                : selectedPlayable
                  ? copy.missionReady
                  : copy.missionBrief}
            </p>
            <h3>{selectedDisplay.title}</h3>
            <p>{selectedDisplay.description}</p>

            <div className="brief-divider">+------------------------------+</div>
            <div className="brief-row">
              <span>{copy.difficulty}</span>
              <Difficulty value={selectedDisplay.difficulty} />
            </div>
            <div className="brief-row">
              <span>{copy.reward}</span>
              <strong>+{selectedDisplay.xp} XP</strong>
            </div>
            <div className="brief-row skills-row">
              <span>{copy.skills}</span>
              <div>
                {selectedDisplay.skills.map((skill) => (
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
                  ? `> ${copy.enterMission}`
                  : `[ ${copy.clearQuest} ${selected.prerequisites
                      .map(
                        (questId) =>
                          questCatalog.find((quest) => quest.id === questId)?.index ??
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
              <p className="eyebrow">{copy.welcomeProtocol}</p>
              <h2>{copy.adventureWorks}</h2>
            </div>
            <span className="welcome-lock">[ {copy.missionsLocked} ]</span>
          </div>
          <div className="welcome-grid">
            {copy.welcomeSteps.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <button
            className="primary-button welcome-register"
            type="button"
            onClick={() => openAccount("register")}
          >
            &gt; {copy.createPlayer}_
          </button>
        </section>
      )}

      <footer>
        <span>© 2026 ALGOQUEST PROJECT</span>
        <span>{copy.footerBuild}</span>
        <a href="#top">[ {copy.backToTop} ]</a>
      </footer>
        </>
      )}
    </main>
  );
}
