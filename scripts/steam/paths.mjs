import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const scripts = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(scripts, '../..');
export const steam = path.join(root, 'steam');
export function insideSteam(value) {
  const resolved = path.resolve(value);
  if (!resolved.toLowerCase().startsWith((steam + path.sep).toLowerCase())) throw new Error(`Path outside Steam workspace: ${resolved}`);
  return resolved;
}
export const run = process.env.WILDGRID_STEAM_RUN ? insideSteam(process.env.WILDGRID_STEAM_RUN) : steam;
export const work = path.join(run, 'work');
export const logs = path.join(run, 'logs');
export const source = path.join(work, 'source');
export const content = process.env.WILDGRID_STEAM_CONTENT ? insideSteam(process.env.WILDGRID_STEAM_CONTENT) : path.join(steam, 'content');
