/**
 * DeckForge — Zustand State Store
 * Multi-section deck design with interactive placement.
 */
import { create } from 'zustand';
import { calculateAll } from '../engine/structuralCalc';
import { generateBOM, calculateSquareFootage, mergeBOMs } from '../engine/bomGenerator';
import { validateSectionsState } from '../utils/geometry';

// Initialize theme on load to prevent flash of wrong theme
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('deckforge_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', savedTheme === 'light' ? '#f8fafc' : '#060a14');
  }
}

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
  const base = {
    id: uid(),
    x: 0,           // position in inches (canvas origin)
    y: 0,
    width: 192,      // 16 ft
    depth: 144,      // 12 ft
    height: 36,      // 3 ft
    ledgerAttached: true,
    railings: { n: false, s: false, e: false, w: false },
    stairs: null,    // null | 'n' | 's' | 'e' | 'w'
    type: 'deck',    // 'deck' | 'landing'
  };
  const merged = { ...base, ...overrides };
  if (!merged.vertices) {
    merged.vertices = [
      { x: merged.x, y: merged.y },
      { x: merged.x + merged.width, y: merged.y },
      { x: merged.x + merged.width, y: merged.y + merged.depth },
      { x: merged.x, y: merged.y + merged.depth }
    ];
  }
  return merged;
}

function findAdjacentSection(sec, edge, allSections) {
  for (const other of allSections) {
    if (other.id === sec.id) continue;
    if (edge === 'e') {
      const touch = Math.abs((sec.x + sec.width) - other.x) <= 2;
      const overlap = Math.max(sec.y, other.y) < Math.min(sec.y + sec.depth, other.y + other.depth);
      if (touch && overlap) return other;
    } else if (edge === 'w') {
      const touch = Math.abs(sec.x - (other.x + other.width)) <= 2;
      const overlap = Math.max(sec.y, other.y) < Math.min(sec.y + sec.depth, other.y + other.depth);
      if (touch && overlap) return other;
    } else if (edge === 's') {
      const touch = Math.abs((sec.y + sec.depth) - other.y) <= 2;
      const overlap = Math.max(sec.x, other.x) < Math.min(sec.x + sec.width, other.x + other.width);
      if (touch && overlap) return other;
    } else if (edge === 'n') {
      const touch = Math.abs(sec.y - (other.y + other.depth)) <= 2;
      const overlap = Math.max(sec.x, other.x) < Math.min(sec.x + sec.width, other.x + other.width);
      if (touch && overlap) return other;
    }
  }
  return null;
}

function recalculateSection(section, materials, allSections = []) {
  let stairObj = section.stairs;
  if (typeof stairObj === 'string') {
    stairObj = {
      type: 'stair',
      width: 36,
      numberOfSteps: 5,
      rise: 7.25,
      run: 10,
      direction: stairObj,
      align: 'center',
    };
  }
  let stairRiseHeight = section.height;
  if (stairObj && stairObj.direction && allSections.length > 0) {
    const adjacent = findAdjacentSection(section, stairObj.direction, allSections);
    if (adjacent && section.height > adjacent.height) {
      stairRiseHeight = section.height - adjacent.height;
    }
  }
  const config = { ...materials, ...section, stairs: stairObj };
  const calcs = calculateAll({
    width: section.width,
    depth: section.depth,
    height: section.height,
    stairRiseHeight,
    joistSize: materials.joistSize,
    joistSpacing: materials.joistSpacing,
    species: materials.species,
    beamConfig: materials.beamConfig,
    postSize: materials.postSize,
    soilCapacity: materials.soilCapacity,
    stairs: stairObj,
  });
  const bom = generateBOM(config, calcs);
  return { calcs, bom };
}

function recalculateAll(sections, materials) {
  const sectionCalcs = {};
  const allBoms = [];
  let totalSqft = 0;

  sections.forEach((sec) => {
    const result = recalculateSection(sec, materials, sections);
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

// Keep section bounding box (x, y, width, depth) synchronized with vertices
function updateBoundingBoxFromVertices(section) {
  if (!section.vertices || section.vertices.length === 0) return section;
  const xs = section.vertices.map(v => v.x);
  const ys = section.vertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  section.x = minX;
  section.y = minY;
  section.width = maxX - minX;
  section.depth = maxY - minY;
  return section;
}

const initialSection = createSection();
const initialResults = recalculateAll([initialSection], DEFAULT_MATERIALS);

let nextToastId = 1;

export const useDeckStore = create((set, get) => ({
  // --- View State ---
  theme: typeof window !== 'undefined' ? (localStorage.getItem('deckforge_theme') || 'dark') : 'dark',
  viewMode: '2d',
  selectedTool: 'select',
  showGrid: true,
  zoom: 1,
  panOffset: { x: 0, y: 0 },

  // --- Sections ---
  sections: [initialSection],
  selectedSectionId: initialSection.id,
  materials: { ...DEFAULT_MATERIALS },
  currentProjectName: '',
  toast: null,
  isDirty: false,

  // --- Interaction State ---
  interaction: {
    mode: 'idle', // 'idle' | 'placing' | 'resizing' | 'moving' | 'dragging_vertex'
    dragStart: null,
    ghostRect: null,
    resizeHandle: null,
    selectedVertexIndex: null,
  },

  // --- Calculated Results (per section) ---
  sectionCalcs: initialResults.sectionCalcs,
  bom: initialResults.bom,
  sqft: initialResults.sqft,

  // --- History ---
  history: [{ sections: [{ ...initialSection }], materials: { ...DEFAULT_MATERIALS } }],
  historyIndex: 0,

  // --- Actions: View ---
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  setPanOffset: (offset) => set({ panOffset: offset }),
  toggleTheme: () => {
    const nextTheme = get().theme === 'light' ? 'dark' : 'light';
    if (typeof window !== 'undefined') {
      localStorage.setItem('deckforge_theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', nextTheme === 'light' ? '#f8fafc' : '#060a14');
      }
    }
    set({ theme: nextTheme });
  },
  setCurrentProjectName: (name) => set({ currentProjectName: name }),
  showToast: (message, type = 'success') => {
    const currentToast = get().toast;
    if (currentToast && currentToast.message === message && currentToast.type === type) {
      return;
    }
    const id = nextToastId++;
    set({ toast: { message, type, id } });
    setTimeout(() => {
      const t = get().toast;
      if (t && t.id === id) {
        set({ toast: null });
      }
    }, 3000);
  },
  hideToast: () => set({ toast: null }),
  setDirty: (dirty) => set({ isDirty: dirty }),

  // --- Actions: Interaction ---
  setInteraction: (updates) => set((s) => ({
    interaction: { ...s.interaction, ...updates },
  })),

  // --- Actions: Sections ---
  selectSection: (id) => set({ selectedSectionId: id }),

  addSection: (rect, type = 'deck') => {
    const state = get();
    const isLanding = type === 'landing';
    const minSize = isLanding ? 36 : 48;
    const defaultW = isLanding ? 36 : 144;
    const defaultD = isLanding ? 36 : 120;
    const snappedRect = {
      x: snapToGrid(rect.x),
      y: snapToGrid(rect.y),
      width: Math.max(minSize, snapToGrid(rect.width || defaultW)),
      depth: Math.max(minSize, snapToGrid(rect.depth || defaultD)),
    };
    const sec = createSection({
      ...snappedRect,
      type,
      ledgerAttached: type === 'landing' ? false : true,
    });

    // Edge snap
    const snaps = findEdgeSnap(sec, state.sections);
    if (snaps.x !== null) sec.x = snaps.x;
    if (snaps.y !== null) sec.y = snaps.y;

    // Recalculate vertices with final position
    sec.vertices = [
      { x: sec.x, y: sec.y },
      { x: sec.x + sec.width, y: sec.y },
      { x: sec.x + sec.width, y: sec.y + sec.depth },
      { x: sec.x, y: sec.y + sec.depth }
    ];

    const newSections = [...state.sections, sec];

    if (!validateSectionsState(newSections)) {
      state.showToast("Overlapping/intersecting layout is invalid", "error");
      return;
    }

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
      isDirty: true,
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
      isDirty: true,
    });
  },

  moveSection: (id, newX, newY) => {
    const state = get();
    const newSections = state.sections.map((s) => {
      if (s.id !== id) return s;
      const moved = { ...s };
      moved.x = snapToGrid(newX);
      moved.y = snapToGrid(newY);

      // Edge snap
      const snaps = findEdgeSnap(moved, state.sections);
      if (snaps.x !== null) moved.x = snaps.x;
      if (snaps.y !== null) moved.y = snaps.y;

      // Calculate translation delta
      const dx = moved.x - s.x;
      const dy = moved.y - s.y;

      // Move all vertices rigidly by the displacement delta
      moved.vertices = s.vertices.map((v) => ({
        x: v.x + dx,
        y: v.y + dy
      }));
      return moved;
    });

    if (!validateSectionsState(newSections)) {
      state.showToast("Overlapping/intersecting layout is invalid", "error");
      return;
    }

    // No recalculate needed for position-only moves (structure unchanged)
    set({ sections: newSections, isDirty: true });
  },

  finishMove: () => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: state.sections.map((s) => ({ ...s })), materials: { ...state.materials } });
    set({
      interaction: { mode: 'idle', dragStart: null, ghostRect: null, resizeHandle: null },
      history: newHistory,
      historyIndex: newHistory.length - 1,
      isDirty: true,
    });
  },

  resizeSection: (id, updates) => {
    const state = get();
    const newSections = state.sections.map((s) => {
      if (s.id !== id) return s;
      const minSize = s.type === 'landing' ? 36 : 48;
      const x = updates.x !== undefined ? snapToGrid(updates.x) : s.x;
      const y = updates.y !== undefined ? snapToGrid(updates.y) : s.y;
      const width = Math.max(minSize, snapToGrid(updates.width !== undefined ? updates.width : s.width));
      const depth = Math.max(minSize, snapToGrid(updates.depth !== undefined ? updates.depth : s.depth));
      return {
        ...s,
        x,
        y,
        width,
        depth,
        vertices: [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + depth },
          { x, y: y + depth }
        ]
      };
    });

    if (!validateSectionsState(newSections)) {
      state.showToast("Overlapping/intersecting layout is invalid", "error");
      return;
    }

    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });

    set({
      sections: newSections,
      ...results,
      interaction: { mode: 'idle', dragStart: null, ghostRect: null, resizeHandle: null },
      history: newHistory,
      historyIndex: newHistory.length - 1,
      isDirty: true,
    });
  },

  toggleRailing: (sectionId, edge) => {
    const state = get();
    let blocked = false;
    const newSections = state.sections.map((s) => {
      if (s.id !== sectionId) return s;
      if (edge === 'n' && s.ledgerAttached) {
        blocked = true;
        return s;
      }
      return { ...s, railings: { ...s.railings, [edge]: !s.railings[edge] } };
    });
    if (blocked) {
      state.showToast("Cannot add railing to house attachment edge", "warning");
      return;
    }
    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });
    set({ sections: newSections, ...results, history: newHistory, historyIndex: newHistory.length - 1, isDirty: true });
  },

  attachStairs: (sectionId, edge) => {
    const state = get();
    let blocked = false;
    const newSections = state.sections.map((s) => {
      if (s.id !== sectionId) return s;
      if (edge === 'n' && s.ledgerAttached) {
        blocked = true;
        return s;
      }
      const alreadyHasStairsOnEdge = s.stairs && (s.stairs.direction === edge || s.stairs === edge);
      return {
        ...s,
        stairs: alreadyHasStairsOnEdge
          ? null
          : {
              type: 'stair',
              width: 36,
              numberOfSteps: 5,
              rise: 7.25,
              run: 10,
              direction: edge,
              align: 'center',
            },
      };
    });
    if (blocked) {
      state.showToast("Cannot attach stairs to house wall", "warning");
      return;
    }
    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });
    set({ sections: newSections, ...results, history: newHistory, historyIndex: newHistory.length - 1, isDirty: true });
  },

  updateStairs: (sectionId, updates) => {
    const state = get();
    const newSections = state.sections.map((s) => {
      if (s.id !== sectionId) return s;
      if (!s.stairs) return s;
      let stairObj = s.stairs;
      if (typeof stairObj === 'string') {
        stairObj = {
          type: 'stair',
          width: 36,
          numberOfSteps: 5,
          rise: 7.25,
          run: 10,
          direction: stairObj,
        };
      }
      return { ...s, stairs: { ...stairObj, ...updates } };
    });
    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });
    set({ sections: newSections, ...results, history: newHistory, historyIndex: newHistory.length - 1, isDirty: true });
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
      const updated = { ...s, ...sectionUpdates };
      if (updated.ledgerAttached === true) {
        updated.railings = { ...updated.railings, n: false };
        if (updated.stairs && (updated.stairs === 'n' || updated.stairs.direction === 'n')) {
          updated.stairs = null;
        }
      }
      updated.vertices = [
        { x: updated.x, y: updated.y },
        { x: updated.x + updated.width, y: updated.y },
        { x: updated.x + updated.width, y: updated.y + updated.depth },
        { x: updated.x, y: updated.y + updated.depth }
      ];
      return updated;
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
      isDirty: true,
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
      isDirty: true,
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
      isDirty: true,
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
      currentProjectName: '',
      ...results,
      history: [{ sections: [{ ...sec }], materials: { ...mat } }],
      historyIndex: 0,
      isDirty: false,
    });
  },

  loadProject: (sections, materials) => {
    const normalizedSections = sections.map(s => {
      const type = s.type || 'deck';
      let stairObj = s.stairs;
      if (typeof stairObj === 'string') {
        stairObj = {
          type: 'stair',
          width: 36,
          numberOfSteps: 5,
          rise: 7.25,
          run: 10,
          direction: stairObj,
          align: 'center',
        };
      } else if (stairObj && typeof stairObj === 'object') {
        stairObj = {
          align: 'center',
          ...stairObj,
        };
      }
      const vertices = s.vertices || [
        { x: s.x, y: s.y },
        { x: s.x + s.width, y: s.y },
        { x: s.x + s.width, y: s.y + s.depth },
        { x: s.x, y: s.y + s.depth }
      ];
      const normalizedSection = {
        ...s,
        type,
        stairs: stairObj,
        vertices
      };
      if (normalizedSection.ledgerAttached === true) {
        if (!normalizedSection.railings) {
          normalizedSection.railings = { n: false, s: false, e: false, w: false };
        } else {
          normalizedSection.railings = { ...normalizedSection.railings, n: false };
        }
        if (normalizedSection.stairs && (normalizedSection.stairs === 'n' || normalizedSection.stairs.direction === 'n')) {
          normalizedSection.stairs = null;
        }
      }
      return normalizedSection;
    });

    const results = recalculateAll(normalizedSections, materials);
    
    // Dynamically update nextId to avoid conflicts with existing section IDs
    let maxId = 0;
    normalizedSections.forEach((s) => {
      const match = s.id.match(/^sec-(\d+)$/);
      if (match) {
        const idNum = parseInt(match[1]);
        if (idNum > maxId) maxId = idNum;
      }
    });
    nextId = maxId + 1;

    set({
      sections: normalizedSections.map((s) => ({ ...s })),
      selectedSectionId: normalizedSections[0]?.id || null,
      materials: { ...materials },
      ...results,
      history: [{ sections: normalizedSections.map((s) => ({ ...s })), materials: { ...materials } }],
      historyIndex: 0,
      isDirty: false,
    });
  },

  dragVertex: (id, vertexIndex, newX, newY) => {
    const state = get();
    const newSections = state.sections.map((s) => {
      if (s.id !== id) return s;
      const updated = { ...s };
      const updatedVertices = [...s.vertices];
      updatedVertices[vertexIndex] = {
        x: snapToGrid(newX),
        y: snapToGrid(newY)
      };
      updated.vertices = updatedVertices;
      return updateBoundingBoxFromVertices(updated);
    });

    if (!validateSectionsState(newSections)) {
      state.showToast("Overlapping/intersecting layout is invalid", "error");
      return;
    }

    const results = recalculateAll(newSections, state.materials);
    set({
      sections: newSections,
      ...results,
      isDirty: true,
    });
  },

  finishVertexDrag: () => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: state.sections.map((s) => ({ ...s })), materials: { ...state.materials } });
    set({
      interaction: {
        ...state.interaction,
        mode: 'idle',
        dragStart: null
      },
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  addVertex: (id, insertIndex, newVertex) => {
    const state = get();
    const newSections = state.sections.map((s) => {
      if (s.id !== id) return s;
      const updated = { ...s };
      const updatedVertices = [...s.vertices];
      updatedVertices.splice(insertIndex, 0, newVertex);
      updated.vertices = updatedVertices;
      return updateBoundingBoxFromVertices(updated);
    });

    if (!validateSectionsState(newSections)) {
      state.showToast("Overlapping/intersecting layout is invalid", "error");
      return;
    }

    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });

    set({
      sections: newSections,
      ...results,
      interaction: {
        ...state.interaction,
        mode: 'idle',
        selectedVertexIndex: insertIndex
      },
      history: newHistory,
      historyIndex: newHistory.length - 1,
      isDirty: true,
    });
  },

  removeVertex: (id, vertexIndex) => {
    const state = get();
    const newSections = state.sections.map((s) => {
      if (s.id !== id) return s;
      if (s.vertices.length <= 3) return s; // Minimum 3 vertices safety
      const updated = { ...s };
      const updatedVertices = [...s.vertices];
      updatedVertices.splice(vertexIndex, 1);
      updated.vertices = updatedVertices;
      return updateBoundingBoxFromVertices(updated);
    });

    const results = recalculateAll(newSections, state.materials);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ sections: newSections.map((s) => ({ ...s })), materials: { ...state.materials } });

    set({
      sections: newSections,
      ...results,
      interaction: {
        ...state.interaction,
        mode: 'idle',
        selectedVertexIndex: null
      },
      history: newHistory,
      historyIndex: newHistory.length - 1,
      isDirty: true,
    });
  },
}));

if (typeof window !== 'undefined') {
  window.useDeckStore = useDeckStore;
}

