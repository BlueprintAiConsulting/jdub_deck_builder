/** Material database */

export const SPECIES_OPTIONS = [
  { value: 'SYP',     label: 'Southern Yellow Pine (PT)',  abbr: 'PT-SYP' },
  { value: 'DF',      label: 'Douglas Fir',                abbr: 'DF' },
  { value: 'HEM-FIR', label: 'Hem-Fir',                    abbr: 'HF' },
  { value: 'SPF',     label: 'Spruce-Pine-Fir',            abbr: 'SPF' },
  { value: 'CEDAR',   label: 'Western Red Cedar',          abbr: 'Cedar' },
  { value: 'REDWOOD', label: 'Redwood',                    abbr: 'RW' },
];

export const JOIST_SIZES = ['2x6', '2x8', '2x10', '2x12'];
export const JOIST_SPACINGS = [12, 16, 24];
export const POST_SIZE_OPTIONS = ['4x4', '6x6'];
export const DECK_BOARD_OPTIONS = ['5/4x6', '2x6', '2x4', '1x6'];

export const BEAM_CONFIGS = [
  { value: '2-2x6',  label: '(2) 2×6' },
  { value: '2-2x8',  label: '(2) 2×8' },
  { value: '2-2x10', label: '(2) 2×10' },
  { value: '2-2x12', label: '(2) 2×12' },
  { value: '3-2x8',  label: '(3) 2×8' },
  { value: '3-2x10', label: '(3) 2×10' },
  { value: '3-2x12', label: '(3) 2×12' },
];

export const SOIL_CAPACITIES = [
  { value: 1500, label: 'Poor (1,500 psf)' },
  { value: 2000, label: 'Normal (2,000 psf)' },
  { value: 3000, label: 'Good (3,000 psf)' },
];

/** Wood color map for 3D rendering */
export const WOOD_COLORS = {
  'SYP':     '#c4a35a',
  'DF':      '#d4a860',
  'HEM-FIR': '#c9a06b',
  'SPF':     '#dbb97d',
  'CEDAR':   '#b5724b',
  'REDWOOD': '#8b3a3a',
};
