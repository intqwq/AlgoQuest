"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Quest, QuestStatus } from "@/lib/quests";

type MapCopy = {
  available: string;
  locked: string;
  secret: string;
  cleared: string;
  playable: string;
  enter: string;
  difficulty: string;
  reward: string;
  skills: string;
  dragMap: string;
  edit?: string;
};

type QuestState = {
  base: Quest;
  display: Quest;
  completed: boolean;
  playable: boolean;
  displayStatus: QuestStatus;
};

const canvas = { width: 1000, height: 600 };

function point(quest: Quest) {
  return {
    x: (quest.mapPosition.x / 100) * canvas.width,
    y: (quest.mapPosition.y / 100) * canvas.height,
  };
}

function connectionPath(from: Quest, to: Quest) {
  const start = point(from);
  const end = point(to);
  const bend = Math.max(54, Math.abs(end.x - start.x) * 0.38);
  return `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}`;
}

export function QuestMap({
  questStates,
  selectedId,
  copy,
  onSelect,
  onOpen,
  editable = false,
  canManage = false,
  onPositionChange,
  onPositionCommit,
  onEdit,
}: {
  questStates: QuestState[];
  selectedId: string;
  copy: MapCopy;
  onSelect: (quest: Quest) => void;
  onOpen: (quest: Quest) => void;
  editable?: boolean;
  canManage?: boolean;
  onPositionChange?: (
    questId: string,
    position: { x: number; y: number },
  ) => void;
  onPositionCommit?: (
    questId: string,
    position: { x: number; y: number },
  ) => void;
  onEdit?: (quest: Quest) => void;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panFrame = useRef<number | undefined>(undefined);
  const pendingPan = useRef(pan);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | undefined>(undefined);
  const nodeDrag = useRef<{
    pointerId: number;
    questId: string;
    x: number;
    y: number;
    originX: number;
    originY: number;
    latest: { x: number; y: number };
  } | undefined>(undefined);

  const byId = useMemo(
    () => new Map(questStates.map((item) => [item.base.id, item.base])),
    [questStates],
  );
  const connections = useMemo(
    () =>
      questStates.flatMap(({ base }) =>
        base.prerequisites.flatMap((prerequisite) => {
          const from = byId.get(prerequisite);
          return from
            ? [{ id: `${from.id}-${base.id}`, from, to: base }]
            : [];
        }),
      ),
    [byId, questStates],
  );

  useEffect(
    () => () => {
      if (panFrame.current !== undefined) {
        window.cancelAnimationFrame(panFrame.current);
      }
    },
    [],
  );

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-map-interactive='true']")
    ) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const nextX = drag.current.originX + event.clientX - drag.current.x;
    const nextY = drag.current.originY + event.clientY - drag.current.y;
    pendingPan.current = {
      x: Math.max(-360, Math.min(360, nextX)),
      y: Math.max(-210, Math.min(210, nextY)),
    };
    if (panFrame.current !== undefined) return;
    panFrame.current = window.requestAnimationFrame(() => {
      setPan(pendingPan.current);
      panFrame.current = undefined;
    });
  };

  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const startNodeDrag = (
    event: PointerEvent<HTMLButtonElement>,
    quest: Quest,
  ) => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    nodeDrag.current = {
      pointerId: event.pointerId,
      questId: quest.id,
      x: event.clientX,
      y: event.clientY,
      originX: quest.mapPosition.x,
      originY: quest.mapPosition.y,
      latest: quest.mapPosition,
    };
  };

  const moveNode = (event: PointerEvent<HTMLButtonElement>) => {
    const current = nodeDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    current.latest = {
      x: current.originX + ((event.clientX - current.x) / canvas.width) * 100,
      y: current.originY + ((event.clientY - current.y) / canvas.height) * 100,
    };
    onPositionChange?.(current.questId, current.latest);
  };

  const stopNodeDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (nodeDrag.current?.pointerId !== event.pointerId) return;
    const current = nodeDrag.current;
    nodeDrag.current = undefined;
    onPositionCommit?.(current.questId, current.latest);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={`quest-map-viewport ${dragging ? "is-dragging" : ""} ${
        editable ? "is-editing" : ""
      }`}
      aria-label="Quest map"
      style={{ backgroundPosition: `${pan.x}px ${pan.y}px` }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <div className="map-help">{copy.dragMap}</div>
      <div
        className="quest-map-canvas"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
      >
        <svg
          className="quest-connections"
          viewBox={`0 0 ${canvas.width} ${canvas.height}`}
          aria-hidden="true"
        >
          {connections.map(({ id, from, to }) => (
            <path
              key={id}
              d={connectionPath(from, to)}
              className={`quest-connection ${
                selectedId === from.id || selectedId === to.id
                  ? "is-active"
                  : ""
              }`}
            />
          ))}
        </svg>

        {questStates.map(
          ({ base, display, completed, playable, displayStatus }) => (
            <div
              className={`quest-node-shell quest-node-shell--${displayStatus}`}
              data-map-side={base.mapPosition.x > 65 ? "right" : "left"}
              key={base.id}
              style={{
                left: `${base.mapPosition.x}%`,
                top: `${base.mapPosition.y}%`,
              }}
              data-map-interactive="true"
            >
              {canManage && (
                <button
                  type="button"
                  className="quest-node-edit"
                  aria-label={`${copy.edit ?? "Edit"} ${display.title}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit?.(base);
                  }}
                >
                  ✎
                </button>
              )}
              <button
                type="button"
                className={`quest-node quest-node--${displayStatus} ${
                  selectedId === base.id ? "is-selected" : ""
                } ${completed ? "is-completed" : ""} ${
                  playable ? "is-playable" : ""
                }`}
                onPointerDown={(event) => startNodeDrag(event, base)}
                onPointerMove={moveNode}
                onPointerUp={stopNodeDrag}
                onPointerCancel={stopNodeDrag}
                onClick={() => {
                  if (!editable) onSelect(base);
                }}
                aria-label={`${display.title}, ${displayStatus}`}
              >
                <span className="node-cap">
                  {completed
                    ? `[${copy.cleared}]`
                    : playable
                      ? `[${copy.playable}]`
                      : displayStatus === "locked"
                        ? `[${copy.locked}]`
                        : `[${display.index}]`}
                </span>
                <span className="node-core">
                  {displayStatus === "secret" ? "?" : display.index}
                </span>
                <strong>{display.title}</strong>
                <small>{display.subtitle}</small>
              </button>

              <aside className="quest-hover-card">
                <span>{display.chapter}</span>
                <strong>{display.title}</strong>
                <p>{display.description}</p>
                <dl>
                  <div>
                    <dt>{copy.difficulty}</dt>
                    <dd>
                      {"◆".repeat(display.difficulty)}
                      {"◇".repeat(5 - display.difficulty)}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.reward}</dt>
                    <dd>+{display.xp} XP</dd>
                  </div>
                  <div>
                    <dt>{copy.skills}</dt>
                    <dd>{display.skills.join(" / ")}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  disabled={!playable}
                  onClick={() => onOpen(base)}
                >
                  {playable
                    ? `> ${copy.enter}_`
                    : `[${displayStatus === "secret" ? copy.secret : copy.locked}]`}
                </button>
              </aside>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
