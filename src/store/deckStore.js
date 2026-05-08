/**
 * DeckForge — Zustand State Store
 * Central state management for the deck design app.
 */
import { create } from 'zustand';
import { calculateAll } from '../engine/structuralCalc';
import { generateBOM, calculateSquareFootage } from '../engine/bomGenerator';

const DEFAULT_DECK = {
  width: 192,    // 16 ft in inches
  depth: 144,    // 12 ft in inches
  height: 36,    // 3 ft in inches
  joistSize: '2x8',
  joistSpacing: 16,
  species: 'SYP',
  beamConfig: '2-2x10',
  postSize: '6x6',
  deckBoardSize: '5/4x6',
  deckMaterial: 'PT-SYP',
  ledgerAttached: true,
  soilCapacity: 2000,
};

function recalculate(deck) {
  const calcs = calculateAll({
    width: deck.width,
    depth: deck.depth,
    height: deck.height,
    joistSize: deck.joistSize,
    joistSpacing: deck.joistSpacing,
    species: deck.species,
    beamConfig: deck.beamConfig,
    postSize: deck.postSize,
    soilCapacity: deck.soilCapacity,
  });

  const bom = generateBOM({
    ...deck,
  }, calcs);

  const sqft = calculateSquareFootage(deck.width, deck.depth);

  return { calcs, bom, sqft };
}

const initialCalcs = recalculate(DEFAULT_DECK);

export const useDeckStore = create((set, get) => ({
  // --- View State ---
  viewMode: '2d', // '2d' | '3d'
  selectedTool: 'select', // 'select' | 'rectangle' | 'stairs' | 'railing'
  showGrid: true,
  zoom: 1,
  panOffset: { x: 0, y: 0 },

  // --- Deck Configuration ---
  deck: { ...DEFAULT_DECK },

  // --- Calculated Results ---
  calcs: initialCalcs.calcs,
  bom: initialCalcs.bom,
  sqft: initialCalcs.sqft,

  // --- History (undo/redo) ---
  history: [{ ...DEFAULT_DECK }],
  historyIndex: 0,

  // --- Actions ---
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  setPanOffset: (offset) => set({ panOffset: offset }),

  updateDeck: (updates) => {
    const state = get();
    const newDeck = { ...state.deck, ...updates };
    const results = recalculate(newDeck);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({ ...newDeck });
    set({
      deck: newDeck,
      ...results,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  setDimension: (key, valueInches) => {
    const val = Math.max(12, Math.min(480, valueInches));
    get().updateDeck({ [key]: val });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const prevDeck = history[historyIndex - 1];
    const results = recalculate(prevDeck);
    set({
      deck: { ...prevDeck },
      ...results,
      historyIndex: historyIndex - 1,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const nextDeck = history[historyIndex + 1];
    const results = recalculate(nextDeck);
    set({
      deck: { ...nextDeck },
      ...results,
      historyIndex: historyIndex + 1,
    });
  },

  resetDeck: () => {
    const results = recalculate(DEFAULT_DECK);
    set({
      deck: { ...DEFAULT_DECK },
      ...results,
      history: [{ ...DEFAULT_DECK }],
      historyIndex: 0,
    });
  },
}));
