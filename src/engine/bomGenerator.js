/**
 * Bill of Materials Generator
 * Calculates quantities and optimal board lengths for all deck components.
 */
import { LUMBER_ACTUAL, BOARD_LENGTHS } from './spanTables.js';
import { polygonArea } from '../utils/geometry.js';
import { getHorizontalIntersections, getVerticalIntersections, isPointInPolygon } from '../utils/polygonUtils.js';
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
  const joistOrientation = config.joistOrientation || 'vertical';
  const deckingOrientation = config.deckingOrientation || 'perpendicular';

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
  const isVerticalJoists = joistOrientation === 'vertical';
  let totalJoistLengthIn = 0;
  
  const localV = config.vertices ? config.vertices.map(v => ({ x: v.x - (config.x || 0), y: v.y - (config.y || 0) })) : null;
  if (localV && localV.length >= 3) {
    if (isVerticalJoists) {
      joists.positions.forEach(x => {
        const spans = getVerticalIntersections(x, localV);
        spans.forEach(span => { totalJoistLengthIn += (span.maxY - span.minY); });
      });
    } else {
      joists.positions.forEach(y => {
        const spans = getHorizontalIntersections(y, localV);
        spans.forEach(span => { totalJoistLengthIn += (span.maxX - span.minX); });
      });
    }
  } else {
    totalJoistLengthIn = joists.count * joists.length;
  }
  
  const joistBoardsNeeded = Math.ceil(totalJoistLengthIn / 144); // Assume 12' boards (144")
  const joistBoardLen = 12; // Standardizing to 12' boards for accurate costing of linear feet
  
  const joistItem = {
    id: 'joists',
    category: 'Framing',
    description: `${config.joistSize} × ${joistBoardLen}' Joist`,
    size: config.joistSize,
    length: joistBoardLen,
    quantity: Math.ceil(joistBoardsNeeded * wasteMultiplier),
    unit: 'ea',
    material: config.species,
  };
  joistItem.unitPrice = estimateUnitPrice(joistItem, config.species, config.deckMaterial);
  joistItem.totalPrice = joistItem.unitPrice * joistItem.quantity;
  items.push(joistItem);

  // --- Rim Joists (Perimeter) ---
  let perimeterLenIn = 0;
  if (config.vertices && config.vertices.length >= 3) {
    for (let i = 0; i < config.vertices.length; i++) {
       const v1 = config.vertices[i];
       const v2 = config.vertices[(i+1)%config.vertices.length];
       perimeterLenIn += Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));
    }
  } else {
    perimeterLenIn = 2 * (width + depth);
  }
  
  const rimBoardsNeeded = Math.ceil(perimeterLenIn / 144);
  const rimLen = 12;
  const rimItem = {
    id: 'rim-joists',
    category: 'Framing',
    description: `${config.joistSize} × ${rimLen}' Rim Joist`,
    size: config.joistSize,
    length: rimLen,
    quantity: Math.ceil(rimBoardsNeeded * wasteMultiplier),
    unit: 'ea',
    material: config.species,
  };
  rimItem.unitPrice = estimateUnitPrice(rimItem, config.species, config.deckMaterial);
  rimItem.totalPrice = rimItem.unitPrice * rimItem.quantity;
  items.push(rimItem);

  // --- Blocking ---
  if (joists.blocking && joists.blocking.enabled && joists.blocking.segments && joists.blocking.segments.length > 0) {
    let totalBlockingLenIn = 0;
    joists.blocking.segments.forEach(seg => {
      // In 2D/3D we can actually check if blocking segments fall inside the polygon, but the BOM estimates linear feet roughly.
      // Better yet, just sum the lengths of segments whose midpoint is inside the polygon!
      const midX = (seg.x1 + seg.x2) / 2;
      const midY = (seg.y1 + seg.y2) / 2;
      if (!config.vertices || config.vertices.length < 3 || isPointInPolygon(midX, midY, localV)) {
         totalBlockingLenIn += Math.sqrt(Math.pow(seg.x2 - seg.x1, 2) + Math.pow(seg.y2 - seg.y1, 2));
      }
    });
    
    const blockingBoardLen = 12; // 12' boards as standard for blocking
    const boardsNeeded = Math.ceil(totalBlockingLenIn / 144);
    
    if (boardsNeeded > 0) {
      const blockingItem = {
        id: 'blocking',
        category: 'Framing',
        description: `${config.joistSize} × ${blockingBoardLen}' Blocking Lumber`,
        size: config.joistSize,
        length: blockingBoardLen,
        quantity: Math.ceil(boardsNeeded * wasteMultiplier),
        unit: 'ea',
        material: config.species,
      };
      blockingItem.unitPrice = estimateUnitPrice(blockingItem, config.species, config.deckMaterial);
      blockingItem.totalPrice = blockingItem.unitPrice * blockingItem.quantity;
      items.push(blockingItem);
    }
  }

  // --- Beams ---
  let totalBeamLengthIn = 0;
  if (localV && localV.length >= 3) {
    if (isVerticalJoists) { // Beams run horizontal
      beams.positions.forEach(y => {
        const spans = getHorizontalIntersections(y, localV);
        spans.forEach(span => { totalBeamLengthIn += (span.maxX - span.minX); });
      });
    } else { // Beams run vertical
      beams.positions.forEach(x => {
        const spans = getVerticalIntersections(x, localV);
        spans.forEach(span => { totalBeamLengthIn += (span.maxY - span.minY); });
      });
    }
  } else {
    totalBeamLengthIn = beams.count * beams.length;
  }
  
  const beamPly = parseInt(beams.config.split('-')[0]) || 2;
  const beamBoardsNeeded = Math.ceil(totalBeamLengthIn / 144) * beamPly;
  const beamLen = 12;
  const beamSize = beams.config.split('-').slice(1).join('-') || '2x10';
  const beamItem = {
    id: 'beams',
    category: 'Framing',
    description: `${beamSize} × ${beamLen}' Beam Ply`,
    size: beamSize,
    length: beamLen,
    quantity: Math.ceil(beamBoardsNeeded * wasteMultiplier),
    unit: 'ea',
    material: config.species,
  };
  beamItem.unitPrice = estimateUnitPrice(beamItem, config.species, config.deckMaterial);
  beamItem.totalPrice = beamItem.unitPrice * beamItem.quantity;
  items.push(beamItem);

  // --- Posts ---
  let validPostCount = 0;
  posts.posts.forEach(post => {
    if (!config.vertices || config.vertices.length < 3 || isPointInPolygon(post.x, post.y, localV)) {
      validPostCount++;
    }
  });
  
  if (validPostCount > 0) {
    const postLen = optimalBoardLength(height);
    const postItem = {
      id: 'posts',
      category: 'Framing',
      description: `${config.postSize} × ${postLen}' Post`,
      size: config.postSize,
      length: postLen,
      quantity: validPostCount, // exact count, no waste multiplier needed for posts
      unit: 'ea',
      material: config.species,
    };
    postItem.unitPrice = estimateUnitPrice(postItem, config.species, config.deckMaterial);
    postItem.totalPrice = postItem.unitPrice * postItem.quantity;
    items.push(postItem);
  }

  // --- Deck Boards ---
  const deckBoardWidth = LUMBER_ACTUAL[config.deckBoardSize || '5/4x6']?.depth || 5.5;
  const gapWidth = 0.125; // 1/8" gap
  const boardSpacing = (deckBoardWidth + gapWidth) > 0 ? (deckBoardWidth + gapWidth) : 5.625;
  let boardCount = 0;
  let deckBoardLen = 0;

  let areaSqIn = 0;
  try {
    areaSqIn = polygonArea(config.vertices || []);
  } catch (e) {
    areaSqIn = 0;
  }
  const safeAreaSqIn = areaSqIn > 0 ? areaSqIn : ((width || 0) * (depth || 0));

  const pictureFrameCount = typeof config.pictureFrame === 'number' && !isNaN(config.pictureFrame) ? Math.max(0, config.pictureFrame) : (parseInt(config.pictureFrame) || 0);
  const isDeckingFlipped = config.deckingFlipped === true || deckingOrientation === 'diagonal-down';
  
  // Resolve orientation
  let runsVertical = joistOrientation === 'vertical' ? (deckingOrientation === 'parallel') : (deckingOrientation !== 'parallel');
  if (isDeckingFlipped) {
    runsVertical = !runsVertical;
  }

  const frameWidth = pictureFrameCount * boardSpacing;
  const span = runsVertical ? (depth - 2 * frameWidth) : (width - 2 * frameWidth);

  let divCountVal = config.dividerCount;
  let hasDivider = false;
  let dividerCountNum = 0;

  if (divCountVal === 'auto' || divCountVal === undefined) {
    if (span > 240) {
      hasDivider = true;
      dividerCountNum = 1;
    }
  } else {
    const num = Number(divCountVal);
    if (num > 0 && !isNaN(num)) {
      hasDivider = true;
      dividerCountNum = num;
    }
  }

  const boardsPerDiv = typeof config.boardsPerDivider === 'number' && !isNaN(config.boardsPerDivider) ? Math.max(1, config.boardsPerDivider) : (parseInt(config.boardsPerDivider) || 1);

  // Calculate picture frame linear inches
  let pfLinearInches = 0;
  if (pictureFrameCount > 0) {
    for (let k = 0; k < pictureFrameCount; k++) {
      pfLinearInches += 2 * (width - 2 * k * boardSpacing) + 2 * (depth - 2 * k * boardSpacing);
    }
  }

  // Calculate divider linear inches
  let divLinearInches = 0;
  if (hasDivider) {
    const divLen = runsVertical ? (width - 2 * frameWidth) : (depth - 2 * frameWidth);
    divLinearInches = dividerCountNum * boardsPerDiv * divLen;
  }

  // Field decking area (subtracting picture frame and divider coverage)
  const pfArea = pfLinearInches * deckBoardWidth;
  const divArea = divLinearInches * deckBoardWidth;
  const fieldArea = Math.max(0, safeAreaSqIn - pfArea - divArea);
  
  const fieldLinearIn = fieldArea / boardSpacing;
  const totalLinearInNeeded = fieldLinearIn + pfLinearInches + divLinearInches;

  if (deckingOrientation === 'diagonal' || deckingOrientation === 'diagonal-up' || deckingOrientation === 'diagonal-down') {
    const maxDiagonal = Math.sqrt((width || 0) ** 2 + (depth || 0) ** 2) || 96;
    deckBoardLen = optimalBoardLength(maxDiagonal);
    const singleBoardLenIn = deckBoardLen * 12;
    const safeSingleBoardLenIn = singleBoardLenIn > 0 ? singleBoardLenIn : 96;
    boardCount = Math.ceil((totalLinearInNeeded / safeSingleBoardLenIn) * (wasteMultiplier + 0.10));
  } else {
    let boardRunIn = runsVertical ? depth : width;
    const minOrderLen = Math.max(width, depth, boardRunIn);
    deckBoardLen = optimalBoardLength(minOrderLen);
    const safeBoardRunIn = deckBoardLen * 12;
    boardCount = Math.ceil((totalLinearInNeeded / safeBoardRunIn) * wasteMultiplier);
  }

  const deckingItem = {
    id: 'deck-boards',
    category: 'Decking',
    description: `${config.deckBoardSize || '5/4x6'} × ${deckBoardLen}' Deck Board`,
    size: config.deckBoardSize || '5/4x6',
    length: deckBoardLen,
    quantity: boardCount,
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
  // approximate for non-rectangular — bounding box layout
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
  const screwCount = Math.ceil((joists.count * 4) + (boardCount * Math.max(0, width || 0) / 12 * 2) + 50);
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

  // --- Ramp (if applicable) ---
  if (calcs.ramp && config.ramp) {
    const ramp = calcs.ramp;
    const N = typeof ramp.intermediateLandings === 'number' && !isNaN(ramp.intermediateLandings) && ramp.intermediateLandings > 0
      ? Math.floor(ramp.intermediateLandings)
      : 0;
    const numSegments = N + 1;
    const safeRun = Math.max(12, typeof ramp.run === 'number' && !isNaN(ramp.run) ? ramp.run : 12);
    const safeRise = Math.max(0, typeof ramp.totalRise === 'number' && !isNaN(ramp.totalRise) ? ramp.totalRise : 0);
    const safeRampWidth = Math.max(12, typeof ramp.width === 'number' && !isNaN(ramp.width) ? ramp.width : 36);

    const segRun = safeRun / numSegments;
    const segRise = safeRise / numSegments;
    const segSurfaceLength = Math.sqrt(segRun ** 2 + segRise ** 2);

    const rampStringerLen = optimalBoardLength(segSurfaceLength);
    const stringersPerSeg = Math.max(2, Math.ceil(safeRampWidth / 16) + 1);
    const rampStringerCount = stringersPerSeg * numSegments;
    items.push({
      id: 'ramp-stringers',
      category: 'Framing',
      description: `2x12 × ${rampStringerLen}' Ramp Stringer`,
      size: '2x12',
      length: rampStringerLen,
      quantity: rampStringerCount,
      unit: 'ea',
      material: config.species,
    });

    const deckBoardWidth = LUMBER_ACTUAL[config.deckBoardSize || '5/4x6']?.depth || 5.5;
    const gapWidth = 0.125;
    const boardSpacing = (deckBoardWidth + gapWidth) > 0 ? (deckBoardWidth + gapWidth) : 5.625;
    
    const rampTreadLen = optimalBoardLength(safeRampWidth);
    const boardsPerSeg = Math.ceil(Math.ceil(segSurfaceLength / boardSpacing) * 1.1);
    const boardCount = boardsPerSeg * numSegments;
    items.push({
      id: 'ramp-decking',
      category: 'Decking',
      description: `${config.deckBoardSize || '5/4x6'} × ${rampTreadLen}' Ramp Deck Board`,
      size: config.deckBoardSize || '5/4x6',
      length: rampTreadLen,
      quantity: boardCount,
      unit: 'ea',
      material: config.deckMaterial || config.species,
    });

    // Landing decking & framing
    if (N > 0) {
      const landingW = Math.max(60, safeRampWidth);
      const landingTreadLen = optimalBoardLength(landingW);
      const landingBoardsPerLand = Math.ceil(Math.ceil(60 / boardSpacing) * 1.1);
      const landingBoardCount = landingBoardsPerLand * N;
      items.push({
        id: 'ramp-landing-decking',
        category: 'Decking',
        description: `${config.deckBoardSize || '5/4x6'} × ${landingTreadLen}' Ramp Landing Deck Board`,
        size: config.deckBoardSize || '5/4x6',
        length: landingTreadLen,
        quantity: landingBoardCount,
        unit: 'ea',
        material: config.deckMaterial || config.species,
      });

      const landingWLen = optimalBoardLength(landingW);
      const landingRunLen = optimalBoardLength(60);
      const joistCount = Math.max(0, Math.ceil((landingW - 3) / 16) - 1);

      items.push({
        id: 'ramp-landing-framing-rim',
        category: 'Framing',
        description: `2x12 × ${landingWLen}' Ramp Landing Rim Joist`,
        size: '2x12',
        length: landingWLen,
        quantity: 2 * N,
        unit: 'ea',
        material: config.species,
      });

      items.push({
        id: 'ramp-landing-framing-joist',
        category: 'Framing',
        description: `2x12 × ${landingRunLen}' Ramp Landing Joist`,
        size: '2x12',
        length: landingRunLen,
        quantity: (2 + joistCount) * N,
        unit: 'ea',
        material: config.species,
      });
    }

    // Support posts
    const safeHeight = Math.max(12, typeof config.height === 'number' && !isNaN(config.height) ? config.height : 36);
    const postLen = optimalBoardLength(safeHeight);
    const rampPostCount = (2 * numSegments) + (4 * N);
    const postSizeStr = config.postSize || '4x4';
    items.push({
      id: 'ramp-posts',
      category: 'Framing',
      description: `${postSizeStr} × ${postLen}' Ramp Support Post`,
      size: postSizeStr,
      length: postLen,
      quantity: rampPostCount,
      unit: 'ea',
      material: config.species,
    });
  }

  return items;
}

/** Calculate estimated total square footage */
export function calculateSquareFootage(vertices) {
  try {
    const verts = Array.isArray(vertices) ? vertices : (vertices?.vertices || []);
    const areaSqIn = polygonArea(verts);
    if (areaSqIn > 0) {
      return Math.round(areaSqIn / 144);
    }
  } catch (e) {
    // Ignore and fall through to bounding box fallback
  }

  // Fallback to bounding-box if area is 0/degenerate or an error occurs
  if (vertices && typeof vertices === 'object' && !Array.isArray(vertices)) {
    const w = vertices.width || 0;
    const d = vertices.depth || 0;
    if (w > 0 && d > 0) {
      return Math.round((w / 12) * (d / 12));
    }
  }

  const verts = Array.isArray(vertices) ? vertices : (vertices?.vertices || []);
  if (verts && verts.length >= 3) {
    try {
      const xs = verts.map(v => v.x).filter(x => typeof x === 'number' && !isNaN(x));
      const ys = verts.map(v => v.y).filter(y => typeof y === 'number' && !isNaN(y));
      if (xs.length >= 3 && ys.length >= 3) {
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const w = maxX - minX;
        const d = maxY - minY;
        if (w > 0 && d > 0) {
          return Math.round((w / 12) * (d / 12));
        }
      }
    } catch (e) {
      // Ignore
    }
  }
  return 0;
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
