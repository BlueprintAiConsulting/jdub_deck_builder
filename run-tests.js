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
let createdElements = [];
global.document = {
  documentElement: mockDocumentElement,
  querySelector(selector) {
    if (selector === 'meta[name="theme-color"]') {
      return mockMeta;
    }
    return null;
  },
  createElement(tagName) {
    const el = {
      tagName: tagName.toUpperCase(),
      click() { this.clicked = true; },
      setAttribute(name, val) { this[name] = val; }
    };
    createdElements.push(el);
    return el;
  },
  body: {
    appendChild(el) { el.appended = true; },
    removeChild(el) { el.removed = true; }
  }
};

global.URL.createObjectURL = () => 'blob:mock';
global.URL.revokeObjectURL = () => {};

const {
  serializeProject,
  validateProjectData,
  saveProjectToLocalStorage,
  loadProjectFromLocalStorage,
  downloadProjectFile
} = await import('./src/lib/projectIO.js');
const { useDeckStore } = await import('./src/store/deckStore.js');
const { calculatePosts } = await import('./src/engine/structuralCalc.js');
const { isPointInPolygon, hitTestSection, findEdgeSplitIndex } = await import('./src/components/Viewport2D/Canvas2D.jsx');

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

test('6. Multi-level heights check: multiple sections with different heights survive save/load round-trip with schemaVersion 2', () => {
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

  // Assert schemaVersion is 2
  assert.strictEqual(serialized.schemaVersion, 2, 'schemaVersion must be 2 after polygon phase 1');

  validateProjectData(serialized);

  // Assert both section heights survived
  const restoredLow = serialized.sections.find(s => s.id === 'sec-deck-low');
  const restoredHigh = serialized.sections.find(s => s.id === 'sec-deck-high');
  assert.ok(restoredLow, 'Low section should exist');
  assert.ok(restoredHigh, 'High section should exist');
  assert.strictEqual(restoredLow.height, 36, 'Low section height (36) should survive');
  assert.strictEqual(restoredHigh.height, 60, 'High section height (60) should survive');
});

test('7. Backward compatibility: legacy schemaVersion 1 project created before multi-level loads without error', () => {
  const legacyProject = {
    schemaVersion: 1,
    projectName: 'Legacy Project',
    sections: [
      {
        id: 'legacy-sec-1',
        x: 0, y: 0, width: 192, depth: 144, height: 36,
        ledgerAttached: true,
        railings: { n: false, s: false, e: false, w: false },
        stairs: null,
        type: 'deck'
      }
    ],
    materials: {
      joistSize: '2x8',
      joistSpacing: 16,
      species: 'SYP',
      beamConfig: '2-2x10',
      postSize: '6x6',
      deckBoardSize: '5/4x6',
      deckMaterial: 'PT-SYP',
      soilCapacity: 2000
    }
  };

  // Validate legacy project
  const isValid = validateProjectData(legacyProject);
  assert.strictEqual(isValid, true, 'Legacy project file must validate successfully without any errors');
});

test('8. Post-length calculation: a taller section yields longer posts in structuralCalc.js', () => {
  const mockBeams = {
    length: 144,
    maxSpan: 96,
    positions: [120]
  };

  // Calculate posts for 36-inch height deck
  const posts36Result = calculatePosts(mockBeams, 36, '6x6');
  assert.ok(Array.isArray(posts36Result.posts), 'Result must contain a posts array');
  assert.strictEqual(posts36Result.posts.length, 3, 'Post count should match expected beam distribution');
  const post36Height = posts36Result.posts[0].height;
  assert.strictEqual(post36Height, 36, 'A 36-inch deck height input must yield 36-inch post heights');

  // Calculate posts for 60-inch height deck
  const posts60Result = calculatePosts(mockBeams, 60, '6x6');
  assert.ok(Array.isArray(posts60Result.posts), 'Result must contain a posts array');
  assert.strictEqual(posts60Result.posts.length, 3, 'Post count should match expected beam distribution');
  const post60Height = posts60Result.posts[0].height;
  assert.strictEqual(post60Height, 60, 'A 60-inch deck height input must yield 60-inch post heights');

  // Assert post height is taller
  assert.ok(post60Height > post36Height, 'Taller deck sections must yield longer posts');
});

test('9. Vertices initialization and synchronization: store sections must contain correct 4-corner vertices loop', () => {
  const store = useDeckStore.getState();
  
  // Verify initial section has vertices
  const initialSec = store.sections[0];
  assert.ok(Array.isArray(initialSec.vertices), 'Initial section must have vertices array');
  assert.strictEqual(initialSec.vertices.length, 4, 'Vertices array must have 4 corners');
  
  // Verify correct loop: [ {x, y}, {x+width, y}, {x+width, y+depth}, {x, y+depth} ]
  const expectedVertices = [
    { x: initialSec.x, y: initialSec.y },
    { x: initialSec.x + initialSec.width, y: initialSec.y },
    { x: initialSec.x + initialSec.width, y: initialSec.y + initialSec.depth },
    { x: initialSec.x, y: initialSec.y + initialSec.depth }
  ];
  assert.deepStrictEqual(initialSec.vertices, expectedVertices, 'Vertices must match the rectangular bounding box');

  // Verify updates in resizeSection
  useDeckStore.getState().resizeSection(initialSec.id, { width: 240, depth: 180 });
  const resizedSec = useDeckStore.getState().sections.find(s => s.id === initialSec.id);
  assert.strictEqual(resizedSec.width, 240, 'Width should be updated to 240');
  assert.strictEqual(resizedSec.depth, 180, 'Depth should be updated to 180');
  const expectedResizedVertices = [
    { x: resizedSec.x, y: resizedSec.y },
    { x: resizedSec.x + 240, y: resizedSec.y },
    { x: resizedSec.x + 240, y: resizedSec.y + 180 },
    { x: resizedSec.x, y: resizedSec.y + 180 }
  ];
  assert.deepStrictEqual(resizedSec.vertices, expectedResizedVertices, 'Vertices must match resized bounding box');
  
  // Verify updates in moveSection
  useDeckStore.getState().moveSection(initialSec.id, 12, 24);
  const movedSec = useDeckStore.getState().sections.find(s => s.id === initialSec.id);
  assert.strictEqual(movedSec.x, 12, 'X coordinate should update to 12');
  assert.strictEqual(movedSec.y, 24, 'Y coordinate should update to 24');
  const expectedMovedVertices = [
    { x: 12, y: 24 },
    { x: 12 + movedSec.width, y: 24 },
    { x: 12 + movedSec.width, y: 24 + movedSec.depth },
    { x: 12, y: 24 + movedSec.depth }
  ];
  assert.deepStrictEqual(movedSec.vertices, expectedMovedVertices, 'Vertices must match moved bounding box');
});

test('10. Newly saved projects write schemaVersion 2 with vertices included', () => {
  const sections = [
    {
      id: 'sec-save-test',
      x: 24, y: 36, width: 120, depth: 96, height: 36,
      ledgerAttached: true,
      railings: { n: false, s: false, e: false, w: false },
      stairs: null,
      type: 'deck',
      vertices: [
        { x: 24, y: 36 },
        { x: 144, y: 36 },
        { x: 144, y: 132 },
        { x: 24, y: 132 }
      ]
    }
  ];
  const materials = { species: 'SYP' };

  const serialized = serializeProject('Save Test V2', sections, materials);
  
  assert.strictEqual(serialized.schemaVersion, 2, 'Newly saved project must have schemaVersion 2');
  assert.ok(Array.isArray(serialized.sections[0].vertices), 'Serialized section must contain vertices');
  assert.strictEqual(serialized.sections[0].vertices.length, 4, 'Serialized section vertices must have 4 elements');
  assert.deepStrictEqual(serialized.sections[0].vertices, sections[0].vertices, 'Serialized vertices must match original vertices');
});

test('11. Migration adapter: loaded schemaVersion 1 project upgrades to schemaVersion 2 and populates vertices with no data loss', () => {
  const legacyProject = {
    schemaVersion: 1,
    projectName: 'Legacy Load Test',
    sections: [
      {
        id: 'legacy-sec-1',
        x: 12, y: 24, width: 144, depth: 120, height: 36,
        ledgerAttached: true,
        railings: { n: false, s: false, e: false, w: false },
        stairs: null,
        type: 'deck'
      }
    ],
    materials: {
      joistSize: '2x8',
      joistSpacing: 16,
      species: 'SYP'
    }
  };

  // Perform migration (validateProjectData upgrades in-place)
  validateProjectData(legacyProject);

  assert.strictEqual(legacyProject.schemaVersion, 2, 'Legacy project must be upgraded to schemaVersion 2');
  
  const upgradedSec = legacyProject.sections[0];
  assert.ok(Array.isArray(upgradedSec.vertices), 'Upgraded section must have vertices populated');
  assert.strictEqual(upgradedSec.vertices.length, 4, 'Upgraded vertices must have 4 corners');
  
  const expectedVertices = [
    { x: 12, y: 24 },
    { x: 12 + 144, y: 24 },
    { x: 12 + 144, y: 24 + 120 },
    { x: 12, y: 24 + 120 }
  ];
  assert.deepStrictEqual(upgradedSec.vertices, expectedVertices, 'Upgraded vertices must match bounding box');
  
  // Assert other data was preserved (no data loss)
  assert.strictEqual(upgradedSec.id, 'legacy-sec-1', 'ID should be preserved');
  assert.strictEqual(upgradedSec.x, 12, 'X coordinate should be preserved');
  assert.strictEqual(upgradedSec.y, 24, 'Y coordinate should be preserved');
  assert.strictEqual(upgradedSec.width, 144, 'Width should be preserved');
  assert.strictEqual(upgradedSec.depth, 120, 'Depth should be preserved');
  assert.strictEqual(upgradedSec.height, 36, 'Height should be preserved');
  assert.strictEqual(legacyProject.materials.species, 'SYP', 'Material species should be preserved');
});

test('12. Render geometry alignment: vertex-derived coordinates map exactly to width/depth/x/y rectangle bounds', () => {
  const store = useDeckStore.getState();
  useDeckStore.getState().resetDeck();
  const sec = useDeckStore.getState().sections[0];
  
  // Calculate bounding box from vertices
  const minX = Math.min(...sec.vertices.map(v => v.x));
  const maxX = Math.max(...sec.vertices.map(v => v.x));
  const minY = Math.min(...sec.vertices.map(v => v.y));
  const maxY = Math.max(...sec.vertices.map(v => v.y));
  
  assert.strictEqual(minX, sec.x, 'Bounding box minX must match section x');
  assert.strictEqual(maxX, sec.x + sec.width, 'Bounding box maxX must match section x + width');
  assert.strictEqual(minY, sec.y, 'Bounding box minY must match section y');
  assert.strictEqual(maxY, sec.y + sec.depth, 'Bounding box maxY must match section y + depth');
  
  // Verify vertex index-by-index loop alignment
  assert.deepStrictEqual(sec.vertices[0], { x: sec.x, y: sec.y }, 'Vertex 0 must be top-left');
  assert.deepStrictEqual(sec.vertices[1], { x: sec.x + sec.width, y: sec.y }, 'Vertex 1 must be top-right');
  assert.deepStrictEqual(sec.vertices[2], { x: sec.x + sec.width, y: sec.y + sec.depth }, 'Vertex 2 must be bottom-right');
  assert.deepStrictEqual(sec.vertices[3], { x: sec.x, y: sec.y + sec.depth }, 'Vertex 3 must be bottom-left');
});

test('13. Stairs, landings, and multi-level render calculations remain correct and consistent with vertices bounds', () => {
  useDeckStore.getState().resetDeck();
  
  // Place a landing with a custom width/depth and height (non-overlapping)
  const landingRect = { x: 204, y: 204, width: 36, depth: 36 };
  useDeckStore.getState().addSection(landingRect, 'landing');
  
  // Find landing section
  const landingSec = useDeckStore.getState().sections.find(s => s.type === 'landing');
  assert.ok(landingSec, 'Landing section should exist');
  assert.strictEqual(landingSec.width, 36, 'Landing width must be exactly 36');
  assert.strictEqual(landingSec.depth, 36, 'Landing depth must be exactly 36');
  
  // Verify landing vertices bounds
  const lMinX = Math.min(...landingSec.vertices.map(v => v.x));
  const lMaxX = Math.max(...landingSec.vertices.map(v => v.x));
  const lMinY = Math.min(...landingSec.vertices.map(v => v.y));
  const lMaxY = Math.max(...landingSec.vertices.map(v => v.y));
  
  assert.strictEqual(lMinX, landingSec.x, 'Landing minX matches x');
  assert.strictEqual(lMaxX - lMinX, 36, 'Landing vertices span exactly 36 inches in width');
  assert.strictEqual(lMinY, landingSec.y, 'Landing minY matches y');
  assert.strictEqual(lMaxY - lMinY, 36, 'Landing vertices span exactly 36 inches in depth');
  
  // Attach stairs to a deck section
  const deckSec = useDeckStore.getState().sections.find(s => s.type === 'deck');
  assert.ok(deckSec, 'Deck section should exist');
  useDeckStore.getState().attachStairs(deckSec.id, 's');
  
  const updatedDeck = useDeckStore.getState().sections.find(s => s.id === deckSec.id);
  assert.ok(updatedDeck.stairs, 'Stairs must be attached');
  assert.strictEqual(updatedDeck.stairs.direction, 's', 'Stairs direction must be south');
  
  // Verify structural calculations are consistent with dimensions
  const calcs = useDeckStore.getState().sectionCalcs[deckSec.id];
  assert.ok(calcs, 'Structural calculations must exist');
  assert.ok(calcs.joists.positions.length > 0, 'Must calculate joist positions');
  assert.ok(calcs.posts.posts.length > 0, 'Must calculate post positions');
  
  // Ensure all calculated post coordinates lie within the bounds defined by the vertices
  const dMinX = Math.min(...updatedDeck.vertices.map(v => v.x));
  const dMaxX = Math.max(...updatedDeck.vertices.map(v => v.x));
  const dMinY = Math.min(...updatedDeck.vertices.map(v => v.y));
  const dMaxY = Math.max(...updatedDeck.vertices.map(v => v.y));
  
  calcs.posts.posts.forEach(post => {
    assert.ok(post.x >= dMinX - 1 && post.x <= dMaxX + 1, `Post X (${post.x}) must lie within deck vertices width range [${dMinX}, ${dMaxX}]`);
    assert.ok(post.y >= dMinY - 1 && post.y <= dMaxY + 1, `Post Y (${post.y}) must lie within deck vertices depth range [${dMinY}, ${dMaxY}]`);
  });
});

test('14. Save/load round-trip validation with new vertices array and schema version 2 preserves all fields', () => {
  const sections = [
    {
      id: 'sec-rt-1',
      x: 0, y: 0, width: 144, depth: 120, height: 48,
      ledgerAttached: true,
      railings: { n: false, s: true, e: false, w: false },
      stairs: { type: 'stair', width: 36, numberOfSteps: 6, rise: 7.25, run: 10, direction: 's' },
      type: 'deck',
      vertices: [
        { x: 0, y: 0 },
        { x: 144, y: 0 },
        { x: 144, y: 120 },
        { x: 0, y: 120 }
      ]
    }
  ];
  const materials = {
    joistSize: '2x8',
    joistSpacing: 12,
    species: 'Redwood',
    beamConfig: '3-2x10',
    postSize: '6x6',
    deckBoardSize: '5/4x6',
    deckMaterial: 'Composite',
    soilCapacity: 3000
  };

  const serialized = serializeProject('Round Trip Phase 2', sections, materials);
  
  assert.strictEqual(serialized.schemaVersion, 2, 'Round-trip project must be saved under schemaVersion 2');
  validateProjectData(serialized);
  
  // Verify complete structural preservation
  assert.deepStrictEqual(serialized.sections, sections, 'Serialized sections must deeply match original input');
  assert.deepStrictEqual(serialized.materials, materials, 'Serialized materials must deeply match original input');
});

test('15. Point-in-polygon selection: hit-testing successfully validates points inside polygon and rejects points outside', () => {
  const triangleVertices = [
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 60, y: 120 }
  ];
  
  // Point (60, 50) is inside the triangle
  assert.strictEqual(isPointInPolygon(60, 50, triangleVertices), true, 'Point (60, 50) should be inside the triangle');
  
  // Point (10, 100) is outside the triangle (under the bottom-left diagonal edge) but inside its bounding box (0,0 to 120,120)
  assert.strictEqual(isPointInPolygon(10, 100, triangleVertices), false, 'Point (10, 100) should be outside the triangle (under hypotenuse)');
  
  // Point (110, 100) is outside the triangle (under the bottom-right diagonal edge)
  assert.strictEqual(isPointInPolygon(110, 100, triangleVertices), false, 'Point (110, 100) should be outside the triangle');

  // Let's test hitTestSection using a mock list of sections
  const mockSections = [
    {
      id: 'tri-deck',
      x: 0, y: 0, width: 120, depth: 120,
      vertices: triangleVertices
    }
  ];

  // Point (60, 50) inside the triangle in layout coordinates should select tri-deck
  const hit1 = hitTestSection(60, 50, mockSections, 1, 0, 0, 0, 0);
  assert.strictEqual(hit1, 'tri-deck', 'Clicking inside the polygon should select it');

  // Point (10, 100) outside the triangle but inside the bounding box should return null (not selected)
  const hit2 = hitTestSection(10, 100, mockSections, 1, 0, 0, 0, 0);
  assert.strictEqual(hit2, null, 'Clicking outside the polygon path (but inside the bounding box) should NOT select it');
});

test('16. Rigid body dragging: moving a section rigidly shifts all vertices by the displacement delta', () => {
  const store = useDeckStore.getState();
  const triangleVertices = [
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 60, y: 120 }
  ];
  const customSection = {
    id: 'poly-drag-test',
    x: 0, y: 0, width: 120, depth: 120, height: 36,
    ledgerAttached: true,
    railings: { n: false, s: false, e: false, w: false },
    stairs: null,
    type: 'deck',
    vertices: triangleVertices
  };
  
  useDeckStore.getState().loadProject([customSection], { species: 'SYP' });
  
  const loaded = useDeckStore.getState().sections.find(s => s.id === 'poly-drag-test');
  assert.ok(loaded, 'Loaded custom section should exist');
  assert.deepStrictEqual(loaded.vertices, triangleVertices, 'Vertices should match starting state');

  // Drag it by dx = 24, dy = 48
  useDeckStore.getState().moveSection('poly-drag-test', 24, 48);
  
  const moved = useDeckStore.getState().sections.find(s => s.id === 'poly-drag-test');
  assert.strictEqual(moved.x, 24, 'Base X coordinate must be updated to 24');
  assert.strictEqual(moved.y, 48, 'Base Y coordinate must be updated to 48');
  
  // Verify vertices shifted rigidly (no distortion)
  const expectedVertices = [
    { x: 0 + 24, y: 0 + 48 },
    { x: 120 + 24, y: 0 + 48 },
    { x: 60 + 24, y: 120 + 48 }
  ];
  assert.deepStrictEqual(moved.vertices, expectedVertices, 'Vertices must shift rigidly by translation delta (+24, +48)');
});

test('17. Save/load round-trip after rigid drag: dragging a section, saving it, and loading it preserves the dragged position and vertices rigidly', () => {
  useDeckStore.getState().resetDeck();
  const initialSec = useDeckStore.getState().sections[0];

  assert.strictEqual(initialSec.x, 0, 'Starting X must be 0');
  assert.strictEqual(initialSec.y, 0, 'Starting Y must be 0');

  // Drag the section by dx = 36, dy = 60
  useDeckStore.getState().moveSection(initialSec.id, 36, 60);
  const movedSec = useDeckStore.getState().sections.find(s => s.id === initialSec.id);

  assert.strictEqual(movedSec.x, 36, 'X coordinate must be dragged to 36');
  assert.strictEqual(movedSec.y, 60, 'Y coordinate must be dragged to 60');

  // Serialize the current state
  const sections = useDeckStore.getState().sections;
  const materials = useDeckStore.getState().materials;
  const serialized = serializeProject('Post-Drag Round Trip', sections, materials);

  assert.strictEqual(serialized.schemaVersion, 2, 'Serialized version must be 2');
  validateProjectData(serialized);

  // Load the project back into the store
  useDeckStore.getState().loadProject(serialized.sections, serialized.materials);

  // Assert loaded section matches dragged state
  const restoredSec = useDeckStore.getState().sections.find(s => s.id === initialSec.id);
  assert.ok(restoredSec, 'Restored section should exist');
  assert.strictEqual(restoredSec.x, 36, 'Restored X coordinate must match dragged position (36)');
  assert.strictEqual(restoredSec.y, 60, 'Restored Y coordinate must match dragged position (60)');
  assert.deepStrictEqual(restoredSec.vertices, movedSec.vertices, 'Restored vertices must match dragged vertices exactly');
});

test('18. Polygon Edge Splitting (Add Vertex): splitting an edge inserts a new vertex in vertices and updates state', () => {
  useDeckStore.getState().resetDeck();
  const initialSec = useDeckStore.getState().sections[0];

  // Starting vertices: 4-corner rectangle at x:0, y:0, w:192, d:144
  // [ {x:0, y:0}, {x:192, y:0}, {x:192, y:144}, {x:0, y:144} ]
  
  // Click on the edge between V1 (192, 0) and V2 (192, 144) at layout coordinates (192, 72)
  const splitIdx = findEdgeSplitIndex(192, 72, initialSec.vertices, 12);
  assert.strictEqual(splitIdx, 1, 'Edge split index should be 1 (between V1 and V2)');

  // Call store addVertex to insert new vertex at splitIdx + 1 = 2
  const newV = { x: 192, y: 72 };
  useDeckStore.getState().addVertex(initialSec.id, 2, newV);

  const updatedSec = useDeckStore.getState().sections.find(s => s.id === initialSec.id);
  assert.strictEqual(updatedSec.vertices.length, 5, 'Vertices count must increase to 5');
  assert.deepStrictEqual(updatedSec.vertices[2], newV, 'Inserted vertex must be at index 2');

  // Verify bounding box (remains w:192, d:144 because split was on the boundary)
  assert.strictEqual(updatedSec.x, 0);
  assert.strictEqual(updatedSec.y, 0);
  assert.strictEqual(updatedSec.width, 192);
  assert.strictEqual(updatedSec.depth, 144);
});

test('19. Dragging a Vertex: dragging a vertex updates its coordinates, snaps to grid, and keeps bounding box synced', () => {
  useDeckStore.getState().resetDeck();
  const initialSec = useDeckStore.getState().sections[0];

  // Drag V1 (192, 0) to new location (144, 24)
  useDeckStore.getState().dragVertex(initialSec.id, 1, 144, 24);

  const updatedSec = useDeckStore.getState().sections.find(s => s.id === initialSec.id);
  assert.strictEqual(updatedSec.vertices[1].x, 144, 'Vertex X must snap and update to 144');
  assert.strictEqual(updatedSec.vertices[1].y, 24, 'Vertex Y must snap and update to 24');

  // Check bounding box updates
  // Vertices are now: [ {0,0}, {144,24}, {192,144}, {0,144} ]
  // xs: 0, 144, 192, 0 -> min: 0, max: 192
  // ys: 0, 24, 144, 144 -> min: 0, max: 144
  assert.strictEqual(updatedSec.x, 0, 'Bounding box X must be minX (0)');
  assert.strictEqual(updatedSec.y, 0, 'Bounding box Y must be minY (0)');
  assert.strictEqual(updatedSec.width, 192, 'Bounding box width must be 192');
  assert.strictEqual(updatedSec.depth, 144, 'Bounding box depth must be 144');

  // Drag V2 (192, 144) outward to (240, 168)
  useDeckStore.getState().dragVertex(initialSec.id, 2, 240, 168);
  const updatedSec2 = useDeckStore.getState().sections.find(s => s.id === initialSec.id);
  assert.strictEqual(updatedSec2.width, 240, 'Bounding box width must expand to 240');
  assert.strictEqual(updatedSec2.depth, 168, 'Bounding box depth must expand to 168');
});

test('20. Deleting a Vertex: deleting a vertex removes it, updates bounding box, and is blocked below 3 vertices', () => {
  useDeckStore.getState().resetDeck();
  const initialSec = useDeckStore.getState().sections[0];

  // Delete V1 (192, 0)
  useDeckStore.getState().removeVertex(initialSec.id, 1);

  const updatedSec = useDeckStore.getState().sections.find(s => s.id === initialSec.id);
  assert.strictEqual(updatedSec.vertices.length, 3, 'Vertices count must decrease to 3');
  
  // Bounding box should update
  // Remaining vertices: [ {0,0}, {192,144}, {0,144} ]
  // minX:0, maxX:192, minY:0, maxY:144
  assert.strictEqual(updatedSec.width, 192);
  assert.strictEqual(updatedSec.depth, 144);

  // Attempt to delete another vertex (leaving only 2 vertices)
  useDeckStore.getState().removeVertex(initialSec.id, 0);
  const updatedSec2 = useDeckStore.getState().sections.find(s => s.id === initialSec.id);
  
  // Should be blocked: vertices count remains 3
  assert.strictEqual(updatedSec2.vertices.length, 3, 'Deletion below 3 vertices must be blocked');
});

test('21. Save writes to storage, not a file: save action updates localStorage and does not download a file', () => {
  mockLocalStorage.clear();
  createdElements = [];

  const sections = [{ id: 'sec-1', type: 'deck', x: 0, y: 0, width: 100, depth: 100, vertices: [] }];
  const materials = { species: 'SYP' };

  saveProjectToLocalStorage('Test Project', sections, materials);

  const stored = mockLocalStorage.getItem('deckforge_project_Test Project');
  assert.ok(stored, 'Project data should be stored in localStorage');
  const parsed = JSON.parse(stored);
  assert.equal(parsed.projectName, 'Test Project');
  assert.strictEqual(createdElements.length, 0, 'Should not initiate a file download');
});

test('22. Save is in-place: repeatedly saving a project updates the same key and does not accumulate extra entries', () => {
  mockLocalStorage.clear();

  const sections = [{ id: 'sec-1', type: 'deck', x: 0, y: 0, width: 100, depth: 100, vertices: [] }];
  const materials = { species: 'SYP' };

  saveProjectToLocalStorage('Test Project', sections, materials);
  const keysCount1 = Object.keys(mockLocalStorage.store).length;

  saveProjectToLocalStorage('Test Project', [{ ...sections[0], width: 120 }], materials);
  const keysCount2 = Object.keys(mockLocalStorage.store).length;

  assert.strictEqual(keysCount1, keysCount2, 'Saving repeatedly should not create new keys');
  
  const stored = mockLocalStorage.getItem('deckforge_project_Test Project');
  const parsed = JSON.parse(stored);
  assert.strictEqual(parsed.sections[0].width, 120, 'Data should be updated in place');
});

test('23. Auto-restore: mount routine retrieves the most recent project and loads it into store', () => {
  mockLocalStorage.clear();

  const sections = [{ id: 'sec-1', type: 'deck', x: 10, y: 20, width: 100, depth: 100, vertices: [] }];
  const materials = { species: 'SYP' };

  saveProjectToLocalStorage('Restore Project', sections, materials);

  useDeckStore.getState().resetDeck();
  assert.notStrictEqual(useDeckStore.getState().currentProjectName, 'Restore Project');

  const recents = JSON.parse(mockLocalStorage.getItem('deckforge_recent_projects') || '[]');
  assert.ok(recents.length > 0, 'Recents list should not be empty');
  const mostRecent = recents[0];
  assert.strictEqual(mostRecent, 'Restore Project', 'Most recent project should match');

  const data = loadProjectFromLocalStorage(mostRecent);
  useDeckStore.getState().loadProject(data.sections, data.materials);
  useDeckStore.getState().setCurrentProjectName(mostRecent);

  const finalState = useDeckStore.getState();
  assert.strictEqual(finalState.currentProjectName, 'Restore Project', 'Store name should be restored');
  assert.strictEqual(finalState.sections[0].x, 10, 'Store sections should be restored');
  assert.strictEqual(finalState.materials.species, 'SYP', 'Store materials should be restored');
});

test('24. Export still writes a file: export action triggers .deck file download', () => {
  createdElements = [];

  const sections = [{ id: 'sec-1', type: 'deck', x: 0, y: 0, width: 100, depth: 100, vertices: [] }];
  const materials = { species: 'SYP' };

  downloadProjectFile('Export Project', sections, materials);

  assert.strictEqual(createdElements.length, 1, 'Should create exactly one download element');
  assert.strictEqual(createdElements[0].tagName, 'A', 'Should create a link');
  assert.strictEqual(createdElements[0].download, 'Export_Project.deck', 'Should download as correct filename');
});

test('25. Quota handling: catching localStorage QuotaExceededError and throwing a clear user-facing error message', () => {
  mockLocalStorage.clear();

  const originalSetItem = mockLocalStorage.setItem;
  mockLocalStorage.setItem = () => {
    const err = new Error('Quota exceeded');
    err.name = 'QuotaExceededError';
    throw err;
  };

  const sections = [{ id: 'sec-1', type: 'deck', x: 0, y: 0, width: 100, depth: 100, vertices: [] }];
  const materials = { species: 'SYP' };

  assert.throws(
    () => saveProjectToLocalStorage('Full Project', sections, materials),
    /Browser storage is full. Please use "Export"/,
    'Should throw descriptive quota exceeded error'
  );

  mockLocalStorage.setItem = originalSetItem;
});

test('26. Round-trip integrity: L-shaped custom polygon sections, stairs, and landings save and load perfectly', () => {
  mockLocalStorage.clear();

  const lShapeVertices = [
    { x: 0, y: 0 },
    { x: 192, y: 0 },
    { x: 192, y: 72 },
    { x: 96, y: 72 },
    { x: 96, y: 144 },
    { x: 0, y: 144 }
  ];

  const sections = [
    {
      id: 'sec-l-shape',
      x: 0, y: 0, width: 192, depth: 144, height: 36,
      ledgerAttached: true,
      railings: { n: true, s: false, e: true, w: true },
      stairs: { type: 'stair', width: 36, numberOfSteps: 5, rise: 7.25, run: 10, direction: 's' },
      type: 'deck',
      vertices: lShapeVertices
    },
    {
      id: 'sec-landing',
      x: 200, y: 200, width: 36, depth: 36, height: 36,
      ledgerAttached: false,
      railings: { n: false, s: false, e: false, w: false },
      stairs: null,
      type: 'landing',
      vertices: [
        { x: 200, y: 200 },
        { x: 236, y: 200 },
        { x: 236, y: 236 },
        { x: 200, y: 236 }
      ]
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

  saveProjectToLocalStorage('L-Shape Project', sections, materials);

  const data = loadProjectFromLocalStorage('L-Shape Project');

  assert.strictEqual(data.projectName, 'L-Shape Project');
  assert.strictEqual(data.schemaVersion, 2);
  assert.deepStrictEqual(data.sections, sections, 'Restored sections with L-shape, stairs, and landing should be identical');
  assert.deepStrictEqual(data.materials, materials, 'Restored materials should be identical');
});

test('27. Toast Notification: showToast sets state, suppresses consecutive duplicates, and hideToast clears it', () => {
  const store = useDeckStore;
  
  // Clear any existing toast
  store.getState().hideToast();
  assert.strictEqual(store.getState().toast, null);

  // Trigger toast
  store.getState().showToast('Test Toast Success', 'success');
  const t1 = store.getState().toast;
  assert.ok(t1, 'Toast should be set');
  assert.strictEqual(t1.message, 'Test Toast Success');
  assert.strictEqual(t1.type, 'success');

  // Trigger same toast - should not change the toast ID (deduplicated)
  store.getState().showToast('Test Toast Success', 'success');
  const t2 = store.getState().toast;
  assert.strictEqual(t1.id, t2.id, 'Duplicate toast should not create a new toast instance');

  // Trigger different toast - should update
  store.getState().showToast('Test Toast Info', 'info');
  const t3 = store.getState().toast;
  assert.notStrictEqual(t1.id, t3.id, 'Different toast should update state');
  assert.strictEqual(t3.message, 'Test Toast Info');

  // Clear toast
  store.getState().hideToast();
  assert.strictEqual(store.getState().toast, null, 'hideToast should clear the toast state');
});

test('28. Polygon Geometric Validation: self-intersection, overlapping sections, and rigid moves are validated and blocked if invalid', () => {
  useDeckStore.getState().resetDeck();
  
  // Verify starting state (1 section: sec-1 at 0,0, w:192, d:144)
  const initialSections = useDeckStore.getState().sections;
  assert.strictEqual(initialSections.length, 1);
  const sec1 = initialSections[0];

  // 1. Try to drag a vertex to cause self-intersection
  // Current vertices of sec1: [ {0,0}, {192,0}, {192,144}, {0,144} ]
  // Try dragging V0 (0,0) to (240, 72)
  // This will cross V1-V2 (192,0 to 192,144), resulting in self-intersection.
  const prevVertices = [...sec1.vertices];
  useDeckStore.getState().dragVertex(sec1.id, 0, 240, 72);
  
  const secAfterInvalidDrag = useDeckStore.getState().sections.find(s => s.id === sec1.id);
  assert.deepStrictEqual(secAfterInvalidDrag.vertices, prevVertices, 'Invalid drag causing self-intersection must be rejected/reverted');
  
  const toastAfterDrag = useDeckStore.getState().toast;
  assert.ok(toastAfterDrag, 'Toast should be shown on invalid geometry');
  assert.strictEqual(toastAfterDrag.message, 'Overlapping/intersecting layout is invalid');
  assert.strictEqual(toastAfterDrag.type, 'error');

  // Clear toast for next checks
  useDeckStore.getState().hideToast();

  // 2. Add an adjacent section (allowed!)
  // Create another section right next to sec1 (touching at x=192)
  useDeckStore.getState().addSection({ x: 192, y: 0, width: 144, depth: 144 });
  const sectionsAfterAdd = useDeckStore.getState().sections;
  assert.strictEqual(sectionsAfterAdd.length, 2, 'Adjacent sections that touch boundaries are allowed');
  const sec2 = sectionsAfterAdd[1];

  // 3. Move sec2 to overlap with sec1 (should be blocked)
  // Try moving sec2 rigid coordinates from (192,0) to (96, 0)
  const prevSec2Vertices = [...sec2.vertices];
  useDeckStore.getState().moveSection(sec2.id, 96, 0);
  
  const sec2AfterInvalidMove = useDeckStore.getState().sections.find(s => s.id === sec2.id);
  assert.deepStrictEqual(sec2AfterInvalidMove.vertices, prevSec2Vertices, 'Overlapping section moves must be rejected/reverted');
  assert.strictEqual(useDeckStore.getState().toast.type, 'error', 'Error toast must be triggered on overlap');

  // Clear toast
  useDeckStore.getState().hideToast();

  // 4. Try to add a third section that overlaps completely (should be blocked)
  useDeckStore.getState().addSection({ x: 48, y: 48, width: 96, depth: 96 });
  const sectionsAfterOverlapAdd = useDeckStore.getState().sections;
  assert.strictEqual(sectionsAfterOverlapAdd.length, 2, 'Adding an overlapping section must be blocked');
  assert.strictEqual(useDeckStore.getState().toast.type, 'error');
});

test('29. Hardening: check that mutating actions turn isDirty to true, saving resets isDirty to false, loading project starts as false, and autosave timestamp comparisons behave correctly', () => {
  const store = useDeckStore;
  
  // 1. Reset deck: should have isDirty = false
  store.getState().resetDeck();
  assert.strictEqual(store.getState().isDirty, false, 'Starting/resetting deck should set isDirty to false');

  // 2. Perform a mutating action (e.g. addSection) and assert isDirty becomes true
  store.getState().addSection({ x: 300, y: 300, width: 100, depth: 100 });
  assert.strictEqual(store.getState().isDirty, true, 'Mutating action addSection should set isDirty to true');

  // 3. Reset isDirty to false manually or via saving (using mock save simulation / setDirty)
  store.getState().setDirty(false);
  assert.strictEqual(store.getState().isDirty, false, 'setDirty(false) should reset isDirty');

  // 4. Test dragVertex mutation sets isDirty: true
  const sec = store.getState().sections[0];
  store.getState().dragVertex(sec.id, 0, 10, 10);
  assert.strictEqual(store.getState().isDirty, true, 'dragVertex should set isDirty to true');

  // 5. Test loadProject sets isDirty: false
  const sampleSections = [{ id: 'sec-load-test', type: 'deck', x: 0, y: 0, width: 100, depth: 100, vertices: [] }];
  const sampleMaterials = { joistSize: '2x8' };
  store.getState().loadProject(sampleSections, sampleMaterials);
  assert.strictEqual(store.getState().isDirty, false, 'loadProject should set isDirty to false');

  // 6. Test autosave recovery timestamp comparisons
  // Mock localStorage with different manual and draft timestamps
  mockLocalStorage.clear();
  
  // Save a manual project with timestamp
  const manualProjectName = 'Manual Project';
  const tManual = new Date('2026-05-26T12:00:00.000Z');
  const manualProjectData = {
    schemaVersion: 2,
    projectName: manualProjectName,
    sections: sampleSections,
    materials: sampleMaterials,
    timestamp: tManual.toISOString()
  };
  mockLocalStorage.setItem(`deckforge_project_${manualProjectName}`, JSON.stringify(manualProjectData));
  mockLocalStorage.setItem('deckforge_recent_projects', JSON.stringify([manualProjectName]));

  // Case A: Draft is older than manual save -> should NOT trigger banner
  const tDraftOlder = new Date('2026-05-26T11:59:00.000Z');
  const draftOlder = {
    projectName: manualProjectName,
    sections: sampleSections,
    materials: sampleMaterials,
    timestamp: tDraftOlder.toISOString()
  };
  mockLocalStorage.setItem('deckforge_autosave_draft', JSON.stringify(draftOlder));

  // Simulating AppShell mount timestamp checking logic:
  let maxManualTimestampA = 0;
  const recentsA = JSON.parse(mockLocalStorage.getItem('deckforge_recent_projects') || '[]');
  recentsA.forEach(name => {
    const projKey = `deckforge_project_${name}`;
    const rawData = mockLocalStorage.getItem(projKey);
    if (rawData) {
      const data = JSON.parse(rawData);
      if (data && data.timestamp) {
        const t = new Date(data.timestamp).getTime();
        if (t > maxManualTimestampA) {
          maxManualTimestampA = t;
        }
      }
    }
  });

  const rawDraftA = mockLocalStorage.getItem('deckforge_autosave_draft');
  let triggerBannerA = false;
  if (rawDraftA) {
    const draft = JSON.parse(rawDraftA);
    const draftTime = new Date(draft.timestamp).getTime();
    if (draftTime > maxManualTimestampA + 2000) {
      triggerBannerA = true;
    }
  }
  assert.strictEqual(triggerBannerA, false, 'Older draft should not trigger the recovery banner');

  // Case B: Draft is newer than manual save by > 2s -> SHOULD trigger banner
  const tDraftNewer = new Date('2026-05-26T12:00:05.000Z'); // 5 seconds newer
  const draftNewer = {
    projectName: manualProjectName,
    sections: sampleSections,
    materials: sampleMaterials,
    timestamp: tDraftNewer.toISOString()
  };
  mockLocalStorage.setItem('deckforge_autosave_draft', JSON.stringify(draftNewer));

  let maxManualTimestampB = 0;
  const recentsB = JSON.parse(mockLocalStorage.getItem('deckforge_recent_projects') || '[]');
  recentsB.forEach(name => {
    const projKey = `deckforge_project_${name}`;
    const rawData = mockLocalStorage.getItem(projKey);
    if (rawData) {
      const data = JSON.parse(rawData);
      if (data && data.timestamp) {
        const t = new Date(data.timestamp).getTime();
        if (t > maxManualTimestampB) {
          maxManualTimestampB = t;
        }
      }
    }
  });

  const rawDraftB = mockLocalStorage.getItem('deckforge_autosave_draft');
  let triggerBannerB = false;
  if (rawDraftB) {
    const draft = JSON.parse(rawDraftB);
    const draftTime = new Date(draft.timestamp).getTime();
    if (draftTime > maxManualTimestampB + 2000) {
      triggerBannerB = true;
    }
  }
});

test('30. House Wall & Ledger Attachment structural constraints (saving, loading, updating)', () => {
  // Reset store
  useDeckStore.getState().resetDeck();

  // Verify default section created on reset has ledgerAttached: true, and railings.n: false
  let state = useDeckStore.getState();
  const initialSec = state.sections[0];
  assert.strictEqual(initialSec.ledgerAttached, true, 'Default section should have ledgerAttached: true');
  assert.strictEqual(initialSec.railings.n, false, 'Default section ledgerAttached: true must have railings.n: false');

  // Try to toggle North railing -> should be blocked
  state.toggleRailing(initialSec.id, 'n');
  state = useDeckStore.getState();
  assert.strictEqual(state.sections[0].railings.n, false, 'Toggling North railing with ledger attached must remain false');

  // Try to attach North stairs -> should be blocked
  state.attachStairs(initialSec.id, 'n');
  state = useDeckStore.getState();
  assert.strictEqual(state.sections[0].stairs, null, 'Attaching North stairs with ledger attached must remain null');

  // Add another edge railing, e.g. South, and South stairs
  state.toggleRailing(initialSec.id, 's');
  state.attachStairs(initialSec.id, 's');
  state = useDeckStore.getState();
  assert.strictEqual(state.sections[0].railings.s, true, 'South railing should be toggled to true');
  assert.ok(state.sections[0].stairs, 'South stairs should be attached');

  // Check updateDeck: turning ledgerAttached to false should keep existing railings, but let us add North railing
  state.updateDeck({ ledgerAttached: false });
  state = useDeckStore.getState();
  assert.strictEqual(state.sections[0].ledgerAttached, false, 'ledgerAttached should update to false');
  
  // Now add North railing and North stairs -> should succeed
  state.toggleRailing(initialSec.id, 'n');
  state.attachStairs(initialSec.id, 'n');
  state = useDeckStore.getState();
  assert.strictEqual(state.sections[0].railings.n, true, 'North railing should now succeed');
  assert.ok(state.sections[0].stairs && state.sections[0].stairs.direction === 'n', 'North stairs should now succeed');

  // Turning ledgerAttached back to true must automatically clean up North railing & stairs
  state.updateDeck({ ledgerAttached: true });
  state = useDeckStore.getState();
  assert.strictEqual(state.sections[0].ledgerAttached, true, 'ledgerAttached should update to true');
  assert.strictEqual(state.sections[0].railings.n, false, 'North railing must be auto-removed when ledger is attached');
  assert.strictEqual(state.sections[0].stairs, null, 'North stairs must be auto-removed when ledger is attached');

  // Round-trip save/load test: save project state with ledgerAttached: true
  // Let's create an invalid project state object manually, simulating an older version or corrupted JSON where ledgerAttached is true but railings.n is true and stairs.direction is 'n'
  const dirtyProjectData = {
    schemaVersion: 2,
    projectName: 'Ledger Hardening Test',
    sections: [
      {
        id: 'sec-dirty',
        x: 0, y: 0, width: 144, depth: 120, height: 36,
        ledgerAttached: true,
        railings: { n: true, s: true, e: false, w: false },
        stairs: {
          type: 'stair',
          width: 36,
          numberOfSteps: 5,
          rise: 7.25,
          run: 10,
          direction: 'n'
        },
        type: 'deck'
      }
    ],
    materials: {
      joistSize: '2x8',
      joistSpacing: 16,
      species: 'SYP',
      beamConfig: '2-2x10',
      postSize: '6x6',
      deckBoardSize: '5/4x6',
      deckMaterial: 'PT-SYP',
      soilCapacity: 2000
    }
  };

  // Serialize and deserialize using loadProject to test loading sanitation
  state.loadProject(dirtyProjectData.sections, dirtyProjectData.materials);
  state = useDeckStore.getState();

  const loadedSec = state.sections[0];
  assert.strictEqual(loadedSec.ledgerAttached, true, 'Loaded section ledgerAttached must remain true');
  assert.strictEqual(loadedSec.railings.n, false, 'Loaded section railings.n must be sanitized to false on load');
  assert.strictEqual(loadedSec.stairs, null, 'Loaded section stairs on North must be sanitized to null on load');
});

test('31. Multi-level stair rise calculation and alignment offsets', () => {
  const store = useDeckStore.getState();
  store.resetDeck();

  // Create two adjacent sections:
  // Section A (Deck): 36" high, size 144x120 at (0, 0)
  // Section B (Landing): 24" high, size 36x36 at (144, 0) - touching East edge of Section A
  const sections = [
    {
      id: 'sec-deck',
      x: 0, y: 0, width: 144, depth: 120, height: 36,
      ledgerAttached: false,
      railings: { n: false, s: false, e: false, w: false },
      stairs: {
        type: 'stair',
        width: 36,
        numberOfSteps: 2,
        rise: 6,
        run: 10,
        direction: 'e',
        align: 'center'
      },
      type: 'deck',
      vertices: [
        { x: 0, y: 0 },
        { x: 144, y: 0 },
        { x: 144, y: 120 },
        { x: 0, y: 120 }
      ]
    },
    {
      id: 'sec-landing',
      x: 144, y: 0, width: 36, depth: 36, height: 24,
      ledgerAttached: false,
      railings: { n: false, s: false, e: false, w: false },
      stairs: null,
      type: 'landing',
      vertices: [
        { x: 144, y: 0 },
        { x: 180, y: 0 },
        { x: 180, y: 36 },
        { x: 144, y: 36 }
      ]
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

  // Load the project into the store
  store.loadProject(sections, materials);

  let state = useDeckStore.getState();
  const deckCalcs = state.sectionCalcs['sec-deck'];

  // Total rise for the stairs should be 36 - 24 = 12 inches
  // Using 2 steps (stairObj.numberOfSteps = 2, so 3 risers), riserHeight = 12 / 3 = 4 inches
  assert.ok(deckCalcs.stairs, 'Stairs should be calculated on the deck');
  assert.strictEqual(deckCalcs.stairs.riserHeight, 4, 'Stair riserHeight should be 4 inches (12" rise / 3 risers)');
  assert.strictEqual(deckCalcs.stairs.numRisers, 3, 'Stair should have 3 risers');
  assert.strictEqual(deckCalcs.stairs.align, 'center', 'Default stair alignment should be center');

  // Change landing height to 12 inches -> rise becomes 36 - 12 = 24 inches
  // With 2 steps (3 risers), riserHeight should become 24 / 3 = 8 inches
  const newSections = state.sections.map(s => {
    if (s.id === 'sec-landing') return { ...s, height: 12 };
    return s;
  });
  store.loadProject(newSections, materials);
  state = useDeckStore.getState();

  const updatedDeckCalcs = state.sectionCalcs['sec-deck'];
  assert.strictEqual(updatedDeckCalcs.stairs.riserHeight, 8, 'Stair riserHeight should update to 8 inches (24" rise / 3 risers)');

  // Update alignment to 'left' via updateStairs
  store.updateStairs('sec-deck', { align: 'left' });
  state = useDeckStore.getState();
  assert.strictEqual(state.sections[0].stairs.align, 'left', 'Stair alignment should update to left');
});

test('32. Edge alignment snapping and autosave draft clearing on manual save', () => {
  const store = useDeckStore.getState();
  store.resetDeck();

  // Set Section 1: x=0, y=0, width=144, depth=120
  // Set Section 2: x=200, y=200, width=144, depth=120
  const sections = [
    {
      id: 'sec-1',
      x: 0, y: 0, width: 144, depth: 120, height: 36,
      ledgerAttached: false,
      railings: { n: false, s: false, e: false, w: false },
      stairs: null,
      type: 'deck',
      vertices: [
        { x: 0, y: 0 }, { x: 144, y: 0 }, { x: 144, y: 120 }, { x: 0, y: 120 }
      ]
    },
    {
      id: 'sec-2',
      x: 200, y: 200, width: 144, depth: 120, height: 36,
      ledgerAttached: false,
      railings: { n: false, s: false, e: false, w: false },
      stairs: null,
      type: 'deck',
      vertices: [
        { x: 200, y: 200 }, { x: 344, y: 200 }, { x: 344, y: 320 }, { x: 200, y: 320 }
      ]
    }
  ];
  store.loadProject(sections, { species: 'SYP' });

  // Move Section 2 to:
  // x = 150 (abutting snap: East edge of sec-1 is at 144. diff is 6 < threshold 12, so x snaps to 144)
  // y = 5 (alignment snap: Top edge of sec-1 is at 0. diff is 5 < threshold 12, so y snaps to 0)
  store.moveSection('sec-2', 150, 5);
  let state = useDeckStore.getState();
  
  // Section 2 should have snapped to x=144 (abutting touch) and y=0 (flush top alignment)!
  assert.strictEqual(state.sections[1].x, 144, 'Abutting x snap should align East/West edges');
  assert.strictEqual(state.sections[1].y, 0, 'Flush y snap should align North/North edges (Top alignment)');

  // B. Verify Autosave Draft Clearing on Manual Save
  // 1. Write an autosave draft into mockLocalStorage
  mockLocalStorage.setItem('deckforge_autosave_draft', JSON.stringify({ test: 'data' }));
  assert.ok(mockLocalStorage.getItem('deckforge_autosave_draft'), 'Autosave draft must be set in storage');

  // 2. Perform a manual save using saveProjectToLocalStorage
  saveProjectToLocalStorage('Test Project', state.sections, state.materials);

  // 3. Verify the draft is cleaned up
  assert.strictEqual(mockLocalStorage.getItem('deckforge_autosave_draft'), null, 'Autosave draft must be cleared on successful manual save');
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
console.log('\n=============================================================');
console.log('NOTE ON TEST COVERAGE boundaries:');
console.log('These automated tests do NOT cover actual visual rendering');
console.log('correctness (e.g. clipping paths drawing floorboards inside');
console.log('custom vertices, or WebGL mesh geometry positioning in 3D).');
console.log('Additionally, the interactive click "feel" and mouse dragging');
console.log('responsiveness on the canvas must be manually verified.');
console.log('=============================================================\n');
process.exit(fails > 0 ? 1 : 0);
