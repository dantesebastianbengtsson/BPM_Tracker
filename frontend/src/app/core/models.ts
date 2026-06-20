export type LearntState = 'UNLEARNT' | 'LEARNING' | 'LEARNT';

export interface Folder {
  id: string;
  name: string;
  position: number;
  songCount: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  key: string | null;
  avgBpm: number | null;
  folderId: string | null;
  position: number;
  partCount: number;
  learntPartCount: number;
}

export interface Part {
  id: string;
  songId: string;
  title: string;
  goalBpm: number;
  workingBpm: number;
  totalBars: number;
  learntBars: number;
  learntState: LearntState;
  position: number;
}

export interface FolderUpsert {
  name: string;
}

export interface SongUpsert {
  title: string;
  artist: string | null;
  album: string | null;
  key: string | null;
  folderId: string | null;
}

export interface PartUpsert {
  title: string;
  goalBpm: number;
  workingBpm: number;
  totalBars: number;
}
