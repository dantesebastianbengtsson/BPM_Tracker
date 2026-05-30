package com.bpmtracker.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record SongUpsert(
        @NotBlank @Size(max = 120) String title,
        @Min(20) @Max(260) int goalBpm,
        UUID folderId
) {}
