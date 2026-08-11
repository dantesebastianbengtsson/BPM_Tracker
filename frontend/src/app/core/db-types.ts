export interface FolderRow {
  id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface SongRow {
  id: string;
  folder_id: string | null;
  title: string;
  artist: string | null;
  album: string | null;
  key: string | null;
  position: number;
  created_at: string;
}

export interface PartRow {
  id: string;
  song_id: string;
  title: string;
  goal_bpm: number;
  working_bpm: number;
  total_bars: number;
  learnt_bars: number;
  position: number;
  created_at: string;
}
