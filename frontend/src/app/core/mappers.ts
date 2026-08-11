import { Folder, Song, Part } from './models';
import { FolderRow, SongRow, PartRow } from './db-types';
import { learntStateOf } from './derive';

export function toFolder(row: FolderRow, songCount: number): Folder {
  return { id: row.id, name: row.name, position: row.position, songCount };
}

export function toSong(
  row: SongRow,
  partCount: number,
  learntPartCount: number,
  avgBpm: number | null,
): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    key: row.key,
    avgBpm,
    folderId: row.folder_id,
    position: row.position,
    partCount,
    learntPartCount,
  };
}

export function toPart(row: PartRow): Part {
  return {
    id: row.id,
    songId: row.song_id,
    title: row.title,
    goalBpm: row.goal_bpm,
    workingBpm: row.working_bpm,
    totalBars: row.total_bars,
    learntBars: row.learnt_bars,
    learntState: learntStateOf(row.learnt_bars, row.total_bars),
    position: row.position,
  };
}
