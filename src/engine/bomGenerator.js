/**
 * Bill of Materials Generator
 * Calculates quantities and optimal board lengths for all deck components.
 */
import { LUMBER_ACTUAL, BOARD_LENGTHS } from './spanTables';

/** Find the optimal board length to minimize waste */
function optimalBoardLength(requiredLengthIn) {
  const requiredFt = requiredLengthIn / 12;
  for (const len of BOARD_LENGTHS) {
    if (len >= requiredFt) return len;
  }
  return BOARD_LENGTHS[BOARD_LENGTHS.length - 1];
}

/** Generate BOM from structural calculations and deck config */
export function generateBOM(config, calcs) {
  const items = [];
  const { width, depth, height } = config;
  const { joists, beams, posts, footings, stairs } = calcs;

  // --- Joists ---
  const joistBoardLen = optimalBoardLength(joists.length);
  items.push({
    id: 'joists',
    category: 'Framing',
    description: `${config.joistSize} × ${joistBoardLen}' Joist`,
    size: config.joistSize,
    length: joistBoardLen,
    quantity: joists.count,
    unit: 'ea',
    material: config.species,
  });

  // --- Rim Joists (2 sides) ---
  const rimLen = optimalBoardLength(width);
  items.push({
    id: 'rim-joists',
    category: 'Framing',
    description: `${config.joistSize} × ${rimLen}' Rim Joist`,
    size: config.joistSize,
    length: rimLen,
    quantity: 2,
    unit: 'ea',
    material: config.species,
  });

  // --- Beams ---
  const beamLen = optimalBoardLength(beams.length);
  const beamPly = parseInt(beams.config.split('-')[0]) || 2;
  const beamSize = beams.config.split('-').slice(1).join('-') || '2x10';
  items.push({
    id: 'beams',
    category: 'Framing',
    description: `${beamSize} × ${beamLen}' Beam Ply`,
    size: beamSize,
    length: beamLen,
    quantity: beams.count * beamPly,
    unit: 'ea',
    material: config.species,
  });

  // --- Posts ---
  const postLen = optimalBoardLength(height);
  items.push({
    id: 'posts',
    category: 'Framing',
    description: `${config.postSize} × ${postLen}' Post`,
    size: config.postSize,
    length: postLen,
    quantity: posts.posts.length,
    unit: 'ea',
    material: config.species,
  });

  // --- Deck Boards ---
  const deckBoardWidth = LUMBER_ACTUAL[config.deckBoardSize || '5/4x6']?.depth || 5.5;
  const gapWidth = 0.125; // 1/8" gap
  const boardCount = Math.ceil(depth / (deckBoardWidth + gapWidth));
  const deckBoardLen = optimalBoardLength(width);
  items.push({
    id: 'deck-boards',
    category: 'Decking',
    description: `${config.deckBoardSize || '5/4x6'} × ${deckBoardLen}' Deck Board`,
    size: config.deckBoardSize || '5/4x6',
    length: deckBoardLen,
    quantity: Math.ceil(boardCount * 1.1), // 10% waste factor
    unit: 'ea',
    material: config.deckMaterial || config.species,
  });

  // --- Ledger Board ---
  if (config.ledgerAttached) {
    const ledgerLen = optimalBoardLength(width);
    items.push({
      id: 'ledger',
      category: 'Framing',
      description: `${config.joistSize} × ${ledgerLen}' Ledger Board`,
      size: config.joistSize,
      length: ledgerLen,
      quantity: 1,
      unit: 'ea',
      material: config.species,
    });
  }

  // --- Concrete (Footings) ---
  const footingDepth = 42; // assume 42" depth
  const footingVolumeCuFt = Math.PI * (footings.diameter / 2 / 12) ** 2 * (footingDepth / 12);
  const totalConcreteCuFt = footingVolumeCuFt * footings.count;
  const bags60lb = Math.ceil(totalConcreteCuFt / 0.45); // 60lb bag ≈ 0.45 cu ft
  items.push({
    id: 'concrete',
    category: 'Foundation',
    description: `60 lb Concrete Mix (${footings.diameter}" dia footings)`,
    size: '60lb',
    length: null,
    quantity: bags60lb,
    unit: 'bags',
    material: 'Concrete',
  });

  // --- Hardware: Joist Hangers ---
  items.push({
    id: 'joist-hangers',
    category: 'Hardware',
    description: `Joist Hanger (${config.joistSize})`,
    size: config.joistSize,
    length: null,
    quantity: joists.count,
    unit: 'ea',
    material: 'Galvanized Steel',
  });

  // --- Hardware: Post Bases ---
  items.push({
    id: 'post-bases',
    category: 'Hardware',
    description: `Adjustable Post Base (${config.postSize})`,
    size: config.postSize,
    length: null,
    quantity: posts.posts.length,
    unit: 'ea',
    material: 'Galvanized Steel',
  });

  // --- Hardware: Structural Screws ---
  const screwCount = Math.ceil((joists.count * 4) + (boardCount * width / 12 * 2) + 50);
  items.push({
    id: 'screws',
    category: 'Hardware',
    description: 'Structural Deck Screws (#10 × 3")',
    size: '#10x3"',
    length: null,
    quantity: screwCount,
    unit: 'ea',
    material: 'Stainless Steel',
  });

  // --- Stairs (if applicable) ---
  if (stairs) {
    const stringerLen = optimalBoardLength(stairs.stringerLength);
    items.push({
      id: 'stair-stringers',
      category: 'Stairs',
      description: `2x12 × ${stringerLen}' Stair Stringer`,
      size: '2x12',
      length: stringerLen,
      quantity: stairs.stringerCount,
      unit: 'ea',
      material: config.species,
    });
    items.push({
      id: 'stair-treads',
      category: 'Stairs',
      description: `${config.deckBoardSize || '5/4x6'} × 3' Stair Tread`,
      size: config.deckBoardSize || '5/4x6',
      length: 3,
      quantity: stairs.numTreads * 2,
      unit: 'ea',
      material: config.deckMaterial || config.species,
    });
  }

  return items;
}

/** Calculate estimated total square footage */
export function calculateSquareFootage(widthIn, depthIn) {
  return Math.round((widthIn / 12) * (depthIn / 12));
}

/** Merge BOMs from multiple sections, combining identical items */
export function mergeBOMs(bomArrays) {
  const merged = {};

  bomArrays.forEach((bom, sectionIndex) => {
    bom.forEach((item) => {
      // Key by description + size + length for deduplication
      const key = `${item.description}|${item.size}|${item.length || ''}`;
      if (merged[key]) {
        merged[key].quantity += item.quantity;
      } else {
        merged[key] = { ...item, id: `${item.id}-merged` };
      }
    });
  });

  return Object.values(merged);
}

