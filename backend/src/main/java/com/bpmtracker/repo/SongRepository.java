package com.bpmtracker.repo;

import com.bpmtracker.domain.Song;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SongRepository extends JpaRepository<Song, UUID> {
    List<Song> findAllByOrderByPositionAscCreatedAtAsc();
    List<Song> findByFolderIdOrderByPositionAscCreatedAtAsc(UUID folderId);
    List<Song> findByFolderIsNullOrderByPositionAscCreatedAtAsc();
}
