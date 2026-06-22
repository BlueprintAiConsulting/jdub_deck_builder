const fs = require('fs');
const path = require('path');

const bomPath = path.join(__dirname, 'src/engine/bomGenerator.js');
let bomCode = fs.readFileSync(bomPath, 'utf8');

// 1. Add imports
if (!bomCode.includes('polygonUtils.js')) {
  bomCode = bomCode.replace("import { polygonArea } from '../utils/geometry.js';", 
    "import { polygonArea } from '../utils/geometry.js';\nimport { getHorizontalIntersections, getVerticalIntersections, isPointInPolygon } from '../utils/polygonUtils.js';");
}

// 2. Replace the sections
const oldSectionsRegex = /\/\/ --- Joists ---[\s\S]*?\/\/ --- Posts ---[\s\S]*?items\.push\(postItem\);/;
const newSectionsCode = `// --- Joists ---
  const isVerticalJoists = joistOrientation === 'vertical';
  let totalJoistLengthIn = 0;
  
  if (config.vertices && config.vertices.length >= 3) {
    if (isVerticalJoists) {
      joists.positions.forEach(x => {
        const spans = getVerticalIntersections(x, config.vertices);
        spans.forEach(span => { totalJoistLengthIn += (span.maxY - span.minY); });
      });
    } else {
      joists.positions.forEach(y => {
        const spans = getHorizontalIntersections(y, config.vertices);
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
    description: \`\${config.joistSize} × \${joistBoardLen}' Joist\`,
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
    description: \`\${config.joistSize} × \${rimLen}' Rim Joist\`,
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
      if (!config.vertices || config.vertices.length < 3 || isPointInPolygon(midX, midY, config.vertices)) {
         totalBlockingLenIn += Math.sqrt(Math.pow(seg.x2 - seg.x1, 2) + Math.pow(seg.y2 - seg.y1, 2));
      }
    });
    
    const blockingBoardLen = 12; // 12' boards as standard for blocking
    const boardsNeeded = Math.ceil(totalBlockingLenIn / 144);
    
    if (boardsNeeded > 0) {
      const blockingItem = {
        id: 'blocking',
        category: 'Framing',
        description: \`\${config.joistSize} × \${blockingBoardLen}' Blocking Lumber\`,
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
  if (config.vertices && config.vertices.length >= 3) {
    if (isVerticalJoists) { // Beams run horizontal
      beams.positions.forEach(y => {
        const spans = getHorizontalIntersections(y, config.vertices);
        spans.forEach(span => { totalBeamLengthIn += (span.maxX - span.minX); });
      });
    } else { // Beams run vertical
      beams.positions.forEach(x => {
        const spans = getVerticalIntersections(x, config.vertices);
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
    description: \`\${beamSize} × \${beamLen}' Beam Ply\`,
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
    if (!config.vertices || config.vertices.length < 3 || isPointInPolygon(post.x, post.y, config.vertices)) {
      validPostCount++;
    }
  });
  
  if (validPostCount > 0) {
    const postLen = optimalBoardLength(height);
    const postItem = {
      id: 'posts',
      category: 'Framing',
      description: \`\${config.postSize} × \${postLen}' Post\`,
      size: config.postSize,
      length: postLen,
      quantity: validPostCount, // exact count, no waste multiplier needed for posts
      unit: 'ea',
      material: config.species,
    };
    postItem.unitPrice = estimateUnitPrice(postItem, config.species, config.deckMaterial);
    postItem.totalPrice = postItem.unitPrice * postItem.quantity;
    items.push(postItem);
  }`;

bomCode = bomCode.replace(oldSectionsRegex, newSectionsCode);

// Footings fix too!
const footingsRegex = /\/\/ --- Footings ---[\s\S]*?items\.push\(footingItem\);/;
const newFootingsCode = `// --- Footings ---
  if (validPostCount > 0) {
    const footingItem = {
      id: 'footings',
      category: 'Foundation',
      description: \`\${footings.diameter}" Concrete Footing (\${footings.soilCapacity} psf)\`,
      size: '60lb',
      length: 1,
      quantity: validPostCount * 3, // Roughly 3 bags per footing
      unit: 'bags',
      material: 'Concrete',
    };
    footingItem.unitPrice = estimateUnitPrice(footingItem, config.species, config.deckMaterial);
    footingItem.totalPrice = footingItem.unitPrice * footingItem.quantity;
    items.push(footingItem);
    
    const postBaseItem = {
      id: 'post-bases',
      category: 'Hardware',
      description: \`\${config.postSize} Post Base Anchors\`,
      size: config.postSize,
      length: 1,
      quantity: validPostCount,
      unit: 'ea',
      material: 'Galvanized Steel',
    };
    postBaseItem.unitPrice = estimateUnitPrice(postBaseItem, config.species, config.deckMaterial);
    postBaseItem.totalPrice = postBaseItem.unitPrice * postBaseItem.quantity;
    items.push(postBaseItem);
  }`;

bomCode = bomCode.replace(footingsRegex, newFootingsCode);

fs.writeFileSync(bomPath, bomCode, 'utf8');
console.log("bomGenerator.js successfully patched with accurate polygon costing logic!");
