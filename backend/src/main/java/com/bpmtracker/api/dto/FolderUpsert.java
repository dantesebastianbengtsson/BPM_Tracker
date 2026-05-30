package com.bpmtracker.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FolderUpsert(
        @NotBlank @Size(max = 80) String name
) {}
