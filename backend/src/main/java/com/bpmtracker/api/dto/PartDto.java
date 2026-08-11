package com.bpmtracker.api.dto;

import com.bpmtracker.domain.LearntState;

import java.util.UUID;

public record PartDto(
        UUID id,
        UUID songId,
        String title,
        int workingBpm,
        int totalBars,
        int learntBars,
        LearntState learntState,
        int position
) {}
