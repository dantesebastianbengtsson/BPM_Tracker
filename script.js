"use strict";

(function () {
  const STORAGE_KEY = "bpm_tracker_songs";

  let songs = [];
  let activeSongId = null;
  let activePartId = null;

  let metronomeBpm = 60;
  let isPlaying = false;
  let metronomeTimer = null;
  let audioCtx = null;

  const elements = {
    songList: document.getElementById("song-list"),
    addSongButton: document.getElementById("add-song-button"),
    songForm: document.getElementById("song-form"),
    songId: document.getElementById("song-id"),
    songName: document.getElementById("song-name"),
    songNotes: document.getElementById("song-notes"),
    saveSong: document.getElementById("save-song"),
    cancelSong: document.getElementById("cancel-song"),
    editSongButton: document.getElementById("edit-song-button"),
    deleteSongButton: document.getElementById("delete-song-button"),
    detailName: document.getElementById("detail-name"),
    detailNotes: document.getElementById("detail-notes"),
    partList: document.getElementById("part-list"),
    addPartButton: document.getElementById("add-part-button"),
    partForm: document.getElementById("part-form"),
    partId: document.getElementById("part-id"),
    partName: document.getElementById("part-name"),
    partCurrent: document.getElementById("part-current-bpm"),
    partTarget: document.getElementById("part-target-bpm"),
    partTotalBars: document.getElementById("part-total-bars"),
    partLearntBars: document.getElementById("part-learnt-bars"),
    partComment: document.getElementById("part-comment"),
    cancelPart: document.getElementById("cancel-part"),
    metronomeBpm: document.getElementById("metronome-bpm"),
    bpmMinus: document.getElementById("bpm-minus"),
    bpmPlus: document.getElementById("bpm-plus"),
    metronomeToggle: document.getElementById("metronome-toggle"),
    metronomeIndicator: document.getElementById("metronome-indicator"),
    activePartLabel: document.getElementById("active-part-label"),
  };

  function setSongButtonMode(mode) {
    elements.addSongButton.textContent =
      mode === "save" ? "Save Song" : "Add Song";
  }

  function setPartButtonMode(mode) {
    elements.addPartButton.textContent =
      mode === "save" ? "Save Part" : "Add Part";
  }

  window.addEventListener("load", init);

  function init() {
    songs = loadSongs();
    if (songs.length) {
      activeSongId = songs[0].id;
      if (songs[0].parts[0]) {
        activePartId = songs[0].parts[0].id;
      }
    }

    bindEvents();
    renderSongList();
    renderSongDetails();
    updateMetronomeDisplay();
  }

  function bindEvents() {
    elements.addSongButton.addEventListener("click", handleAddSongButton);
    elements.cancelSong.addEventListener("click", closeSongForm);
    elements.songForm.addEventListener("submit", onSongSubmit);

    elements.songList.addEventListener("click", handleSongListClick);

    elements.editSongButton.addEventListener("click", () => {
      const song = getActiveSong();
      if (song) openSongForm(song);
    });

    elements.deleteSongButton.addEventListener("click", () => {
      const song = getActiveSong();
      if (song && confirm(`Delete song "${song.name}"?`)) {
        deleteSong(song.id);
      }
    });

    elements.addPartButton.addEventListener("click", handleAddPartButton);
    elements.cancelPart.addEventListener("click", closePartForm);
    elements.partForm.addEventListener("submit", onPartSubmit);
    elements.partList.addEventListener("click", handlePartListClick);
    elements.partList.addEventListener("input", handlePartListInput);

    elements.bpmMinus.addEventListener("click", () => adjustPartBpm(-5));
    elements.bpmPlus.addEventListener("click", () => adjustPartBpm(5));
    elements.metronomeToggle.addEventListener("click", toggleMetronome);
  }

  function handleSongListClick(event) {
    const actionButton = event.target.closest("button[data-action]");
    if (actionButton) {
      event.stopPropagation();
      const songId = actionButton.dataset.songId;
      if (actionButton.dataset.action === "edit") {
        const song = songs.find((s) => s.id === songId);
        if (song) openSongForm(song);
      } else if (actionButton.dataset.action === "delete") {
        const song = songs.find((s) => s.id === songId);
        if (song && confirm(`Delete song "${song.name}"?`)) {
          deleteSong(songId);
        }
      }
      return;
    }

    const item = event.target.closest(".song-item");
    if (!item) return;
    const songId = item.dataset.id;
    if (songId !== activeSongId) {
      activeSongId = songId;
      const song = getActiveSong();
      activePartId = song && song.parts[0] ? song.parts[0].id : null;
      renderSongList();
      renderSongDetails();
      updateMetronomeDisplay();
    }
  }

  function handlePartListClick(event) {
    const button = event.target.closest("button[data-action]");
    const song = getActiveSong();
    if (!song) return;

    if (button) {
      const partId = button.dataset.partId;
      const part = song.parts.find((p) => p.id === partId);
      if (!part) return;

      switch (button.dataset.action) {
        case "learn-up":
          updateLearntBars(part.id, part.learntBars + 1);
          break;
        case "learn-down":
          updateLearntBars(part.id, part.learntBars - 1);
          break;
        case "mark-learnt":
          updateLearntBars(part.id, part.totalBars);
          break;
        case "edit":
          openPartForm(part);
          break;
        case "delete":
          if (confirm(`Delete part "${part.name}"?`)) {
            deletePart(part.id);
          }
          break;
      }
      return;
    }

    const item = event.target.closest(".part-item");
    if (!item) return;
    const part = song.parts.find((p) => p.id === item.dataset.id);
    if (!part) return;
    activePartId = part.id;
    updateMetronomeDisplay();
    renderSongDetails();
  }

  function handlePartListInput(event) {
    const slider = event.target.closest(".learn-slider");
    const song = getActiveSong();
    if (!slider || !song) return;
    const partId = slider.dataset.partId;
    const part = song.parts.find((p) => p.id === partId);
    if (!part) return;
    const nextValue = Math.min(
      part.totalBars,
      Math.max(0, Number(slider.value) || 0)
    );
    updateLearntBars(partId, nextValue);
  }

  function handleAddSongButton() {
    const formOpen = !elements.songForm.classList.contains("hidden");
    if (formOpen) {
      elements.songForm.requestSubmit();
    } else {
      openSongForm();
    }
  }

  function handleAddPartButton() {
    const formOpen = !elements.partForm.classList.contains("hidden");
    if (formOpen) {
      elements.partForm.requestSubmit();
    } else {
      openPartForm();
    }
  }

  function openSongForm(song = null) {
    elements.songForm.classList.remove("hidden");
    elements.songName.value = song ? song.name : "";
    elements.songNotes.value = song ? song.notes || "" : "";
    elements.songId.value = song ? song.id : "";
    elements.songName.focus();
    setSongButtonMode("save");
  }

  function closeSongForm() {
    elements.songForm.classList.add("hidden");
    elements.songForm.reset();
    elements.songId.value = "";
    setSongButtonMode("add");
  }

  function onSongSubmit(event) {
    event.preventDefault();
    const id = elements.songId.value;
    const name = elements.songName.value.trim();
    if (!name) return;
    const notes = elements.songNotes.value.trim();

    if (id) {
      const song = songs.find((s) => s.id === id);
      if (song) {
        song.name = name;
        song.notes = notes;
      }
    } else {
      const newSong = {
        id: generateId(),
        name,
        notes,
        parts: [],
      };
      songs.push(newSong);
      activeSongId = newSong.id;
      activePartId = null;
    }
    saveSongs();
    closeSongForm();
    renderSongList();
    renderSongDetails();
    updateMetronomeDisplay();
  }

  function deleteSong(songId) {
    songs = songs.filter((s) => s.id !== songId);
    if (activeSongId === songId) {
      activeSongId = songs[0] ? songs[0].id : null;
      activePartId =
        songs[0] && songs[0].parts[0] ? songs[0].parts[0].id : null;
    }
    saveSongs();
    renderSongList();
    renderSongDetails();
    updateMetronomeDisplay();
  }

  function openPartForm(part = null) {
    const song = getActiveSong();
    if (!song) return;
    elements.partForm.classList.remove("hidden");
    elements.partId.value = part ? part.id : "";
    elements.partName.value = part ? part.name : "";
    const fallbackCurrent =
      part?.currentBpm ?? (song.parts[song.parts.length - 1]?.currentBpm || 60);
    const fallbackTarget =
      part?.targetBpm ?? (song.parts[song.parts.length - 1]?.targetBpm || 80);
    const totalBars = part?.totalBars ?? 8;
    const learntBars = Math.min(totalBars, part?.learntBars ?? 0);
    elements.partCurrent.value = fallbackCurrent;
    elements.partTarget.value = fallbackTarget;
    elements.partTotalBars.value = totalBars;
    elements.partLearntBars.value = learntBars;
    elements.partComment.value = part ? part.comment || "" : "";
    elements.partName.focus();
    setPartButtonMode("save");
  }

  function closePartForm() {
    elements.partForm.classList.add("hidden");
    elements.partForm.reset();
    elements.partId.value = "";
    setPartButtonMode("add");
  }

  function onPartSubmit(event) {
    event.preventDefault();
    const song = getActiveSong();
    if (!song) return;
    const partId = elements.partId.value;
    const name = elements.partName.value.trim();
    const currentBpm = Number(elements.partCurrent.value);
    const targetBpm = Number(elements.partTarget.value);
    const totalBars = Math.max(1, Number(elements.partTotalBars.value) || 1);
    const rawLearntBars = Number(elements.partLearntBars.value);
    const learntBars = Math.min(
      totalBars,
      Math.max(0, Number.isFinite(rawLearntBars) ? rawLearntBars : 0)
    );
    const comment = elements.partComment.value.trim();
    if (!name || !currentBpm || !targetBpm) return;

    const maxBpm = targetBpm * 2;
    const safeCurrentBpm = Math.min(currentBpm, maxBpm);

    if (partId) {
      const part = song.parts.find((p) => p.id === partId);
      if (part) {
        part.name = name;
        part.currentBpm = safeCurrentBpm;
        part.targetBpm = targetBpm;
        part.totalBars = totalBars;
        part.learntBars = learntBars;
        part.comment = comment;
      }
    } else {
      const newPart = {
        id: generateId(),
        name,
        currentBpm: safeCurrentBpm,
        targetBpm,
        totalBars,
        learntBars,
        comment,
      };
      song.parts.push(newPart);
      activePartId = newPart.id;
    }
    saveSongs();
    closePartForm();
    renderSongDetails();
    renderSongList();
    updateMetronomeDisplay();
  }

  function deletePart(partId) {
    const song = getActiveSong();
    if (!song) return;
    song.parts = song.parts.filter((p) => p.id !== partId);
    if (activePartId === partId) {
      activePartId = song.parts[0] ? song.parts[0].id : null;
    }
    saveSongs();
    renderSongDetails();
    renderSongList();
    updateMetronomeDisplay();
  }

  function renderSongList() {
    elements.songList.innerHTML = "";
    if (!songs.length) {
      elements.songList.innerHTML =
        "<li>No songs yet. Add your first one!</li>";
      return;
    }

    songs.forEach((song) => {
      const listItem = document.createElement("li");
      listItem.className = `song-item${
        song.id === activeSongId ? " active" : ""
      }`;
      listItem.dataset.id = song.id;

      const { percentage, label, className } = computeSongProgress(song);
      const chipClass = className ? ` ${className}` : "";

      listItem.innerHTML = `
                <div class="song-info">
                    <strong>${song.name}</strong>
                    <small>${label}</small>
                </div>
                <div class="song-row-actions">
                    <span class="progress-chip${chipClass}">${percentage}%</span>
                    <button data-action="edit" data-song-id="${song.id}">Edit</button>
                    <button data-action="delete" data-song-id="${song.id}" class="danger">Delete</button>
                </div>
            `;
      elements.songList.appendChild(listItem);
    });
  }

  function renderSongDetails() {
    const song = getActiveSong();

    const hasSong = Boolean(song);
    elements.editSongButton.disabled = !hasSong;
    elements.deleteSongButton.disabled = !hasSong;
    elements.addPartButton.disabled = !hasSong;

    if (!song) {
      elements.detailName.textContent = "Select a song to view parts";
      elements.detailNotes.textContent = "";
      elements.partList.innerHTML = "<p class='notes'>No song selected.</p>";
      return;
    }

    elements.detailName.textContent = song.name;
    elements.detailNotes.textContent = song.notes || "No notes.";

    if (!song.parts.length) {
      elements.partList.innerHTML =
        "<p class='notes'>No parts yet. Add one to get started.</p>";
      return;
    }

    elements.partList.innerHTML = "";

    song.parts.forEach((part) => {
      const partDiv = document.createElement("div");
      partDiv.className = `part-item${
        part.id === activePartId ? " active" : ""
      }`;
      partDiv.dataset.id = part.id;

      const progress = calculateProgress(part);
      const status = getProgressStatus(part);
      const learningPercent = Math.round(getLearningPercent(part) * 100);
      const learningStatus = getLearningStatus(part);
      const learned = isPartLearnt(part);

      partDiv.innerHTML = `
                <div class="part-header">
                    <div>
                        <strong>${part.name}</strong>
                        <p class="notes">Current: ${
                          part.currentBpm
                        } BPM &middot; Target: ${part.targetBpm} BPM</p>
                        ${
                          part.comment
                            ? `<p class="notes">Comment: ${part.comment}</p>`
                            : ""
                        }
                    </div>
                    <div class="part-actions">
                        ${
                          part.id === activePartId
                            ? `<span class="part-status">Active</span>`
                            : ""
                        }
                        <span class="part-learning ${learned ? "ready" : ""}">
                          ${learned ? "Learnt" : "Learning"}
                        </span>
                        <button data-action="edit" data-part-id="${
                          part.id
                        }">Edit</button>
                        <button data-action="delete" data-part-id="${
                          part.id
                        }" class="danger">Delete</button>
                    </div>
                </div>
                <div class="learning-section">
                    <div class="learning-row">
                        <span class="progress-label">Learnt ${
                          part.learntBars
                        } / ${part.totalBars} bars</span>
                        <span class="progress-status ${
                          learningStatus.className
                        }">${learningPercent}% \u00b7 ${
        learningStatus.label
      }</span>
                    </div>
                    <div class="learning-controls">
                        <button data-action="learn-down" data-part-id="${
                          part.id
                        }" ${part.learntBars <= 0 ? "disabled" : ""}>-</button>
                        <input type="range" min="0" max="${
                          part.totalBars
                        }" step="1" value="${
        part.learntBars
      }" class="learn-slider" data-part-id="${part.id}">
                        <button data-action="learn-up" data-part-id="${
                          part.id
                        }" ${
        part.learntBars >= part.totalBars ? "disabled" : ""
      }>+</button>
                        <button data-action="mark-learnt" data-part-id="${
                          part.id
                        }" ${
        part.learntBars >= part.totalBars ? "disabled" : ""
      }>Mark learnt</button>
                    </div>
                    <div class="progress-bar learn">
                        <div class="progress-bar-fill ${
                          learningStatus.className
                        }" style="width:${learningPercent}%"></div>
                    </div>
                    ${
                      learned
                        ? ""
                        : `<p class="notes learn-hint">Finish learning this part to unlock BPM tracking.</p>`
                    }
                </div>
                <div class="progress-section${learned ? "" : " locked"}">
                    <span class="progress-label">
                        ${Math.round(progress * 100)}% of target &middot;
                        <span class="progress-status">${status.label}</span>
                    </span>
                    <div class="progress-bar">
                        <div class="progress-bar-fill ${
                          status.className
                        }" style="width:${progress * 100}%"></div>
                    </div>
                </div>
            `;

      elements.partList.appendChild(partDiv);
    });
  }

  function computeSongProgress(song) {
    if (!song.parts.length) {
      return { percentage: 0, label: "No parts yet", className: "" };
    }
    const total = song.parts.reduce(
      (sum, part) => sum + calculateProgress(part),
      0
    );
    const average = total / song.parts.length;
    const tempoStatus = getTempoStatusFromRatio(average);
    const learningRatio = getSongLearningProgress(song);
    return {
      percentage: Math.round(average * 100),
      label: `${Math.round(average * 100)}% tempo avg \u00b7 ${Math.round(
        learningRatio * 100
      )}% learnt`,
      className: tempoStatus.className,
    };
  }

  function calculateProgress(part) {
    if (!part.targetBpm) return 0;
    return Math.min(part.currentBpm / part.targetBpm, 2);
  }

  function getProgressStatus(part) {
    if (!part.targetBpm) return { label: "Set a target", className: "" };
    const ratio = part.currentBpm / part.targetBpm;
    return getTempoStatusFromRatio(ratio);
  }

  function getTempoStatusFromRatio(ratio) {
    if (!Number.isFinite(ratio)) {
      return { label: "Keep practicing", className: "" };
    }
    if (ratio >= 2) {
      return { label: "Maxed out (200%)", className: "over-purple" };
    }
    if (ratio >= 1.5) {
      return { label: "Purple zone", className: "over-purple" };
    }
    if (ratio >= 1.25) {
      return { label: "Redline", className: "over-red" };
    }
    if (ratio >= 1.01) {
      return { label: "Above target", className: "over-pink" };
    }
    if (ratio >= 1) {
      return { label: "Target smashed", className: "complete" };
    }
    if (ratio >= 0.5) {
      return { label: "Woah, we're halfway there!", className: "halfway" };
    }
    return { label: "Keep practicing", className: "" };
  }

  function getLearningPercent(part) {
    if (!part.totalBars) return 0;
    return Math.min(1, Math.max(0, part.learntBars / part.totalBars));
  }

  function getLearningStatus(part) {
    const ratio = getLearningPercent(part);
    if (ratio >= 1) return { label: "Learnt", className: "complete" };
    if (ratio >= 0.5) return { label: "Halfway", className: "halfway" };
    return { label: "Learning", className: "" };
  }

  function isPartLearnt(part) {
    return getLearningPercent(part) >= 1;
  }

  function getSongLearningProgress(song) {
    if (!song.parts.length) return 0;
    const totals = song.parts.reduce(
      (acc, part) => {
        acc.total += part.totalBars || 0;
        acc.learnt += Math.min(part.learntBars || 0, part.totalBars || 0);
        return acc;
      },
      { total: 0, learnt: 0 }
    );
    if (!totals.total) return 0;
    return Math.min(1, totals.learnt / totals.total);
  }

  function adjustPartBpm(delta) {
    const part = getActivePart();
    if (!part || !isPartLearnt(part)) return;
    const maxBpm = getMaxBpm(part);
    part.currentBpm = Math.min(maxBpm, Math.max(20, part.currentBpm + delta));
    metronomeBpm = part.currentBpm;
    if (part.id === activePartId) {
      restartMetronomeInterval();
      if (isPlaying) {
        handleTick(); // keep the light/click in phase after tempo changes
      }
    }
    saveSongs();
    renderSongDetails();
    renderSongList();
    updateMetronomeDisplay();
  }

  function updateLearntBars(partId, newValue) {
    const song = getActiveSong();
    if (!song) return;
    const part = song.parts.find((p) => p.id === partId);
    if (!part) return;
    const normalized = normalizeLearntBars(part.totalBars, newValue);
    if (part.learntBars === normalized) return;
    part.learntBars = normalized;
    saveSongs();
    renderSongDetails();
    renderSongList();
    updateMetronomeDisplay();
  }

  function toggleMetronome() {
    const part = getActivePart();
    if (!part || !isPartLearnt(part)) return;
    isPlaying = !isPlaying;
    if (isPlaying) {
      startMetronome();
    } else {
      stopMetronome();
    }
    elements.metronomeToggle.textContent = isPlaying ? "Stop" : "Play";
  }

  function startMetronome() {
    restartMetronomeInterval();
  }

  function stopMetronome() {
    if (metronomeTimer) {
      clearInterval(metronomeTimer);
      metronomeTimer = null;
    }
  }

  function restartMetronomeInterval() {
    stopMetronome();
    const part = getActivePart();
    if (!part || !isPlaying) return;
    metronomeBpm = part.currentBpm;
    const interval = (60_000 / metronomeBpm) | 0;
    metronomeTimer = setInterval(handleTick, interval);
  }

  function handleTick() {
    flashIndicator();
    playClick();
  }

  function flashIndicator() {
    elements.metronomeIndicator.classList.add("active");
    setTimeout(
      () => elements.metronomeIndicator.classList.remove("active"),
      100
    );
  }

  function playClick() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1000;
    gain.gain.value = 0.2;

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  }

  function updateMetronomeDisplay() {
    const part = getActivePart();
    if (part) {
      const maxBpm = getMaxBpm(part);
      const atMax = part.currentBpm >= maxBpm;
      const unlocked = isPartLearnt(part);
      if (!unlocked && isPlaying) {
        isPlaying = false;
        stopMetronome();
      }
      metronomeBpm = part.currentBpm;
      elements.metronomeBpm.value = part.currentBpm;
      elements.activePartLabel.textContent = `${getActiveSong().name} - ${
        part.name
      }${unlocked ? "" : " (learning bars)"}`;
      elements.bpmMinus.disabled = !unlocked;
      elements.bpmPlus.disabled = !unlocked || atMax;
      elements.metronomeToggle.disabled = !unlocked;
      elements.metronomeToggle.textContent = isPlaying ? "Stop" : "Play";
      if (isPlaying) {
        restartMetronomeInterval();
      }
    } else {
      elements.metronomeBpm.value = "";
      elements.activePartLabel.textContent = "No part selected";
      elements.bpmMinus.disabled = true;
      elements.bpmPlus.disabled = true;
      elements.metronomeToggle.disabled = true;
      elements.metronomeToggle.textContent = "Play";
      if (isPlaying) {
        isPlaying = false;
        stopMetronome();
      }
    }
  }

  function getActiveSong() {
    return songs.find((song) => song.id === activeSongId) || null;
  }

  function getActivePart() {
    const song = getActiveSong();
    if (!song) return null;
    return song.parts.find((part) => part.id === activePartId) || null;
  }

  function saveSongs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  }

  function normalizeLearntBars(totalBars, learntBars) {
    const total = Math.max(1, Number(totalBars) || 1);
    const learnt = Number.isFinite(learntBars) ? learntBars : 0;
    return Math.min(total, Math.max(0, Math.round(learnt)));
  }

  function loadSongs() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return normalizeSongs(parsed);
        }
      } catch (err) {
        console.error("Failed to parse songs from storage", err);
      }
    }
    return normalizeSongs([
      {
        id: generateId(),
        name: "Take Me Home, Country Roads",
        notes: "Example song to get you started.",
        parts: [
          {
            id: generateId(),
            name: "Intro picking",
            currentBpm: 62,
            targetBpm: 82,
            totalBars: 8,
            learntBars: 8,
            comment: "Work on smooth transitions.",
          },
          {
            id: generateId(),
            name: "Verse chords",
            currentBpm: 62,
            targetBpm: 82,
            totalBars: 8,
            learntBars: 6,
            comment: "",
          },
        ],
      },
    ]);
  }

  function normalizeSongs(list) {
    return list.map((song) => ({
      ...song,
      parts: (song.parts || []).map(ensurePartDefaults),
    }));
  }

  function ensurePartDefaults(part) {
    const totalBars = Math.max(1, Number(part.totalBars) || 8);
    const hasLearntValue =
      part.learntBars !== undefined && part.learntBars !== null;
    const learntBars = normalizeLearntBars(
      totalBars,
      hasLearntValue ? part.learntBars : totalBars
    );
    return {
      ...part,
      totalBars,
      learntBars,
    };
  }

  function generateId() {
    return `id-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  }

  function getMaxBpm(part) {
    if (!part || !part.targetBpm) return 400;
    return part.targetBpm * 2;
  }
})();
