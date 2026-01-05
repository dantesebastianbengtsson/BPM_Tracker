"use strict";

(() => {
  const STORAGE_KEY = "bpmTrackerData_v1";
  const RESOLUTION = 64;
  const STRINGS = ["E", "A", "D", "G", "B", "e"]; // 0 = low E
  const BASE_MIDI = [40, 45, 50, 55, 59, 64];
  const METRONOME_LOOKAHEAD_MS = 25;
  const METRONOME_SCHEDULE_AHEAD = 0.12;

  let data = { songs: [], activeSongId: null, activePartId: null };
  let lastUsedFret = 0;
  let selectedCell = null; // { barId, stringIndex, stepIndex }
  let editingCell = null;
  let pendingEdit = null;
  let highlightState = null;

  let audioCtx = null;
  let metronomeTimer = null;
  let nextMetronomeTick = 0;
  let isMetronomeRunning = false;

  let playback = { timer: null, barIndex: 0, stepIndex: 0, running: false };

  const el = {
    songList: document.getElementById("song-list"),
    songForm: document.getElementById("song-form"),
    songId: document.getElementById("song-id"),
    songTitle: document.getElementById("song-title"),
    songGoal: document.getElementById("song-goal"),
    newSong: document.getElementById("new-song"),
    cancelSong: document.getElementById("cancel-song"),

    partList: document.getElementById("part-list"),
    partForm: document.getElementById("part-form"),
    partId: document.getElementById("part-id"),
    partTitle: document.getElementById("part-title"),
    partBpm: document.getElementById("part-bpm"),
    newPart: document.getElementById("new-part"),
    cancelPart: document.getElementById("cancel-part"),
    learntFilter: document.getElementById("learnt-filter"),

    breadcrumb: document.getElementById("breadcrumb"),
    learntBadge: document.getElementById("learnt-badge"),
    learntState: document.getElementById("learnt-state"),

    bpmDown: document.getElementById("bpm-down"),
    bpmUp: document.getElementById("bpm-up"),
    bpmDisplay: document.getElementById("bpm-display"),
    metronomeToggle: document.getElementById("metronome-toggle"),
    metronomeIndicator: document.getElementById("metronome-indicator"),

    playTab: document.getElementById("play-tab"),
    stopTab: document.getElementById("stop-tab"),
    loopTab: document.getElementById("loop-tab"),
    clickDuringPlay: document.getElementById("click-during-play"),

    addBar: document.getElementById("add-bar"),
    duplicateLast: document.getElementById("duplicate-last"),
    clearBars: document.getElementById("clear-bars"),
    barsContainer: document.getElementById("bars-container"),
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    data = loadData();
    ensureSelection();
    bindEvents();
    renderAll();
  }

  function bindEvents() {
    el.newSong.addEventListener("click", () => openSongForm());
    el.cancelSong.addEventListener("click", closeSongForm);
    el.songForm.addEventListener("submit", onSongSubmit);
    el.songList.addEventListener("click", onSongListClick);

    el.newPart.addEventListener("click", () => openPartForm());
    el.cancelPart.addEventListener("click", closePartForm);
    el.partForm.addEventListener("submit", onPartSubmit);
    el.partList.addEventListener("click", onPartListClick);
    el.learntFilter.addEventListener("change", renderParts);

    el.bpmDown.addEventListener("click", () => adjustBpm(-5));
    el.bpmUp.addEventListener("click", () => adjustBpm(5));
    el.bpmDisplay.addEventListener("change", onBpmInput);
    el.metronomeToggle.addEventListener("click", toggleMetronome);

    el.learntState.addEventListener("change", onLearntChange);

    el.playTab.addEventListener("click", startTabPlayback);
    el.stopTab.addEventListener("click", stopTabPlayback);

    el.addBar.addEventListener("click", () => addBarToPart());
    el.duplicateLast.addEventListener("click", duplicateLastBar);
    el.clearBars.addEventListener("click", clearAllBars);
    el.barsContainer.addEventListener("click", onBarsContainerClick);
    el.barsContainer.addEventListener("input", onBarsContainerInput);

    document.addEventListener("keydown", onGlobalKeyDown);
  }

  // ---------- Data helpers ----------
  function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return normalizeData(parsed);
      } catch (err) {
        console.warn("Failed to parse saved data, using default", err);
      }
    }
    return createDefaultData();
  }

  function normalizeData(raw) {
    const songs = Array.isArray(raw.songs)
      ? raw.songs
      : Array.isArray(raw)
      ? raw
      : [];
    const normalizedSongs = songs.map((song) => ({
      id: song.id || generateId(),
      title: song.title || "Untitled Song",
      goalBpm: Number(song.goalBpm) || 82,
      lastPartId: song.lastPartId || null,
      parts: (song.parts || []).map((part) =>
        normalizePart(part, song.goalBpm || 82, song.id)
      ),
    }));
    return {
      songs: normalizedSongs,
      activeSongId: raw.activeSongId || normalizedSongs[0]?.id || null,
      activePartId:
        raw.activePartId || normalizedSongs[0]?.parts[0]?.id || null,
    };
  }

  function normalizePart(part, goalBpm, songId) {
    const workingBpm = Number(part.workingBpm) || Number(goalBpm) || 60;
    const bars =
      Array.isArray(part.bars) && part.bars.length
        ? part.bars.map(normalizeBar)
        : [createEmptyBar(), createEmptyBar()];
    return {
      id: part.id || generateId(),
      songId: part.songId || songId || null,
      title: part.title || "New Part",
      workingBpm,
      learntState: part.learntState || "learning",
      bars,
    };
  }

  function normalizeBar(bar) {
    const grid =
      Array.isArray(bar?.grid) && bar.grid.length === 6
        ? bar.grid.map((row) => {
            const safeRow = Array.isArray(row) ? row : [];
            return Array.from({ length: RESOLUTION }, (_, idx) => {
              const val = safeRow[idx];
              return Number.isFinite(val) ? Number(val) : null;
            });
          })
        : createEmptyGrid();
    return {
      id: bar.id || generateId(),
      resolution: RESOLUTION,
      grid,
      note: typeof bar.note === "string" ? bar.note : "",
    };
  }

  function createDefaultData() {
    const songId = generateId();
    const partId = generateId();
    const demoBar = createEmptyBar();
    demoBar.grid[5][0] = 0;
    demoBar.grid[5][4] = 2;
    demoBar.note = "Try editing a fret number.";
    return {
      songs: [
        {
          id: songId,
          title: "Sample Song",
          goalBpm: 82,
          lastPartId: partId,
          parts: [
            {
              id: partId,
              songId,
              title: "Intro riff",
              workingBpm: 62,
              learntState: "learning",
              bars: [demoBar, createEmptyBar()],
            },
          ],
        },
      ],
      activeSongId: songId,
      activePartId: partId,
    };
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function createEmptyGrid() {
    return Array.from({ length: 6 }, () => Array(RESOLUTION).fill(null));
  }

  function createEmptyBar() {
    return {
      id: generateId(),
      resolution: RESOLUTION,
      grid: createEmptyGrid(),
      note: "",
    };
  }

  function generateId() {
    return `id-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  }

  function ensureSelection() {
    if (!data.songs.length) {
      data = createDefaultData();
    }
    if (!getActiveSong()) {
      data.activeSongId = data.songs[0].id;
    }
    const song = getActiveSong();
    if (song && !getActivePart()) {
      setActivePart(
        song.lastPartId && song.parts.some((p) => p.id === song.lastPartId)
          ? song.lastPartId
          : song.parts[0]?.id || null
      );
    }
  }

  // ---------- Rendering ----------
  function renderAll() {
    renderSongs();
    renderParts();
    updateBreadcrumb();
    updateControls();
    renderTabEditor();
  }

  function renderSongs() {
    el.songList.innerHTML = "";
    if (!data.songs.length) {
      const li = document.createElement("li");
      li.textContent = "No songs yet. Add one!";
      el.songList.appendChild(li);
      return;
    }

    data.songs.forEach((song) => {
      const li = document.createElement("li");
      li.className = `song-item${
        song.id === data.activeSongId ? " active" : ""
      }`;
      li.dataset.id = song.id;

      const row = document.createElement("div");
      row.className = "song-row";

      const meta = document.createElement("div");
      meta.className = "song-meta";
      const title = document.createElement("p");
      title.className = "song-title";
      title.textContent = song.title;
      const sub = document.createElement("p");
      sub.className = "song-sub";
      sub.textContent = `Goal ${song.goalBpm} BPM - ${song.parts.length} parts`;
      meta.append(title, sub);

      const actions = document.createElement("div");
      actions.className = "row-actions";
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.dataset.action = "edit-song";
      editBtn.dataset.id = song.id;
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "danger";
      deleteBtn.dataset.action = "delete-song";
      deleteBtn.dataset.id = song.id;
      actions.append(editBtn, deleteBtn);

      row.append(meta, actions);
      li.appendChild(row);
      el.songList.appendChild(li);
    });
  }

  function renderParts() {
    el.partList.innerHTML = "";
    const song = getActiveSong();
    if (!song) {
      const li = document.createElement("li");
      li.textContent = "Select or add a song.";
      el.partList.appendChild(li);
      return;
    }

    const filter = el.learntFilter.value;
    const parts = song.parts.filter(
      (p) => filter === "all" || p.learntState === filter
    );

    if (!parts.length) {
      const li = document.createElement("li");
      li.textContent = "No parts yet.";
      el.partList.appendChild(li);
      return;
    }

    parts.forEach((part) => {
      const li = document.createElement("li");
      li.className = `part-item${
        part.id === data.activePartId ? " active" : ""
      }`;
      li.dataset.id = part.id;

      const row = document.createElement("div");
      row.className = "part-row";
      const meta = document.createElement("div");
      meta.className = "part-meta";
      const title = document.createElement("p");
      title.className = "part-title";
      title.textContent = part.title;
      const sub = document.createElement("p");
      sub.className = "part-sub";
      sub.textContent = `${part.workingBpm} BPM - ${part.bars.length} bars`;
      meta.append(title, sub);

      const actions = document.createElement("div");
      actions.className = "row-actions";
      const stateBadge = document.createElement("span");
      stateBadge.className = `badge state-${part.learntState}`;
      stateBadge.textContent = part.learntState;
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.dataset.action = "edit-part";
      editBtn.dataset.id = part.id;
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "danger";
      delBtn.dataset.action = "delete-part";
      delBtn.dataset.id = part.id;
      actions.append(stateBadge, editBtn, delBtn);

      row.append(meta, actions);
      li.appendChild(row);
      el.partList.appendChild(li);
    });
  }

  function updateBreadcrumb() {
    const song = getActiveSong();
    const part = getActivePart();
    if (!song) {
      el.breadcrumb.textContent = "Select a song to begin";
      return;
    }
    if (!part) {
      el.breadcrumb.textContent = `${song.title} - add a part`;
      return;
    }
    el.breadcrumb.textContent = `${song.title} / ${part.title}`;
  }

  function updateControls() {
    const part = getActivePart();
    const hasPart = Boolean(part);
    el.bpmDisplay.value = part ? part.workingBpm : "";
    el.bpmDisplay.disabled = !hasPart;
    el.bpmDown.disabled = !hasPart;
    el.bpmUp.disabled = !hasPart;
    el.metronomeToggle.disabled = !hasPart;
    el.learntState.value = part ? part.learntState : "unlearnt";
    updateLearntBadge();

    el.playTab.disabled = !hasPart;
    el.stopTab.disabled = !hasPart;
    el.addBar.disabled = !hasPart;
    el.duplicateLast.disabled = !hasPart;
    el.clearBars.disabled = !hasPart;

    if (!hasPart) {
      stopPlayback();
    }
  }

  function updateLearntBadge() {
    const part = getActivePart();
    if (!part) {
      el.learntBadge.textContent = "State: -";
      el.learntBadge.className = "learnt-badge";
      return;
    }
    el.learntBadge.textContent = `State: ${part.learntState}`;
    el.learntBadge.className = `learnt-badge state-${part.learntState}`;
  }
  // ---------- Song + Part forms ----------
  function openSongForm(song = null) {
    el.songForm.classList.remove("hidden");
    el.songId.value = song ? song.id : "";
    el.songTitle.value = song ? song.title : "";
    el.songGoal.value = song ? song.goalBpm : 82;
    el.songTitle.focus();
  }

  function closeSongForm() {
    el.songForm.reset();
    el.songId.value = "";
    el.songForm.classList.add("hidden");
  }

  function onSongSubmit(event) {
    event.preventDefault();
    const title = el.songTitle.value.trim();
    const goalBpm = Number(el.songGoal.value) || 82;
    if (!title) return;
    const id = el.songId.value;

    if (id) {
      const song = data.songs.find((s) => s.id === id);
      if (song) {
        song.title = title;
        song.goalBpm = goalBpm;
      }
    } else {
      const songId = generateId();
      const partId = generateId();
      data.songs.push({
        id: songId,
        title,
        goalBpm,
        lastPartId: partId,
        parts: [
          {
            id: partId,
            songId,
            title: "Part 1",
            workingBpm: goalBpm || 60,
            learntState: "unlearnt",
            bars: [createEmptyBar(), createEmptyBar()],
          },
        ],
      });
      data.activeSongId = songId;
      setActivePart(partId);
    }
    saveData();
    closeSongForm();
    ensureSelection();
    stopPlayback();
    renderAll();
  }

  function onSongListClick(event) {
    const li = event.target.closest(".song-item");
    const action = event.target.dataset.action;
    const songId = event.target.dataset.id || (li ? li.dataset.id : null);
    if (!songId) return;

    if (action === "edit-song") {
      const song = data.songs.find((s) => s.id === songId);
      if (song) openSongForm(song);
      return;
    }

    if (action === "delete-song") {
      data.songs = data.songs.filter((s) => s.id !== songId);
      if (data.activeSongId === songId) {
        data.activeSongId = data.songs[0]?.id || null;
        data.activePartId = null;
      }
      ensureSelection();
      stopPlayback();
      saveData();
      renderAll();
      return;
    }

    if (li && songId !== data.activeSongId) {
      data.activeSongId = songId;
      const song = getActiveSong();
      setActivePart(
        song?.lastPartId && song.parts.some((p) => p.id === song.lastPartId)
          ? song.lastPartId
          : song?.parts[0]?.id || null
      );
      stopPlayback();
      saveData();
      renderAll();
    }
  }

  function openPartForm(part = null) {
    const song = getActiveSong();
    if (!song) return;
    el.partForm.classList.remove("hidden");
    el.partId.value = part ? part.id : "";
    el.partTitle.value = part ? part.title : "";
    el.partBpm.value = part ? part.workingBpm : song.goalBpm || 60;
    el.partTitle.focus();
  }

  function closePartForm() {
    el.partForm.reset();
    el.partId.value = "";
    el.partForm.classList.add("hidden");
  }

  function onPartSubmit(event) {
    event.preventDefault();
    const song = getActiveSong();
    if (!song) return;
    const title = el.partTitle.value.trim();
    const workingBpm = Number(el.partBpm.value) || song.goalBpm || 60;
    if (!title) return;
    const id = el.partId.value;

    if (id) {
      const part = song.parts.find((p) => p.id === id);
      if (part) {
        part.title = title;
        part.workingBpm = workingBpm;
      }
    } else {
      const partId = generateId();
      song.parts.push({
        id: partId,
        songId: song.id,
        title,
        workingBpm,
        learntState: "unlearnt",
        bars: [createEmptyBar(), createEmptyBar()],
      });
      song.lastPartId = partId;
      setActivePart(partId);
    }
    saveData();
    closePartForm();
    stopPlayback();
    renderAll();
  }

  function onPartListClick(event) {
    const li = event.target.closest(".part-item");
    const action = event.target.dataset.action;
    const partId = event.target.dataset.id || (li ? li.dataset.id : null);
    const song = getActiveSong();
    if (!song || !partId) return;

    if (action === "edit-part") {
      const part = song.parts.find((p) => p.id === partId);
      if (part) openPartForm(part);
      return;
    }

    if (action === "delete-part") {
      song.parts = song.parts.filter((p) => p.id !== partId);
      if (data.activePartId === partId) {
        setActivePart(song.parts[0]?.id || null);
      }
      ensureSelection();
      stopPlayback();
      saveData();
      renderAll();
      return;
    }

    if (li && partId !== data.activePartId) {
      setActivePart(partId);
      song.lastPartId = partId;
      stopPlayback();
      saveData();
      renderAll();
    }
  }

  // ---------- BPM + metronome ----------
  function adjustBpm(delta) {
    const part = getActivePart();
    if (!part) return;
    const next = Math.max(20, Math.min(260, part.workingBpm + delta));
    part.workingBpm = next;
    if (isMetronomeRunning && audioCtx) {
      nextMetronomeTick = audioCtx.currentTime + 0.05;
    }
    saveData();
    updateControls();
  }

  function onBpmInput() {
    const part = getActivePart();
    if (!part) return;
    const value = Number(el.bpmDisplay.value);
    if (Number.isFinite(value)) {
      part.workingBpm = Math.max(20, Math.min(260, value));
      if (isMetronomeRunning && audioCtx) {
        nextMetronomeTick = audioCtx.currentTime + 0.05;
      }
      saveData();
    }
  }

  function toggleMetronome() {
    if (isMetronomeRunning) {
      stopMetronome();
    } else {
      startMetronome();
    }
  }

  function startMetronome() {
    const part = getActivePart();
    if (!part) return;
    ensureAudio();
    isMetronomeRunning = true;
    nextMetronomeTick = audioCtx.currentTime + 0.05;
    if (metronomeTimer) clearInterval(metronomeTimer);
    metronomeTimer = setInterval(scheduleMetronome, METRONOME_LOOKAHEAD_MS);
    el.metronomeToggle.textContent = "Stop";
  }

  function stopMetronome() {
    isMetronomeRunning = false;
    if (metronomeTimer) {
      clearInterval(metronomeTimer);
      metronomeTimer = null;
    }
    el.metronomeIndicator.classList.remove("active");
    el.metronomeToggle.textContent = "Play";
  }

  function scheduleMetronome() {
    const part = getActivePart();
    if (!part || !isMetronomeRunning) return;
    const secondsPerBeat = 60 / part.workingBpm;
    const scheduleAheadTime = METRONOME_SCHEDULE_AHEAD;

    while (nextMetronomeTick < audioCtx.currentTime + scheduleAheadTime) {
      playClick(nextMetronomeTick);
      flashIndicator(nextMetronomeTick);
      nextMetronomeTick += secondsPerBeat;
    }
  }

  function flashIndicator(time) {
    const now = audioCtx.currentTime;
    const delay = Math.max(0, (time - now) * 1000);
    setTimeout(() => {
      el.metronomeIndicator.classList.add("active");
      setTimeout(() => el.metronomeIndicator.classList.remove("active"), 120);
    }, delay);
  }

  function playClick(time) {
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 950;
    gain.gain.value = 0.2;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  // ---------- Learnt state ----------
  function onLearntChange() {
    const part = getActivePart();
    if (!part) return;
    part.learntState = el.learntState.value;
    saveData();
    renderParts();
    updateLearntBadge();
  }
  // ---------- Tab editor ----------
  function renderTabEditor() {
    el.barsContainer.innerHTML = "";
    const part = getActivePart();
    if (!part) {
      const empty = document.createElement("p");
      empty.className = "empty-copy";
      empty.textContent = "No part selected.";
      el.barsContainer.appendChild(empty);
      return;
    }

    part.bars.forEach((bar, barIndex) => {
      const barWrapper = document.createElement("div");
      barWrapper.className = "bar";
      barWrapper.dataset.barId = bar.id;
      if (highlightState?.barId === bar.id) {
        barWrapper.classList.add("active");
      }

      const header = document.createElement("div");
      header.className = "bar-header";
      const title = document.createElement("strong");
      title.textContent = `Bar ${barIndex + 1}`;
      const actions = document.createElement("div");
      actions.className = "inline-actions";

      const duplicateBtn = document.createElement("button");
      duplicateBtn.textContent = "Duplicate";
      duplicateBtn.dataset.action = "duplicate-bar";
      duplicateBtn.dataset.barId = bar.id;

      const clearBtn = document.createElement("button");
      clearBtn.textContent = "Clear";
      clearBtn.dataset.action = "clear-bar";
      clearBtn.dataset.barId = bar.id;

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.className = "danger";
      removeBtn.dataset.action = "remove-bar";
      removeBtn.dataset.barId = bar.id;

      actions.append(duplicateBtn, clearBtn, removeBtn);
      header.append(title, actions);

      const grid = document.createElement("div");
      grid.className = "tab-grid";
      const displayStrings = STRINGS.slice().reverse();

      displayStrings.forEach((label, displayRow) => {
        const stringIndex = STRINGS.length - 1 - displayRow;
        const labelDiv = document.createElement("div");
        labelDiv.className = "tab-label";
        labelDiv.textContent = label;
        grid.appendChild(labelDiv);

        for (let step = 0; step < RESOLUTION; step++) {
          const cell = document.createElement("div");
          cell.className = "tab-cell";
          cell.dataset.barId = bar.id;
          cell.dataset.stringIndex = String(stringIndex);
          cell.dataset.stepIndex = String(step);
          const value = bar.grid[stringIndex][step];
          if (value !== null && value !== undefined) {
            cell.textContent = value;
          }
          if (
            selectedCell &&
            selectedCell.barId === bar.id &&
            selectedCell.stringIndex === stringIndex &&
            selectedCell.stepIndex === step
          ) {
            cell.classList.add("selected");
          }
          if (
            highlightState &&
            highlightState.barId === bar.id &&
            highlightState.stepIndex === step
          ) {
            cell.classList.add("play-highlight");
          }
          cell.addEventListener("click", () =>
            onCellClick(bar.id, stringIndex, step)
          );
          grid.appendChild(cell);
        }
      });

      const note = document.createElement("textarea");
      note.className = "bar-note";
      note.placeholder = "Bar note / reminder";
      note.value = bar.note || "";
      note.dataset.barId = bar.id;

      barWrapper.append(header, grid, note);
      el.barsContainer.appendChild(barWrapper);
    });

    if (pendingEdit) {
      startCellEdit(
        pendingEdit.barId,
        pendingEdit.stringIndex,
        pendingEdit.stepIndex,
        pendingEdit.initialValue
      );
      pendingEdit = null;
    }
  }

  function onCellClick(barId, stringIndex, stepIndex) {
    const part = getActivePart();
    if (!part) return;
    const bar = part.bars.find((b) => b.id === barId);
    if (!bar) return;
    const current = bar.grid[stringIndex][stepIndex];

    if (current === null || current === undefined) {
      bar.grid[stringIndex][stepIndex] = lastUsedFret;
      selectedCell = { barId, stringIndex, stepIndex };
      pendingEdit = {
        barId,
        stringIndex,
        stepIndex,
        initialValue: lastUsedFret,
      };
      saveData();
      renderTabEditor();
      return;
    }

    if (
      selectedCell &&
      selectedCell.barId === barId &&
      selectedCell.stringIndex === stringIndex &&
      selectedCell.stepIndex === stepIndex &&
      !editingCell
    ) {
      pendingEdit = { barId, stringIndex, stepIndex, initialValue: current };
      renderTabEditor();
      return;
    }

    selectedCell = { barId, stringIndex, stepIndex };
    renderTabEditor();
  }

  function startCellEdit(barId, stringIndex, stepIndex, initialValue) {
    const cell = findCellElement(barId, stringIndex, stepIndex);
    if (!cell) return;
    editingCell = { barId, stringIndex, stepIndex };
    cell.classList.add("selected");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "24";
    input.value = initialValue !== undefined ? initialValue : cell.textContent;
    cell.textContent = "";
    cell.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      const part = getActivePart();
      if (!part) return;
      const bar = part.bars.find((b) => b.id === barId);
      if (!bar) return;
      const parsed = parseFret(input.value);
      bar.grid[stringIndex][stepIndex] = parsed;
      if (parsed !== null) {
        lastUsedFret = parsed;
      }
      editingCell = null;
      saveData();
      renderTabEditor();
    };

    const cancel = () => {
      editingCell = null;
      renderTabEditor();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
    input.addEventListener("blur", commit);
  }

  function parseFret(value) {
    if (value === "" || value === null || value === undefined) return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const clamped = Math.max(0, Math.min(24, Math.round(num)));
    return clamped;
  }

  function findCellElement(barId, stringIndex, stepIndex) {
    return el.barsContainer.querySelector(
      `.tab-cell[data-bar-id="${barId}"][data-string-index="${stringIndex}"][data-step-index="${stepIndex}"]`
    );
  }

  function onBarsContainerClick(event) {
    const actionBtn = event.target.closest("button[data-action]");
    if (actionBtn) {
      const barId = actionBtn.dataset.barId;
      switch (actionBtn.dataset.action) {
        case "duplicate-bar":
          duplicateBar(barId);
          break;
        case "clear-bar":
          clearBar(barId);
          break;
        case "remove-bar":
          removeBar(barId);
          break;
      }
    }
  }

  function onBarsContainerInput(event) {
    if (event.target.classList.contains("bar-note")) {
      const barId = event.target.dataset.barId;
      const part = getActivePart();
      if (!part) return;
      const bar = part.bars.find((b) => b.id === barId);
      if (!bar) return;
      bar.note = event.target.value;
      saveData();
    }
  }

  function onGlobalKeyDown(event) {
    if (!selectedCell || editingCell) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    const { barId, stringIndex, stepIndex } = selectedCell;
    const part = getActivePart();
    if (!part) return;
    const bar = part.bars.find((b) => b.id === barId);
    if (!bar) return;

    if (event.key === "Backspace" || event.key === "Delete") {
      bar.grid[stringIndex][stepIndex] = null;
      saveData();
      renderTabEditor();
      event.preventDefault();
      return;
    }

    if (isDigit(event.key)) {
      pendingEdit = {
        barId,
        stringIndex,
        stepIndex,
        initialValue: event.key,
      };
      renderTabEditor();
      event.preventDefault();
    }
  }

  function isDigit(key) {
    return key.length === 1 && key >= "0" && key <= "9";
  }
  // ---------- Bar actions ----------
  function addBarToPart() {
    const part = getActivePart();
    if (!part) return;
    part.bars.push(createEmptyBar());
    saveData();
    renderTabEditor();
  }

  function duplicateLastBar() {
    const part = getActivePart();
    if (!part || !part.bars.length) return;
    const last = part.bars[part.bars.length - 1];
    const clone = duplicateBarData(last);
    part.bars.push(clone);
    saveData();
    renderTabEditor();
  }

  function duplicateBar(barId) {
    const part = getActivePart();
    if (!part) return;
    const bar = part.bars.find((b) => b.id === barId);
    if (!bar) return;
    const clone = duplicateBarData(bar);
    const index = part.bars.findIndex((b) => b.id === barId);
    part.bars.splice(index + 1, 0, clone);
    saveData();
    renderTabEditor();
  }

  function duplicateBarData(bar) {
    return {
      id: generateId(),
      resolution: RESOLUTION,
      grid: bar.grid.map((row) => row.slice()),
      note: bar.note || "",
    };
  }

  function clearBar(barId) {
    const part = getActivePart();
    if (!part) return;
    const bar = part.bars.find((b) => b.id === barId);
    if (!bar) return;
    bar.grid = createEmptyGrid();
    bar.note = "";
    saveData();
    renderTabEditor();
  }

  function removeBar(barId) {
    const part = getActivePart();
    if (!part) return;
    if (part.bars.length <= 1) return;
    part.bars = part.bars.filter((b) => b.id !== barId);
    saveData();
    renderTabEditor();
  }

  function clearAllBars() {
    const part = getActivePart();
    if (!part) return;
    part.bars = [createEmptyBar(), createEmptyBar()];
    saveData();
    renderTabEditor();
  }

  // ---------- Tab playback ----------
  function startTabPlayback() {
    const part = getActivePart();
    if (!part || !part.bars.length) return;
    ensureAudio();
    stopTabPlayback();
    playback = { timer: null, barIndex: 0, stepIndex: 0, running: true };
    queueNextStep(part, 50);
  }

  function stopTabPlayback() {
    playback.running = false;
    if (playback.timer) {
      clearTimeout(playback.timer);
      playback.timer = null;
    }
    clearHighlight();
  }

  function queueNextStep(part, delayMs) {
    if (!playback.running) return;
    playback.timer = setTimeout(() => {
      const currentPart = getActivePart();
      if (!currentPart || currentPart.id !== part.id) {
        stopTabPlayback();
        return;
      }
      playCurrentStep(currentPart);
    }, Math.max(0, delayMs));
  }

  function playCurrentStep(part) {
    // keep bar length constant regardless of resolution
    const stepDuration = (60 / part.workingBpm) * (4 / RESOLUTION);
    const bar = part.bars[playback.barIndex];
    const startTime = audioCtx.currentTime + 0.01;
    let hasNotes = false;
    bar.grid.forEach((row, stringIndex) => {
      const fret = row[playback.stepIndex];
      if (fret !== null && fret !== undefined) {
        hasNotes = true;
        playNote(stringIndex, fret, startTime);
      }
    });
    if (el.clickDuringPlay.checked && hasNotes) {
      playClick(startTime);
    }
    setHighlight(bar.id, playback.stepIndex);

    advancePlaybackState(part);
    if (!playback.running) {
      return;
    }
    playback.timer = setTimeout(
      () => playCurrentStep(part),
      Math.max(0, stepDuration * 1000)
    );
  }

  function playNote(stringIndex, fret, time) {
    ensureAudio();
    const midi = BASE_MIDI[stringIndex] + fret;
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.4);
  }

  function advancePlaybackState(part) {
    if (!playback.running) return;
    playback.stepIndex += 1;
    if (playback.stepIndex >= RESOLUTION) {
      playback.stepIndex = 0;
      playback.barIndex += 1;
      if (playback.barIndex >= part.bars.length) {
        if (el.loopTab.checked) {
          playback.barIndex = 0;
        } else {
          stopTabPlayback();
        }
      }
    }
  }

  function setHighlight(barId, stepIndex) {
    clearHighlight();
    highlightState = { barId, stepIndex };
    applyHighlight();
  }

  function clearHighlight() {
    if (!highlightState) return;
    document
      .querySelectorAll(
        `.tab-cell.play-highlight[data-bar-id="${highlightState.barId}"]`
      )
      .forEach((el) => el.classList.remove("play-highlight"));
    highlightState = null;
  }

  function applyHighlight() {
    if (!highlightState) return;
    document
      .querySelectorAll(
        `.tab-cell[data-bar-id="${highlightState.barId}"][data-step-index="${highlightState.stepIndex}"]`
      )
      .forEach((el) => el.classList.add("play-highlight"));
  }

  function stopPlayback() {
    stopMetronome();
    stopTabPlayback();
  }

  // ---------- Utils ----------
  function getActiveSong() {
    return data.songs.find((s) => s.id === data.activeSongId) || null;
  }

  function getActivePart() {
    const song = getActiveSong();
    if (!song) return null;
    return song.parts.find((p) => p.id === data.activePartId) || null;
  }

  function setActivePart(partId) {
    data.activePartId = partId;
    const song = getActiveSong();
    if (song) {
      song.lastPartId = partId;
    }
  }

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }
})();
