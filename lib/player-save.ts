import type { PlayerSave, QuestDraft, SaveSubmission } from "@/lib/api-client";

const savePrefix = "algoquest.player-save.";
const legacyProgressKey = "algoquest.cleared-quests";

export function emptyPlayerSave(accountId: string): PlayerSave {
  return {
    version: 2,
    accountId,
    updatedAt: new Date(0).toISOString(),
    progress: [],
    drafts: [],
    submissions: [],
  };
}

function parseSave(value: string | null, accountId: string) {
  if (!value) return undefined;
  try {
    const candidate = JSON.parse(value) as Partial<PlayerSave>;
    if (
      candidate.version !== 2 ||
      !Array.isArray(candidate.progress) ||
      !Array.isArray(candidate.drafts) ||
      !Array.isArray(candidate.submissions)
    ) {
      return undefined;
    }
    return {
      ...emptyPlayerSave(accountId),
      ...candidate,
      accountId,
    } as PlayerSave;
  } catch {
    return undefined;
  }
}

function loadLegacySave(accountId: string) {
  const cleared = new Set<string>();
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(legacyProgressKey) ?? "[]",
    ) as unknown;
    if (Array.isArray(stored)) {
      stored.forEach((questId) => {
        if (typeof questId === "string") cleared.add(questId);
      });
    }
  } catch {
    // Ignore damaged legacy saves.
  }
  if (window.localStorage.getItem("algoquest.signal-fire") === "cleared") {
    cleared.add("signal-fire");
  }
  if (!cleared.size) return undefined;
  const updatedAt = new Date().toISOString();
  return {
    ...emptyPlayerSave(accountId),
    updatedAt,
    progress: [...cleared].map((questId) => ({
      questId,
      status: "cleared" as const,
      bestScore: 100,
      updatedAt,
    })),
  };
}

export function loadLocalPlayerSave(accountId: string) {
  return (
    parseSave(
      window.localStorage.getItem(`${savePrefix}${accountId}`),
      accountId,
    ) ??
    loadLegacySave(accountId) ??
    emptyPlayerSave(accountId)
  );
}

export function persistLocalPlayerSave(save: PlayerSave) {
  window.localStorage.setItem(
    `${savePrefix}${save.accountId}`,
    JSON.stringify(save),
  );
}

export function hasSaveData(save: PlayerSave) {
  return Boolean(
    save.progress.length || save.drafts.length || save.submissions.length,
  );
}

function normalized(save: PlayerSave) {
  return {
    progress: [...save.progress]
      .map(({ questId, status, bestScore }) => ({
        questId,
        status,
        bestScore,
      }))
      .sort((left, right) => left.questId.localeCompare(right.questId)),
    drafts: [...save.drafts]
      .map(({ questId, source }) => ({ questId, source }))
      .sort((left, right) => left.questId.localeCompare(right.questId)),
    submissions: [...save.submissions]
      .map(({ judgeSubmissionId, questId, verdict, source }) => ({
        judgeSubmissionId,
        questId,
        verdict,
        source,
      }))
      .sort((left, right) =>
        left.judgeSubmissionId.localeCompare(right.judgeSubmissionId),
      ),
  };
}

export function savesConflict(local: PlayerSave, cloud: PlayerSave) {
  return (
    hasSaveData(local) &&
    hasSaveData(cloud) &&
    JSON.stringify(normalized(local)) !== JSON.stringify(normalized(cloud))
  );
}

export function replaceDraft(
  save: PlayerSave,
  draft: QuestDraft,
): PlayerSave {
  return {
    ...save,
    updatedAt: draft.updatedAt,
    drafts: [
      draft,
      ...save.drafts.filter((item) => item.questId !== draft.questId),
    ],
  };
}

export function addSubmission(
  save: PlayerSave,
  submission: SaveSubmission,
): PlayerSave {
  return {
    ...save,
    updatedAt: submission.updatedAt,
    submissions: [
      submission,
      ...save.submissions.filter(
        (item) => item.judgeSubmissionId !== submission.judgeSubmissionId,
      ),
    ].slice(0, 100),
  };
}

export function markQuestCleared(
  save: PlayerSave,
  questId: string,
  score: number,
): PlayerSave {
  const updatedAt = new Date().toISOString();
  return {
    ...save,
    updatedAt,
    progress: [
      {
        questId,
        status: "cleared",
        bestScore: score,
        updatedAt,
      },
      ...save.progress.filter((item) => item.questId !== questId),
    ],
  };
}

export function saveSummary(save: PlayerSave) {
  const cleared = save.progress.filter(
    (item) => item.status === "cleared",
  ).length;
  return {
    cleared,
    drafts: save.drafts.length,
    submissions: save.submissions.length,
    updatedAt: save.updatedAt,
  };
}
