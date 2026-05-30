package com.bpmtracker.api.dto;

import java.util.UUID;

public record FolderDto(UUID id, String name, int position, int songCount) {}
