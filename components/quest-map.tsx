"use client";

import { PointerEvent, useMemo, useRef, useState } from "react";
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
}: {
  questStates: QuestState[];
  selectedId: string;
  copy: MapCopy;
  onSelect: (quest: Quest) => void;
  onOpen: (quest: Quest) => void;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
  }>();

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
    setPan({
      x: Math.max(-360, Math.min(360, nextX)),
      y: Math.max(-210, Math.min(210, nextY)),
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

  return (
    <div
      className={`quest-map-viewport ${dragging ? "is-dragging" : ""}`}
      aria-label="Quest map"
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
              <button
                type="button"
                className={`quest-node quest-node--${displayStatus} ${
                  selectedId === base.id ? "is-selected" : ""
                } ${completed ? "is-completed" : ""} ${
                  playable ? "is-playable" : ""
                }`}
                onClick={() => onSelect(base)}
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
