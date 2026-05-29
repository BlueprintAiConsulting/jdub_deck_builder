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

export const DECK_MATERIAL_OPTIONS = [
  { value: 'PT-SYP',     label: 'Pressure Treated (Pine)' },
  { value: 'CEDAR',      label: 'Cedar' },
  { value: 'REDWOOD',    label: 'Redwood' },
  { value: 'TIMBERTECH', label: 'Timbertech Composite' },
  { value: 'AZEK',       label: 'Azek PVC' },
];

export const DECK_MATERIAL_COLORS = {
  'PT-SYP':     '#c4a35a', // Golden Pine
  'CEDAR':      '#b5724b', // Red-Brown Cedar
  'REDWOOD':    '#8b3a3a', // Deep Red-Brown Redwood
  'TIMBERTECH': '#7e7568', // Modern warm gray/brown composite
  'AZEK':       '#4b4e52', // Premium slate/dark gray PVC
  // Legacy support
  'COMPOSITE':  '#7e7568',
  'PVC':        '#4b4e52',
};

export const DECK_COLOR_OPTIONS = {
  'PT-SYP': [
    { value: 'pine-natural', label: 'Natural Gold', color: '#c4a35a' }
  ],
  'CEDAR': [
    { value: 'cedar-natural', label: 'Natural Cedar', color: '#b5724b' }
  ],
  'REDWOOD': [
    { value: 'redwood-natural', label: 'Natural Redwood', color: '#8b3a3a' }
  ],
  'TIMBERTECH': [
    { value: 'tt-pecan', label: 'Legacy Pecan (Warm Tan)', color: '#8c6f56' },
    { value: 'tt-tigerwood', label: 'Legacy Tigerwood (Variegated Gold-Brown)', color: '#96603a' },
    { value: 'tt-mocha', label: 'Legacy Mocha (Deep Chocolate)', color: '#46382e' },
    { value: 'tt-ashwood', label: 'Legacy Ashwood (Silver Gray)', color: '#7a7d80' }
  ],
  'AZEK': [
    { value: 'azek-coastline', label: 'Vintage Coastline (Weathered Gray)', color: '#909294' },
    { value: 'azek-teak', label: 'Vintage Weathered Teak (Golden Teak)', color: '#a47c5c' },
    { value: 'azek-mahogany', label: 'Vintage Mahogany (Reddish Brown)', color: '#6b3f2e' },
    { value: 'azek-hickory', label: 'Vintage Dark Hickory (Dark Charcoal)', color: '#382f2d' },
    { value: 'azek-walnut', label: 'Vintage English Walnut (Rich Cocoa)', color: '#4b3c31' }
  ]
};
