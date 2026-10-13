import { JournalLevelSceneArt } from './JournalLevelSceneArt';

// Shared by the journal grid and the adventure completion emblem.
export function LevelArtwork({ id }: { id: number }) {
  return <JournalLevelSceneArt id={id}/>;
}
