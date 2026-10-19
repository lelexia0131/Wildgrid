import { rankFor, SURVIVAL_RANKS } from '../../game-modes/survival/survivalDifficulty';

export type RewardSegment = { from: number; to: number; rank: number };

// XP is lifetime XP. Only the bar is relative to the current rank's thresholds.
export function rewardSegments(xp: number, earned: number): RewardSegment[] {
  const before = xp - earned;
  const segments: RewardSegment[] = [];
  for (let rank = rankFor(before); rank <= rankFor(xp); rank++) {
    segments.push({ from: Math.max(before, SURVIVAL_RANKS[rank].xp), to: Math.min(xp, SURVIVAL_RANKS[rank + 1]?.xp ?? xp), rank });
  }
  return segments;
}

export function rewardFrame(segments: RewardSegment[], progress: number) {
  const index = Math.min(segments.length - 1, Math.floor(progress * segments.length));
  const segment = segments[index];
  // Reserve the end of each crossed rank for a visibly full bar before resetting.
  const phase = Math.min(1, (progress * segments.length - index) / (index < segments.length - 1 ? .82 : 1));
  const eased = phase * phase * (3 - 2 * phase);
  const value = segment.from + (segment.to - segment.from) * eased;
  const xp = Math.floor(value);
  const start = SURVIVAL_RANKS[segment.rank].xp;
  const next = SURVIVAL_RANKS[segment.rank + 1]?.xp;
  return { xp, rank: segment.rank, start, next, fill: next === undefined ? 1 : (value - start) / (next - start), done: progress >= 1 };
}
