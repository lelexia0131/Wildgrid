import data from '../data/levels.json';
import answers from '../data/solutions.json';
import type { Level, Placement } from './types';

export const levels = data as Level[];
export const solutions = answers as Record<string, Placement[]>;
const levelsById = new Map(levels.map(level => [level.id, level]));

export function getLevelById(id: number): Level | undefined {
  return levelsById.get(id);
}

export function getSolution(id: number): Placement[] | undefined {
  return solutions[id];
}
