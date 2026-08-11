package com.bpmtracker.api;

import com.bpmtracker.api.dto.FolderDto;
import com.bpmtracker.api.dto.FolderUpsert;
import com.bpmtracker.domain.Folder;
import com.bpmtracker.repo.FolderRepository;
import com.bpmtracker.repo.SongRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/folders")
public class FolderController {

    private final FolderRepository folders;
    private final SongRepository songs;

    public FolderController(FolderRepository folders, SongRepository songs) {
        this.folders = folders;
        this.songs = songs;
    }

    @GetMapping
    public List<FolderDto> list() {
        return folders.findAllByOrderByPositionAscCreatedAtAsc().stream()
                .map(f -> Mapper.toFolderDto(f, songs.findByFolderIdOrderByPositionAscCreatedAtAsc(f.getId()).size()))
                .toList();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<FolderDto> create(@RequestBody @Valid FolderUpsert body) {
        Folder f = new Folder();
        f.setName(body.name().trim());
        f.setPosition(folders.findAll().size());
        Folder saved = folders.save(f);
        return ResponseEntity.status(HttpStatus.CREATED).body(Mapper.toFolderDto(saved, 0));
    }

    @PatchMapping("/{id}")
    @Transactional
    public FolderDto rename(@PathVariable UUID id, @RequestBody @Valid FolderUpsert body) {
        Folder f = folders.findById(id).orElseThrow(() -> new NotFoundException("Folder", id));
        f.setName(body.name().trim());
        return Mapper.toFolderDto(f, songs.findByFolderIdOrderByPositionAscCreatedAtAsc(id).size());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        Folder f = folders.findById(id).orElseThrow(() -> new NotFoundException("Folder", id));
        // Unfile any songs in this folder before delete.
        songs.findByFolderIdOrderByPositionAscCreatedAtAsc(id).forEach(s -> s.setFolder(null));
        folders.delete(f);
        return ResponseEntity.noContent().build();
    }
}
