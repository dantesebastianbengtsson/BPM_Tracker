package com.bpmtracker.api;

import com.bpmtracker.api.dto.FolderDto;
import com.bpmtracker.api.dto.PartDto;
import com.bpmtracker.api.dto.SongDto;
import com.bpmtracker.domain.Folder;
import com.bpmtracker.domain.LearntState;
import com.bpmtracker.domain.Part;
import com.bpmtracker.domain.Song;

import java.util.List;

public final class Mapper {

    private Mapper() {}

    public static FolderDto toFolderDto(Folder f, int songCount) {
        return new FolderDto(f.getId(), f.getName(), f.getPosition(), songCount);
    }

    public static SongDto toSongDto(Song s, List<Part> parts) {
        int total = parts.size();
        int learnt = (int) parts.stream().filter(p -> p.getLearntState() == LearntState.LEARNT).count();
        return new SongDto(
                s.getId(),
                s.getTitle(),
                s.getGoalBpm(),
                s.getFolder() == null ? null : s.getFolder().getId(),
                s.getPosition(),
                total,
                learnt
        );
    }

    public static PartDto toPartDto(Part p) {
        return new PartDto(
                p.getId(),
                p.getSong().getId(),
                p.getTitle(),
                p.getWorkingBpm(),
                p.getTotalBars(),
                p.getLearntBars(),
                p.getLearntState(),
                p.getPosition()
        );
    }
}
