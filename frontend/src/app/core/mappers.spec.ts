import { toFolder, toSong, toPart } from './mappers';
import { FolderRow, SongRow, PartRow } from './db-types';

describe('toFolder', () => {
  it('maps row and attaches songCount', () => {
    const row: FolderRow = { id: 'f1', name: 'Rock', position: 0, created_at: 't' };
    expect(toFolder(row, 4)).toEqual({ id: 'f1', name: 'Rock', position: 0, songCount: 4 });
  });
});

describe('toSong', () => {
  it('maps snake_case to camelCase, attaches counts and avgBpm', () => {
    const row: SongRow = {
      id: 's1', folder_id: 'f1', title: 'Song',
      artist: 'Bach', album: 'WTC', key: 'Cm',
      position: 2, created_at: 't',
    };
    expect(toSong(row, 5, 3, 95)).toEqual({
      id: 's1', title: 'Song', artist: 'Bach', album: 'WTC', key: 'Cm',
      avgBpm: 95, folderId: 'f1', position: 2,
      partCount: 5, learntPartCount: 3,
    });
  });

  it('accepts null metadata and null avgBpm', () => {
    const row: SongRow = {
      id: 's2', folder_id: null, title: 'Untitled',
      artist: null, album: null, key: null,
      position: 0, created_at: 't',
    };
    const result = toSong(row, 0, 0, null);
    expect(result.artist).toBeNull();
    expect(result.album).toBeNull();
    expect(result.key).toBeNull();
    expect(result.avgBpm).toBeNull();
  });
});

describe('toPart', () => {
  it('maps row, includes goalBpm, and derives learntState', () => {
    const row: PartRow = {
      id: 'p1', song_id: 's1', title: 'Intro',
      goal_bpm: 100, working_bpm: 90,
      total_bars: 8, learnt_bars: 8, position: 0, created_at: 't',
    };
    expect(toPart(row)).toEqual({
      id: 'p1', songId: 's1', title: 'Intro',
      goalBpm: 100, workingBpm: 90,
      totalBars: 8, learntBars: 8, learntState: 'LEARNT', position: 0,
    });
  });
});
