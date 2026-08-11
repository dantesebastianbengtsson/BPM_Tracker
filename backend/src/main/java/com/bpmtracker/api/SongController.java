package com.bpmtracker.api;

import com.bpmtracker.api.dto.SongDto;
import com.bpmtracker.api.dto.SongUpsert;
import com.bpmtracker.domain.Folder;
import com.bpmtracker.domain.Song;
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
@RequestMapping("/api/songs")
public class SongController {

    private final SongRepository songs;
    private final FolderRepository folders;

    public SongController(SongRepository songs, FolderRepository folders) {
        this.songs = songs;
        this.folders = folders;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<SongDto> list(@RequestParam(required = false) UUID folderId,
                              @RequestParam(required = false, defaultValue = "false") boolean unfiled) {
        List<Song> result;
        if (unfiled) {
            result = songs.findByFolderIsNullOrderByPositionAscCreatedAtAsc();
        } else if (folderId != null) {
            result = songs.findByFolderIdOrderByPositionAscCreatedAtAsc(folderId);
        } else {
            result = songs.findAllByOrderByPositionAscCreatedAtAsc();
        }
        return result.stream().map(s -> Mapper.toSongDto(s, s.getParts())).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public SongDto get(@PathVariable UUID id) {
        Song s = songs.findById(id).orElseThrow(() -> new NotFoundException("Song", id));
        return Mapper.toSongDto(s, s.getParts());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<SongDto> create(@RequestBody @Valid SongUpsert body) {
        Song s = new Song();
        applyUpsert(s, body);
        s.setPosition(songs.findAll().size());
        Song saved = songs.save(s);
        return ResponseEntity.status(HttpStatus.CREATED).body(Mapper.toSongDto(saved, List.of()));
    }

    @PatchMapping("/{id}")
    @Transactional
    public SongDto update(@PathVariable UUID id, @RequestBody @Valid SongUpsert body) {
        Song s = songs.findById(id).orElseThrow(() -> new NotFoundException("Song", id));
        applyUpsert(s, body);
        return Mapper.toSongDto(s, s.getParts());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        Song s = songs.findById(id).orElseThrow(() -> new NotFoundException("Song", id));
        songs.delete(s);
        return ResponseEntity.noContent().build();
    }

    private void applyUpsert(Song s, SongUpsert body) {
        s.setTitle(body.title().trim());
        s.setGoalBpm(body.goalBpm());
        if (body.folderId() == null) {
            s.setFolder(null);
        } else {
            Folder f = folders.findById(body.folderId())
                    .orElseThrow(() -> new NotFoundException("Folder", body.folderId()));
            s.setFolder(f);
        }
    }
}
