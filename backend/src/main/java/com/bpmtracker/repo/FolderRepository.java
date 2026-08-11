package com.bpmtracker.repo;

import com.bpmtracker.domain.Folder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FolderRepository extends JpaRepository<Folder, UUID> {
    List<Folder> findAllByOrderByPositionAscCreatedAtAsc();
}
