import data from '../game-data/levels.json';
import answers from '../game-data/solutions.json';
import type { Level, Placement } from './types';

export const levels = data as readonly Level[];
export const solutions: Readonly<Record<string, readonly Placement[]>> = answers;
const levelsById = new Map(levels.map(level => [level.id, level]));

export function getLevelById(id: number): Level | undefined {
  return levelsById.get(id);
}

export function getSolution(id: number): readonly Placement[] | undefined {
  return solutions[id];
}
