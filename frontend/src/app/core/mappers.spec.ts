import { toFolder, toSong, toPart } from './mappers';
import { FolderRow, SongRow, PartRow } from './db-types';

describe('toFolder', () => {
  it('maps row and attaches songCount', () => {
    const row: FolderRow = { id: 'f1', name: 'Rock', position: 0, created_at: 't' };
    expect(toFolder(row, 4)).toEqual({ id: 'f1', name: 'Rock', position: 0, songCount: 4 });
  });
});

describe('toSong', () => {
  it('maps snake_case to camelCase and attaches counts', () => {
    const row: SongRow = {
      id: 's1', folder_id: 'f1', title: 'Song', goal_bpm: 120, position: 2, created_at: 't',
    };
    expect(toSong(row, 5, 3)).toEqual({
      id: 's1', title: 'Song', goalBpm: 120, folderId: 'f1', position: 2,
      partCount: 5, learntPartCount: 3,
    });
  });
});

describe('toPart', () => {
  it('maps row and derives learntState', () => {
    const row: PartRow = {
      id: 'p1', song_id: 's1', title: 'Intro', working_bpm: 90,
      total_bars: 8, learnt_bars: 8, position: 0, created_at: 't',
    };
    expect(toPart(row)).toEqual({
      id: 'p1', songId: 's1', title: 'Intro', workingBpm: 90,
      totalBars: 8, learntBars: 8, learntState: 'LEARNT', position: 0,
    });
  });
});
