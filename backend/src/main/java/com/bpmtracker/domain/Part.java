package com.bpmtracker.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "parts")
public class Part {

    @Id
    @GeneratedValue
    private UUID id;

    @NotBlank
    @Size(max = 120)
    @Column(nullable = false, length = 120)
    private String title;

    @Min(20)
    @Max(260)
    @Column(nullable = false)
    private int workingBpm = 60;

    @Min(1)
    @Max(999)
    @Column(nullable = false)
    private int totalBars = 1;

    @Min(0)
    @Max(999)
    @Column(nullable = false)
    private int learntBars = 0;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_id", nullable = false)
    @JsonIgnore
    private Song song;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public LearntState getLearntState() {
        if (learntBars <= 0 || totalBars <= 0) return LearntState.UNLEARNT;
        if (learntBars >= totalBars) return LearntState.LEARNT;
        return LearntState.LEARNING;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public int getWorkingBpm() { return workingBpm; }
    public void setWorkingBpm(int workingBpm) { this.workingBpm = workingBpm; }

    public int getTotalBars() { return totalBars; }
    public void setTotalBars(int totalBars) { this.totalBars = totalBars; }

    public int getLearntBars() { return learntBars; }
    public void setLearntBars(int learntBars) { this.learntBars = learntBars; }

    public Song getSong() { return song; }
    public void setSong(Song song) { this.song = song; }

    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
