/**
 * DeckForge — Zustand State Store
 * Multi-section deck design with interactive placement.
 */
import { create } from 'zustand';
import { calculateAll } from '../engine/structuralCalc';
import { generateBOM, calculateSquareFootage, mergeBOMs } from '../engine/bomGenerator';

let nextId = 1;
function uid() { return `sec-${nextId++}`; }

const DEFAULT_MATERIALS = {
  joistSize: '2x8',
  joistSpacing: 16,
  species: 'SYP',
  beamConfig: '2-2x10',
  postSize: '6x6',
  deckBoardSize: '5/4x6',
  deckMaterial: 'PT-SYP',
  soilCapacity: 2000,
};

function createSection(overrides = {}) {
  return {
    id: uid(),
    x: 0,           // position in inches (canvas origin)
    y: 0,
    width: 192,      // 16 ft
    depth: 144,      // 12 ft
    height: 36,      // 3 ft
    ledgerAttached: true,
    railings: { n: false, s: false, e: false, w: false },
    stairs: null,    // null | 'n' | 's' | 'e' | 'w'
    ...overrides,
  };
}

function recalculateSection(section, materials) {
  const config = { ...materials, ...section };
  const calcs = calculateAll({
    width: section.width,
    depth: section.depth,
    height: section.height,
    joistSize: materials.joistSize,
    joistSpacing: materials.joistSpacing,
    species: materials.species,
    beamConfig: materials.beamConfig,
    postSize: materials.postSize,
    soilCapacity: materials.soilCapacity,
  });
  const bom = generateBOM(config, calcs);
  return { calcs, bom };
}

function recalculateAll(sections, materials) {
  const sectionCalcs = {};
  const allBoms = [];
  let totalSqft = 0;

  sections.forEach((sec) => {
    const result = recalculateSection(sec, materials);
    sectionCalcs[sec.id] = result.calcs;
    allBoms.push(result.bom);
    totalSqft += calculateSquareFootage(sec.width, sec.depth);
  });

  const mergedBom = mergeBOMs(allBoms);
  return { sectionCalcs, bom: mergedBom, sqft: totalSqft };
}

// Snap a value to nearest grid increment
function snapToGrid(value, gridSize = 12) {
  return Math.round(value / gridSize) * gridSize;
}

// Check if two sections' edges are close enough to snap
function findEdgeSnap(movingSection, allSections, threshold = 12) {
  const snaps = { x: null, y: null };
  const m = movingSection;

  for (const sec of allSections) {
    if (sec.id === m.id) continue;

    // Right edge of moving → Left edge of target
    if (Math.abs((m.x + m.width) - sec.x) < threshold) snaps.x = sec.x - m.width;
    // Left edge of moving → Right edge of target
    if (Math.abs(m.x - (sec.x + sec.width)) < threshold) snaps.x = sec.x + sec.width;
    // Bottom edge of moving → Top edge of target
    if (Math.abs((m.y + m.depth) - sec.y) < threshold) snaps.y = sec.y - m.depth;
    // Top edge of moving → Bottom edge of target
    if (Math.abs(m.y - (sec.y + sec.depth)) < threshold) snaps.y = sec.y + sec.depth;
  }

  return snaps;
}

const initialSection = createSection();
const initialResults = recalculateAll([initialSection], DEFAULT_MATERIALS);

export const useDeckStore = create((set, get) => ({
  // --- View State ---
  viewMode: '2d',
  selectedTool: 'select',
  showGrid: true,
  zoom: 1,
  panOffset: { x: 0, y: 0 },

  // --- Sections ---
  sections: [initialSection],
  selectedSectionId: initialSection.id,
  materials: { ...DEFAULT_MATERIALS },

  // --- Interaction State ---
  interaction: {
    mode: 'idle', // 'idle' | 'placing' | 'resizing' | 'moving'
    dragStart: null,
    ghostRect: null,
    resizeHandle: null,
  },

  // --- Calculated Results (per section) ---
  sectionCalcs: initialResults.sectionCalcs,
  bom: initialResults.bom,
  sqft: initialResults.sqft,

  // --- Legacy compatibility (for components still reading deck/calcs) ---
  get deck() {
    const state = get();
    const sec = state.sections.find((s) => s.id === state.selectedSectionId) || state.sections[0];
    return { ...state.materials, ...sec };
  },
  get calcs() {
    const state = get();
    return state.sectionCalcs[state.selectedSectionId] || Object.values(state.sectionCalcs)[0];
  },

  // --- History ---
  history: [{ sections: [{ ...initialSection }], materials: { ...DEFAULT_MATERIALS } }],
  historyIndex: 0,

  // --- Actions: View ---
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  setPanOffset: (offset) => set({ panOffset: offset }),

  // --- Actions: Interaction ---
  setInteraction: (updates) => set((s) => ({
    interaction: { ...s.interaction, ...updates },
  })),

  // --- Actions: Sections ---
  selectSection: (id) => set({ selectedSectionId: id }),

  addSection: (rect) => {
    const state = get();
    const snappedRect = {
      x: snapToGrid(rect.x),
      y: snapToGrid(rect.y),
      width: Math.max(48, snapToGrid(rect.width || 144)),  // min 4ft
      depth: Math.max(48, snapToGrid(rect.depth || 120)),   // min 4ft
    };
    const sec = createSection(snappedRect);

    // Edge snap
    const snaps = findEdgeSnap(sec, state.sections);
    if (snaps.x !== null) sec.x = snaps.x;
    if (snaps.y !== null) sec.y = snaps.y;

    const newSections = [...state.sections, sec];
    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });

    set({
      sections: newSections,
      selectedSectionId: sec.id,
      selectedTool: 'select',
      interaction: { mode: 'idle', dragStart: null, ghostRect: null, resizeHandle: null },
      ...results,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  removeSection: (id) => {
    const state = get();
    if (state.sections.length <= 1) return; // can't delete last section
    const newSections = state.sections.filter((s) => s.id !== id);
    const newSelected = state.selectedSectionId === id ? newSections[0].id : state.selectedSectionId;
    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });

    set({
      sections: newSections,
      selectedSectionId: newSelected,
      ...results,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  moveSection: (id, newX, newY) => {
    const state = get();
    const newSections = state.sections.map((s) => {
      if (s.id !== id) return s;
      const moved = { ...s, x: snapToGrid(newX), y: snapToGrid(newY) };
      // Edge snap
      const snaps = findEdgeSnap(moved, state.sections);
      if (snaps.x !== null) moved.x = snaps.x;
      if (snaps.y !== null) moved.y = snaps.y;
      return moved;
    });
    // No recalculate needed for position-only moves (structure unchanged)
    set({ sections: newSections });
  },

  finishMove: () => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: state.sections.map((s) => ({ ...s })), materials: { ...state.materials } });
    set({
      interaction: { mode: 'idle', dragStart: null, ghostRect: null, resizeHandle: null },
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  resizeSection: (id, updates) => {
    const state = get();
    const newSections = state.sections.map((s) => {
      if (s.id !== id) return s;
      return {
        ...s,
        x: updates.x !== undefined ? snapToGrid(updates.x) : s.x,
        y: updates.y !== undefined ? snapToGrid(updates.y) : s.y,
        width: Math.max(48, snapToGrid(updates.width !== undefined ? updates.width : s.width)),
        depth: Math.max(48, snapToGrid(updates.depth !== undefined ? updates.depth : s.depth)),
      };
    });
    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });

    set({
      sections: newSections,
      ...results,
      interaction: { mode: 'idle', dragStart: null, ghostRect: null, resizeHandle: null },
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  toggleRailing: (sectionId, edge) => {
    const state = get();
    const newSections = state.sections.map((s) => {
      if (s.id !== sectionId) return s;
      return { ...s, railings: { ...s.railings, [edge]: !s.railings[edge] } };
    });
    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });
    set({ sections: newSections, ...results, history: newHistory, historyIndex: newHistory.length - 1 });
  },

  attachStairs: (sectionId, edge) => {
    const state = get();
    const newSections = state.sections.map((s) => {
      if (s.id !== sectionId) return s;
      return { ...s, stairs: s.stairs === edge ? null : edge }; // toggle
    });
    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });
    set({ sections: newSections, ...results, history: newHistory, historyIndex: newHistory.length - 1 });
  },

  // --- Actions: Deck Config (applies to selected section or global materials) ---
  updateDeck: (updates) => {
    const state = get();
    const dimensionKeys = ['width', 'depth', 'height', 'ledgerAttached'];
    const sectionUpdates = {};
    const materialUpdates = {};

    Object.entries(updates).forEach(([key, val]) => {
      if (dimensionKeys.includes(key)) sectionUpdates[key] = val;
      else materialUpdates[key] = val;
    });

    const newMaterials = { ...state.materials, ...materialUpdates };
    const newSections = state.sections.map((s) => {
      if (s.id !== state.selectedSectionId) return s;
      return { ...s, ...sectionUpdates };
    });

    const results = recalculateAll(newSections, newMaterials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...newMaterials } });

    set({
      sections: newSections,
      materials: newMaterials,
      ...results,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  setDimension: (key, valueInches) => {
    const val = Math.max(12, Math.min(480, valueInches));
    get().updateDeck({ [key]: val });
  },

  // --- Undo / Redo ---
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    const results = recalculateAll(prev.sections, prev.materials);
    set({
      sections: prev.sections.map((s) => ({ ...s })),
      materials: { ...prev.materials },
      selectedSectionId: prev.sections[0]?.id,
      ...results,
      historyIndex: historyIndex - 1,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    const results = recalculateAll(next.sections, next.materials);
    set({
      sections: next.sections.map((s) => ({ ...s })),
      materials: { ...next.materials },
      selectedSectionId: next.sections[0]?.id,
      ...results,
      historyIndex: historyIndex + 1,
    });
  },

  resetDeck: () => {
    nextId = 1;
    const sec = createSection();
    const mat = { ...DEFAULT_MATERIALS };
    const results = recalculateAll([sec], mat);
    set({
      sections: [sec],
      selectedSectionId: sec.id,
      materials: mat,
      ...results,
      history: [{ sections: [{ ...sec }], materials: { ...mat } }],
      historyIndex: 0,
    });
  },
}));
