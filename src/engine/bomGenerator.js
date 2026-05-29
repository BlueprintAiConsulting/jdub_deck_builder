/**
 * Bill of Materials Generator
 * Calculates quantities and optimal board lengths for all deck components.
 */
import { LUMBER_ACTUAL, BOARD_LENGTHS } from './spanTables.js';
import { DECK_MATERIAL_OPTIONS, DECK_COLOR_OPTIONS } from '../components/Materials/materialData.js';

/** Find the optimal board length to minimize waste */
function optimalBoardLength(requiredLengthIn) {
  const requiredFt = requiredLengthIn / 12;
  for (const len of BOARD_LENGTHS) {
    if (len >= requiredFt) return len;
  }
  return BOARD_LENGTHS[BOARD_LENGTHS.length - 1];
}

/** Estimate unit price for a given BOM item */
function estimateUnitPrice(item, species, deckMaterial) {
  let rate = 0;
  
  if (item.category === 'Framing') {
    // Lumber species modifier
    let speciesMultiplier = 1.0;
    if (species === 'Douglas Fir' || species === 'DF') speciesMultiplier = 1.25;
    else if (species === 'Hem-Fir') speciesMultiplier = 1.15;
    else if (species === 'Spruce-Pine-Fir') speciesMultiplier = 1.1;
    else if (species === 'Western Red Cedar' || species === 'Cedar') speciesMultiplier = 2.0;
    else if (species === 'Redwood') speciesMultiplier = 2.5;

    if (item.size === '2x6') rate = 1.20;
    else if (item.size === '2x8') rate = 1.50;
    else if (item.size === '2x10') rate = 1.90;
    else if (item.size === '2x12') rate = 2.40;
    else if (item.size === '4x4') rate = 2.50;
    else if (item.size === '6x6') rate = 4.50;
    else rate = 1.50;

    return rate * (item.length || 1) * speciesMultiplier;
  }
  
  if (item.category === 'Decking') {
    if (deckMaterial === 'PT-SYP') rate = 2.00;
    else if (deckMaterial === 'Cedar') rate = 4.00;
    else if (deckMaterial === 'Redwood') rate = 5.00;
    else if (deckMaterial === 'Timbertech Composite') rate = 8.00;
    else if (deckMaterial === 'Azek PVC') rate = 11.00;
    else rate = 3.50;

    return rate * (item.length || 1);
  }

  if (item.category === 'Foundation') {
    if (item.size === '60lb') return 6.50; // $6.50 per bag
    return 6.50;
  }

  if (item.category === 'Hardware') {
    if (item.id === 'joist-hangers') return 2.80; // $2.80 each
    if (item.id === 'post-bases') return 9.50; // $9.50 each
    if (item.id === 'screws') return 0.12; // $0.12 per screw
    return 1.50;
  }

  if (item.category === 'Stairs') {
    let speciesMultiplier = 1.0;
    if (species === 'Douglas Fir' || species === 'DF') speciesMultiplier = 1.25;
    else if (species === 'Western Red Cedar' || species === 'Cedar') speciesMultiplier = 2.0;
    else if (species === 'Redwood') speciesMultiplier = 2.5;

    if (item.id === 'stair-stringers') {
      return 2.40 * (item.length || 1) * speciesMultiplier;
    }
    if (item.id === 'stair-treads') {
      if (deckMaterial === 'PT-SYP') rate = 2.00;
      else if (deckMaterial === 'Cedar') rate = 4.00;
      else if (deckMaterial === 'Redwood') rate = 5.00;
      else if (deckMaterial === 'Timbertech Composite') rate = 8.00;
      else if (deckMaterial === 'Azek PVC') rate = 11.00;
      else rate = 3.50;
      return rate * (item.length || 1);
    }
  }

  return 5.00;
}

/** Generate BOM from structural calculations and deck config */
export function generateBOM(config, calcs) {
  const items = [];
  const { width, depth, height } = config;
  const { joists, beams, posts, footings, stairs } = calcs;

  // Helper to format material name for BOM
  const getMaterialLabel = (mat, col, spec) => {
    const matOpt = DECK_MATERIAL_OPTIONS.find(o => o.value === mat);
    if (!matOpt) return mat || spec;
    
    const colors = DECK_COLOR_OPTIONS[mat] || [];
    const colOpt = colors.find(c => c.value === col);
    if (colOpt) {
      return `${matOpt.label} (${colOpt.label})`;
    }
    return matOpt.label;
  };

  const matLabel = getMaterialLabel(config.deckMaterial, config.deckColor, config.species);
  const wasteMultiplier = 1 + (config.wasteFactor ?? 10) / 100;

  // --- Joists ---
  const joistBoardLen = optimalBoardLength(joists.length);
  const joistItem = {
    id: 'joists',
    category: 'Framing',
    description: `${config.joistSize} × ${joistBoardLen}' Joist`,
    size: config.joistSize,
    length: joistBoardLen,
    quantity: Math.ceil(joists.count * wasteMultiplier),
    unit: 'ea',
    material: config.species,
  };
  joistItem.unitPrice = estimateUnitPrice(joistItem, config.species, config.deckMaterial);
  joistItem.totalPrice = joistItem.unitPrice * joistItem.quantity;
  items.push(joistItem);

  // --- Rim Joists (2 sides) ---
  const rimLen = optimalBoardLength(width);
  const rimItem = {
    id: 'rim-joists',
    category: 'Framing',
    description: `${config.joistSize} × ${rimLen}' Rim Joist`,
    size: config.joistSize,
    length: rimLen,
    quantity: Math.ceil(2 * wasteMultiplier),
    unit: 'ea',
    material: config.species,
  };
  rimItem.unitPrice = estimateUnitPrice(rimItem, config.species, config.deckMaterial);
  rimItem.totalPrice = rimItem.unitPrice * rimItem.quantity;
  items.push(rimItem);

  // --- Beams ---
  const beamLen = optimalBoardLength(beams.length);
  const beamPly = parseInt(beams.config.split('-')[0]) || 2;
  const beamSize = beams.config.split('-').slice(1).join('-') || '2x10';
  const beamItem = {
    id: 'beams',
    category: 'Framing',
    description: `${beamSize} × ${beamLen}' Beam Ply`,
    size: beamSize,
    length: beamLen,
    quantity: Math.ceil(beams.count * beamPly * wasteMultiplier),
    unit: 'ea',
    material: config.species,
  };
  beamItem.unitPrice = estimateUnitPrice(beamItem, config.species, config.deckMaterial);
  beamItem.totalPrice = beamItem.unitPrice * beamItem.quantity;
  items.push(beamItem);

  // --- Posts ---
  const postLen = optimalBoardLength(height);
  const postItem = {
    id: 'posts',
    category: 'Framing',
    description: `${config.postSize} × ${postLen}' Post`,
    size: config.postSize,
    length: postLen,
    quantity: posts.posts.length, // posts are structural elements, ordered exact count
    unit: 'ea',
    material: config.species,
  };
  postItem.unitPrice = estimateUnitPrice(postItem, config.species, config.deckMaterial);
  postItem.totalPrice = postItem.unitPrice * postItem.quantity;
  items.push(postItem);

  // --- Deck Boards ---
  const deckBoardWidth = LUMBER_ACTUAL[config.deckBoardSize || '5/4x6']?.depth || 5.5;
  const gapWidth = 0.125; // 1/8" gap
  const boardCount = Math.ceil(depth / (deckBoardWidth + gapWidth));
  const deckBoardLen = optimalBoardLength(width);
  const deckingItem = {
    id: 'deck-boards',
    category: 'Decking',
    description: `${config.deckBoardSize || '5/4x6'} × ${deckBoardLen}' Deck Board`,
    size: config.deckBoardSize || '5/4x6',
    length: deckBoardLen,
    quantity: Math.ceil(boardCount * wasteMultiplier),
    unit: 'ea',
    material: matLabel,
  };
  deckingItem.unitPrice = estimateUnitPrice(deckingItem, config.species, config.deckMaterial);
  deckingItem.totalPrice = deckingItem.unitPrice * deckingItem.quantity;
  items.push(deckingItem);

  // --- Ledger Board ---
  if (config.ledgerAttached) {
    const ledgerLen = optimalBoardLength(width);
    const ledgerItem = {
      id: 'ledger',
      category: 'Framing',
      description: `${config.joistSize} × ${ledgerLen}' Ledger Board`,
      size: config.joistSize,
      length: ledgerLen,
      quantity: 1, // ordered exact
      unit: 'ea',
      material: config.species,
    };
    ledgerItem.unitPrice = estimateUnitPrice(ledgerItem, config.species, config.deckMaterial);
    ledgerItem.totalPrice = ledgerItem.unitPrice * ledgerItem.quantity;
    items.push(ledgerItem);
  }

  // --- Concrete (Footings) ---
  const footingDepth = 42; // assume 42" depth
  const footingVolumeCuFt = Math.PI * (footings.diameter / 2 / 12) ** 2 * (footingDepth / 12);
  const totalConcreteCuFt = footingVolumeCuFt * footings.count;
  const bags60lb = Math.ceil(totalConcreteCuFt / 0.45); // 60lb bag ≈ 0.45 cu ft
  const concreteItem = {
    id: 'concrete',
    category: 'Foundation',
    description: `60 lb Concrete Mix (${footings.diameter}" dia footings)`,
    size: '60lb',
    length: null,
    quantity: bags60lb,
    unit: 'bags',
    material: 'Concrete',
  };
  concreteItem.unitPrice = estimateUnitPrice(concreteItem, config.species, config.deckMaterial);
  concreteItem.totalPrice = concreteItem.unitPrice * concreteItem.quantity;
  items.push(concreteItem);

  // --- Hardware: Joist Hangers ---
  const hangerItem = {
    id: 'joist-hangers',
    category: 'Hardware',
    description: `Joist Hanger (${config.joistSize})`,
    size: config.joistSize,
    length: null,
    quantity: joists.count,
    unit: 'ea',
    material: 'Galvanized Steel',
  };
  hangerItem.unitPrice = estimateUnitPrice(hangerItem, config.species, config.deckMaterial);
  hangerItem.totalPrice = hangerItem.unitPrice * hangerItem.quantity;
  items.push(hangerItem);

  // --- Hardware: Post Bases ---
  const baseItem = {
    id: 'post-bases',
    category: 'Hardware',
    description: `Adjustable Post Base (${config.postSize})`,
    size: config.postSize,
    length: null,
    quantity: posts.posts.length,
    unit: 'ea',
    material: 'Galvanized Steel',
  };
  baseItem.unitPrice = estimateUnitPrice(baseItem, config.species, config.deckMaterial);
  baseItem.totalPrice = baseItem.unitPrice * baseItem.quantity;
  items.push(baseItem);

  // --- Hardware: Structural Screws ---
  const screwCount = Math.ceil((joists.count * 4) + (boardCount * width / 12 * 2) + 50);
  const screwItem = {
    id: 'screws',
    category: 'Hardware',
    description: 'Structural Deck Screws (#10 × 3")',
    size: '#10x3"',
    length: null,
    quantity: screwCount,
    unit: 'ea',
    material: 'Stainless Steel',
  };
  screwItem.unitPrice = estimateUnitPrice(screwItem, config.species, config.deckMaterial);
  screwItem.totalPrice = screwItem.unitPrice * screwItem.quantity;
  items.push(screwItem);

  // --- Stairs (if applicable) ---
  if (stairs) {
    const stringerLen = optimalBoardLength(stairs.stringerLength);
    const stringerItem = {
      id: 'stair-stringers',
      category: 'Stairs',
      description: `2x12 × ${stringerLen}' Stair Stringer`,
      size: '2x12',
      length: stringerLen,
      quantity: Math.ceil(stairs.stringerCount * wasteMultiplier),
      unit: 'ea',
      material: config.species,
    };
    stringerItem.unitPrice = estimateUnitPrice(stringerItem, config.species, config.deckMaterial);
    stringerItem.totalPrice = stringerItem.unitPrice * stringerItem.quantity;
    items.push(stringerItem);

    const treadLen = optimalBoardLength(stairs.width);
    const treadItem = {
      id: 'stair-treads',
      category: 'Stairs',
      description: `${config.deckBoardSize || '5/4x6'} × ${treadLen}' Stair Tread`,
      size: config.deckBoardSize || '5/4x6',
      length: treadLen,
      quantity: Math.ceil(stairs.numTreads * 2 * wasteMultiplier),
      unit: 'ea',
      material: matLabel,
    };
    treadItem.unitPrice = estimateUnitPrice(treadItem, config.species, config.deckMaterial);
    treadItem.totalPrice = treadItem.unitPrice * treadItem.quantity;
    items.push(treadItem);
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

  bomArrays.forEach((bom) => {
    bom.forEach((item) => {
      // Key by description + size + length for deduplication
      const key = `${item.description}|${item.size}|${item.length || ''}`;
      if (merged[key]) {
        merged[key].quantity += item.quantity;
        merged[key].totalPrice = merged[key].quantity * merged[key].unitPrice;
      } else {
        merged[key] = { ...item, id: `${item.id}-merged` };
        merged[key].totalPrice = merged[key].quantity * merged[key].unitPrice;
      }
    });
  });

  return Object.values(merged);
}
