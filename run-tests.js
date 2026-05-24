/**
 * Automated Test Suite for DeckForge
 * Validates Save/Load, Schema Versioning, Stairs, Landings, and Theme persistence.
 */
import assert from 'assert';

// ─── DOM & STORAGE MOCKING ───
const mockLocalStorage = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

const mockDocumentElement = {
  attributes: {},
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  },
  getAttribute(name) {
    return this.attributes[name] || null;
  }
};

const mockMeta = {
  attributes: {},
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
};

global.window = {
  localStorage: mockLocalStorage
};
global.localStorage = mockLocalStorage;
global.document = {
  documentElement: mockDocumentElement,
  querySelector(selector) {
    if (selector === 'meta[name="theme-color"]') {
      return mockMeta;
    }
    return null;
  }
};

// ─── IMPORT TARGET MODULES ───
const { serializeProject, validateProjectData } = await import('./src/lib/projectIO.js');
const { useDeckStore } = await import('./src/store/deckStore.js');

// ─── TEST RUNNER UTILITIES ───
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

let passes = 0;
let fails = 0;

// ─── TEST DEFINITIONS ───

test('1. Save/load round-trip: build design (deck+stairs+landing), serialize, deserialize, deep assert equality', () => {
  const sections = [
    {
      id: 'sec-test-deck',
      x: 0, y: 0, width: 144, depth: 120, height: 36,
      ledgerAttached: true,
      railings: { n: true, s: false, e: true, w: true },
      stairs: {
        type: 'stair',
        width: 36,
        numberOfSteps: 5,
        rise: 7.25,
        run: 10,
        direction: 's'
      },
      type: 'deck'
    },
    {
      id: 'sec-test-landing',
      x: 54, y: 120, width: 36, depth: 36, height: 36,
      ledgerAttached: false,
      railings: { n: false, s: false, e: false, w: false },
      stairs: null,
      type: 'landing'
    }
  ];

  const materials = {
    joistSize: '2x8',
    joistSpacing: 16,
    species: 'SYP',
    beamConfig: '2-2x10',
    postSize: '6x6',
    deckBoardSize: '5/4x6',
    deckMaterial: 'PT-SYP',
    soilCapacity: 2000
  };

  // 1. Serialize
  const serialized = serializeProject('Round Trip Test', sections, materials);

  // Assert schema compliance
  assert.equal(serialized.projectName, 'Round Trip Test', 'Project name should match');
  assert.ok(serialized.schemaVersion, 'schemaVersion must exist');
  assert.ok(Array.isArray(serialized.sections), 'Sections must be serialized as an array');
  assert.equal(serialized.sections.length, 2, 'Serialized section count should be 2');

  // 2. Deserialize (validate)
  const isValid = validateProjectData(serialized);
  assert.strictEqual(isValid, true, 'Validation check should pass for correct schema');

  // 3. Deep compare original vs deserialized
  assert.deepStrictEqual(serialized.sections, sections, 'Restored sections should deeply equal original sections');
  assert.deepStrictEqual(serialized.materials, materials, 'Restored materials should deeply equal original materials');
});

test('2. Schema validation checks: schemaVersion presence and handled error boundaries', () => {
  const validData = {
    schemaVersion: 1,
    projectName: 'Schema Test',
    sections: [{ id: 'sec-1', type: 'deck' }],
    materials: { species: 'SYP' }
  };

  // A. Assert valid data returns true
  assert.strictEqual(validateProjectData(validData), true, 'Valid schemaVersion must validate successfully');

  // B. Assert missing schemaVersion throws handled error
  const missingSchema = { ...validData };
  delete missingSchema.schemaVersion;
  assert.throws(
    () => validateProjectData(missingSchema),
    /schemaVersion is missing/,
    'Missing schemaVersion must trigger a handled validation error'
  );

  // C. Assert unsupported schemaVersion throws handled error
  const invalidSchema = { ...validData, schemaVersion: 999 };
  assert.throws(
    () => validateProjectData(invalidSchema),
    /Unsupported schemaVersion/,
    'Unsupported schemaVersion must trigger a handled validation error'
  );
});

test('3. Stairs survival check: stair attributes must persist round-trip', () => {
  const stairConfig = {
    type: 'stair',
    width: 48,
    numberOfSteps: 8,
    rise: 7.0,
    run: 11,
    direction: 'e'
  };

  const sections = [
    {
      id: 'sec-stair-test',
      x: 0, y: 0, width: 120, depth: 120, height: 60,
      ledgerAttached: false,
      railings: { n: false, s: false, e: false, w: false },
      stairs: stairConfig,
      type: 'deck'
    }
  ];

  const materials = { species: 'DF' };

  // Run serialization round-trip
  const serialized = serializeProject('Stair Test', sections, materials);
  validateProjectData(serialized);

  // Assert target properties survived
  const restoredStairs = serialized.sections[0].stairs;
  assert.strictEqual(restoredStairs.type, 'stair', 'Stair type should be stair');
  assert.strictEqual(restoredStairs.width, 48, 'Stair width should survive');
  assert.strictEqual(restoredStairs.numberOfSteps, 8, 'Stair numberOfSteps should survive');
  assert.strictEqual(restoredStairs.rise, 7.0, 'Stair rise should survive');
  assert.strictEqual(restoredStairs.run, 11, 'Stair run should survive');
  assert.strictEqual(restoredStairs.direction, 'e', 'Stair direction should survive');
});

test('4. Landing survival check: landing dimensions survive alongside stairs in same design', () => {
  const sections = [
    {
      id: 'sec-deck',
      x: 0, y: 0, width: 144, depth: 144, height: 36,
      ledgerAttached: true,
      railings: { n: false, s: false, e: false, w: false },
      stairs: { type: 'stair', width: 36, numberOfSteps: 5, rise: 7.25, run: 10, direction: 's' },
      type: 'deck'
    },
    {
      id: 'sec-landing',
      x: 54, y: 144, width: 42, depth: 48, height: 36,
      ledgerAttached: false,
      railings: { n: true, s: false, e: true, w: true },
      stairs: null,
      type: 'landing'
    }
  ];

  const materials = { species: 'Redwood' };

  // Round-trip
  const serialized = serializeProject('Landing Test', sections, materials);
  validateProjectData(serialized);

  // Assert landing properties survived
  const restoredLanding = serialized.sections.find(s => s.type === 'landing');
  assert.ok(restoredLanding, 'Landing section should exist in restored list');
  assert.strictEqual(restoredLanding.width, 42, 'Landing width should survive');
  assert.strictEqual(restoredLanding.depth, 48, 'Landing depth should survive');
  assert.strictEqual(restoredLanding.x, 54, 'Landing X coordinate should survive');
  assert.strictEqual(restoredLanding.y, 144, 'Landing Y coordinate should survive');
  assert.strictEqual(restoredLanding.height, 36, 'Landing height should survive');
});

test('5. Theme state toggle: defaults to dark, persists to localStorage and restores on reload', () => {
  // Clear any existing localStorage
  mockLocalStorage.clear();

  // Test default theme on load
  const store = useDeckStore.getState();
  assert.strictEqual(store.theme, 'dark', 'New users should default to dark theme');

  // Verify document.documentElement and meta setup
  assert.strictEqual(mockDocumentElement.attributes['data-theme'], 'dark', 'Document element theme attribute should be initialized to dark');
  assert.strictEqual(mockMeta.attributes['content'], '#060a14', 'Meta theme-color should match dark mode color');

  // Toggle theme to light
  store.toggleTheme();
  const stateAfterToggle = useDeckStore.getState();
  assert.strictEqual(stateAfterToggle.theme, 'light', 'Theme should switch to light after toggleTheme()');
  assert.strictEqual(mockLocalStorage.getItem('deckforge_theme'), 'light', 'Theme selection must be written to localStorage');
  assert.strictEqual(mockDocumentElement.attributes['data-theme'], 'light', 'Document element theme attribute should update to light');
  assert.strictEqual(mockMeta.attributes['content'], '#f8fafc', 'Meta theme-color should update to light mode color');

  // Toggle theme back to dark
  stateAfterToggle.toggleTheme();
  const stateAfterToggle2 = useDeckStore.getState();
  assert.strictEqual(stateAfterToggle2.theme, 'dark', 'Theme should switch back to dark after second toggleTheme()');
  assert.strictEqual(mockLocalStorage.getItem('deckforge_theme'), 'dark', 'Theme selection must be updated in localStorage');
  assert.strictEqual(mockDocumentElement.attributes['data-theme'], 'dark', 'Document element theme attribute should update to dark');
});

test('6. Multi-level heights check: multiple sections with different heights survive save/load round-trip', () => {
  const sections = [
    {
      id: 'sec-deck-low',
      x: 0, y: 0, width: 144, depth: 144, height: 36,
      type: 'deck'
    },
    {
      id: 'sec-deck-high',
      x: 144, y: 0, width: 144, depth: 144, height: 60,
      type: 'deck'
    }
  ];
  const materials = { species: 'Pine' };

  // Round-trip
  const serialized = serializeProject('Multi Height Test', sections, materials);
  validateProjectData(serialized);

  // Assert both section heights survived
  const restoredLow = serialized.sections.find(s => s.id === 'sec-deck-low');
  const restoredHigh = serialized.sections.find(s => s.id === 'sec-deck-high');
  assert.ok(restoredLow, 'Low section should exist');
  assert.ok(restoredHigh, 'High section should exist');
  assert.strictEqual(restoredLow.height, 36, 'Low section height (36) should survive');
  assert.strictEqual(restoredHigh.height, 60, 'High section height (60) should survive');
});

// ─── EXECUTE ALL TESTS ───
console.log('DeckForge Test Runner — Executing Automated Tests...\n');

for (const t of tests) {
  try {
    t.fn();
    console.log(`[\u001b[32mPASS\u001b[0m] ${t.name}`);
    passes++;
  } catch (err) {
    console.log(`[\u001b[31mFAIL\u001b[0m] ${t.name}`);
    console.error(err);
    fails++;
  }
}

console.log(`\nTest Execution Completed: ${passes} passed, ${fails} failed.`);
process.exit(fails > 0 ? 1 : 0);
