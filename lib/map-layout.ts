import type { Quest } from "@/lib/quests";

export type MapPosition = { x: number; y: number };

const bounds = {
  minX: 9,
  maxX: 91,
  minY: 12,
  maxY: 88,
};

const minimumGap = {
  x: 18,
  y: 24,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampMapPosition(position: MapPosition): MapPosition {
  return {
    x: Number(clamp(position.x, bounds.minX, bounds.maxX).toFixed(2)),
    y: Number(clamp(position.y, bounds.minY, bounds.maxY).toFixed(2)),
  };
}

export function mapPositionsOverlap(
  left: MapPosition,
  right: MapPosition,
) {
  return (
    Math.abs(left.x - right.x) < minimumGap.x &&
    Math.abs(left.y - right.y) < minimumGap.y
  );
}

function candidateOffsets(radius: number) {
  if (radius === 0) return [{ x: 0, y: 0 }];
  const offsets: MapPosition[] = [];
  for (let x = -radius; x <= radius; x += 2) {
    offsets.push({ x, y: -radius }, { x, y: radius });
  }
  for (let y = -radius + 2; y <= radius - 2; y += 2) {
    offsets.push({ x: -radius, y }, { x: radius, y });
  }
  return offsets;
}

export function nearestOpenMapPosition(
  questId: string,
  desired: MapPosition,
  positions: Record<string, MapPosition>,
) {
  const origin = clampMapPosition(desired);
  const others = Object.entries(positions)
    .filter(([id]) => id !== questId)
    .map(([, position]) => position);

  for (let radius = 0; radius <= 100; radius += 2) {
    for (const offset of candidateOffsets(radius)) {
      const candidate = clampMapPosition({
        x: origin.x + offset.x,
        y: origin.y + offset.y,
      });
      if (!others.some((position) => mapPositionsOverlap(candidate, position))) {
        return candidate;
      }
    }
  }
  return origin;
}

export function arrangeQuestPositions(input: Quest[]) {
  const positions: Record<string, MapPosition> = {};
  return input.map((quest) => {
    const mapPosition = nearestOpenMapPosition(
      quest.id,
      quest.mapPosition,
      positions,
    );
    positions[quest.id] = mapPosition;
    return { ...quest, mapPosition };
  });
}
