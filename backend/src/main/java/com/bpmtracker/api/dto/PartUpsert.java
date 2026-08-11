package com.bpmtracker.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PartUpsert(
        @NotBlank @Size(max = 120) String title,
        @Min(20) @Max(260) int workingBpm,
        @Min(1) @Max(999) int totalBars
) {}
