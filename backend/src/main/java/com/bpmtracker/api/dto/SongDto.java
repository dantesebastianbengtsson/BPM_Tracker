package com.bpmtracker.api.dto;

import java.util.UUID;

public record SongDto(
        UUID id,
        String title,
        int goalBpm,
        UUID folderId,
        int position,
        int partCount,
        int learntPartCount
) {}
