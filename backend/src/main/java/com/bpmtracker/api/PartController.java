package com.bpmtracker.api;

import com.bpmtracker.api.dto.BarsAdjust;
import com.bpmtracker.api.dto.PartDto;
import com.bpmtracker.api.dto.PartUpsert;
import com.bpmtracker.domain.Part;
import com.bpmtracker.domain.Song;
import com.bpmtracker.repo.PartRepository;
import com.bpmtracker.repo.SongRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class PartController {

    private final PartRepository parts;
    private final SongRepository songs;

    public PartController(PartRepository parts, SongRepository songs) {
        this.parts = parts;
        this.songs = songs;
    }

    @GetMapping("/songs/{songId}/parts")
    public List<PartDto> listForSong(@PathVariable UUID songId) {
        if (!songs.existsById(songId)) throw new NotFoundException("Song", songId);
        return parts.findBySongIdOrderByPositionAscCreatedAtAsc(songId).stream()
                .map(Mapper::toPartDto)
                .toList();
    }

    @PostMapping("/songs/{songId}/parts")
    @Transactional
    public ResponseEntity<PartDto> create(@PathVariable UUID songId, @RequestBody @Valid PartUpsert body) {
        Song song = songs.findById(songId).orElseThrow(() -> new NotFoundException("Song", songId));
        Part p = new Part();
        p.setSong(song);
        p.setTitle(body.title().trim());
        p.setWorkingBpm(body.workingBpm());
        p.setTotalBars(body.totalBars());
        p.setLearntBars(0);
        p.setPosition(parts.findBySongIdOrderByPositionAscCreatedAtAsc(songId).size());
        Part saved = parts.save(p);
        return ResponseEntity.status(HttpStatus.CREATED).body(Mapper.toPartDto(saved));
    }

    @GetMapping("/parts/{id}")
    public PartDto get(@PathVariable UUID id) {
        return Mapper.toPartDto(load(id));
    }

    @PatchMapping("/parts/{id}")
    @Transactional
    public PartDto update(@PathVariable UUID id, @RequestBody @Valid PartUpsert body) {
        Part p = load(id);
        p.setTitle(body.title().trim());
        p.setWorkingBpm(body.workingBpm());
        p.setTotalBars(body.totalBars());
        if (p.getLearntBars() > p.getTotalBars()) {
            p.setLearntBars(p.getTotalBars());
        }
        return Mapper.toPartDto(p);
    }

    @PostMapping("/parts/{id}/bars")
    @Transactional
    public PartDto adjustBars(@PathVariable UUID id, @RequestBody BarsAdjust body) {
        Part p = load(id);
        int next = Math.max(0, Math.min(p.getTotalBars(), p.getLearntBars() + body.delta()));
        p.setLearntBars(next);
        return Mapper.toPartDto(p);
    }

    @DeleteMapping("/parts/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        Part p = load(id);
        parts.delete(p);
        return ResponseEntity.noContent().build();
    }

    private Part load(UUID id) {
        return parts.findById(id).orElseThrow(() -> new NotFoundException("Part", id));
    }
}
