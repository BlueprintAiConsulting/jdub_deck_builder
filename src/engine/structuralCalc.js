import {
  JOIST_SPANS, BEAM_SPANS, LUMBER_ACTUAL,
  POST_SIZES, STAIR_RULES, RAILING_RULES, FOOTING_SIZES,
} from './spanTables.js';
import { isPointInPolygon, isPointOnPolygonBoundary } from '../utils/geometry.js';

/** Get the joist span bucket label for beam lookup */
function getJoistSpanBucket(joistSpanFt) {
  if (joistSpanFt <= 6) return '<=6';
  if (joistSpanFt <= 8) return '6-8';
  if (joistSpanFt <= 10) return '8-10';
  if (joistSpanFt <= 12) return '10-12';
  if (joistSpanFt <= 14) return '12-14';
  return '14-16';
}

/** Calculate joist layout for a given deck */
export function calculateJoists(deckWidthIn, deckDepthIn, joistSize, joistSpacing, species, joistOrientation = 'vertical', vertices = null, secX = 0, secY = 0) {
  const isHorizontal = joistOrientation === 'horizontal';
  const width = isHorizontal ? deckDepthIn : deckWidthIn;
  const depth = isHorizontal ? deckWidthIn : deckDepthIn;

  const safeSpacing = (typeof joistSpacing === 'number' && joistSpacing > 0) ? joistSpacing : 16;
  const spans = JOIST_SPANS[species]?.[joistSize];
  const maxSpan = spans?.[safeSpacing] || 120;
  const actual = LUMBER_ACTUAL[joistSize];
  const joistCount = Math.ceil(width / safeSpacing) + 1;
  const joistLength = Math.min(depth, maxSpan);
  const needsInteriorBeam = depth > maxSpan;

  let positions = Array.from({ length: joistCount }, (_, i) => i * safeSpacing);
  if (vertices && vertices.length >= 3) {
    try {
      positions = positions.filter((coordIn) => {
        let x1, y1, x2, y2;
        if (isHorizontal) {
          x1 = secX;
          y1 = secY + coordIn;
          x2 = secX + deckWidthIn;
          y2 = secY + coordIn;
        } else {
          x1 = secX + coordIn;
          y1 = secY;
          x2 = secX + coordIn;
          y2 = secY + deckDepthIn;
        }

        // Sample 21 points along the joist segment in global coordinates
        for (let k = 0; k <= 20; k++) {
          const px = x1 + (k / 20) * (x2 - x1);
          const py = y1 + (k / 20) * (y2 - y1);
          if (isPointInPolygon(px, py, vertices) || isPointOnPolygonBoundary({ x: px, y: py }, vertices)) {
            return true; // Keep this joist
          }
        }
        return false; // Drop this joist
      });
    } catch (err) {
      // Fallback to bounding box joist positions on error
      positions = Array.from({ length: joistCount }, (_, i) => i * safeSpacing);
    }
  }

  return {
    count: positions.length,
    length: joistLength,
    maxSpan,
    spacing: safeSpacing,
    needsInteriorBeam,
    actualDimensions: actual,
    positions,
  };
}

/** Calculate beam layout */
// approximate for non-rectangular — bounding box layout
export function calculateBeams(deckWidthIn, deckDepthIn, joistSize, joistSpacing, species, beamConfig, joistOrientation = 'vertical', beamCountOverride = 'auto') {
  const isHorizontal = joistOrientation === 'horizontal';
  const width = isHorizontal ? deckDepthIn : deckWidthIn;
  const depth = isHorizontal ? deckWidthIn : deckDepthIn;

  const joistSpanFt = (depth / 12);
  const bucket = getJoistSpanBucket(joistSpanFt);
  const config = beamConfig || '2-2x10';
  const safeSpacing = (typeof joistSpacing === 'number' && joistSpacing > 0) ? joistSpacing : 16;
  const maxBeamSpan = BEAM_SPANS[bucket]?.[config] || 96;
  
  let beamCount = 1;
  if (typeof beamCountOverride === 'number') {
    beamCount = Math.max(1, beamCountOverride);
  } else {
    // 12-ft rule: joists cannot span more than 12 feet (144 inches) between supports.
    beamCount = Math.ceil(depth / 144);
  }

  const positions = [];
  for (let i = 1; i <= beamCount; i++) {
    positions.push((depth / beamCount) * i);
  }

  return {
    config,
    count: beamCount,
    maxSpan: maxBeamSpan,
    length: width,
    positions,
  };
}

/** Calculate post layout */
// approximate for non-rectangular — bounding box layout
export function calculatePosts(beams, deckHeightIn, postSize, joistOrientation = 'vertical') {
  const isHorizontal = joistOrientation === 'horizontal';
  const post = POST_SIZES[postSize] || POST_SIZES['6x6'];
  const posts = [];
  beams.positions.forEach((beamCoord) => {
    const count = Math.ceil((beams.length || 0) / (beams.maxSpan || 96)) + 1;
    const safeCount = Math.max(2, count);
    const spacing = (beams.length || 0) / (safeCount - 1);
    for (let i = 0; i < safeCount; i++) {
      if (isHorizontal) {
        posts.push({ x: beamCoord, y: i * spacing, height: deckHeightIn });
      } else {
        posts.push({ x: i * spacing, y: beamCoord, height: deckHeightIn });
      }
    }
  });
  return { posts, size: postSize, nominalWidth: post.nominalWidth };
}

/** Calculate footing requirements */
// approximate for non-rectangular — bounding box layout
export function calculateFootings(posts, joistSpacing, beamMaxSpan, soilCapacity) {
  const cap = soilCapacity || 2000;
  const safeSpacing = (typeof joistSpacing === 'number' && joistSpacing > 0) ? joistSpacing : 16;
  const tributaryArea = (safeSpacing / 12) * ((beamMaxSpan || 96) / 12);
  const footingSizes = FOOTING_SIZES[cap] || FOOTING_SIZES[2000];
  let diameter = 12;
  const areas = Object.keys(footingSizes).map(Number).sort((a, b) => a - b);
  for (const area of areas) {
    if (tributaryArea <= area) { diameter = footingSizes[area]; break; }
    diameter = footingSizes[area];
  }
  return {
    count: posts.posts.length,
    diameter,
    soilCapacity: cap,
    tributaryArea: Math.round(tributaryArea * 10) / 10,
  };
}

/** Calculate stair geometry */
export function calculateStairs(totalRiseIn, stairOpt) {
  if (totalRiseIn <= 0) return null;

  if (stairOpt && typeof stairOpt === 'object') {
    const width = stairOpt.width || 36;
    const numTreads = stairOpt.numberOfSteps !== undefined ? stairOpt.numberOfSteps : 5;
    const numRisers = Math.max(1, numTreads + 1);
    const riserHeight = totalRiseIn / numRisers;
    const treadDepth = stairOpt.run || 10;
    const totalRun = treadDepth * numTreads;
    const totalRise = totalRiseIn;
    const stringerLength = Math.sqrt(totalRise ** 2 + totalRun ** 2);
    const stringerCount = Math.max(2, Math.ceil(width / 16) + 1);
    return {
      width,
      numRisers,
      numTreads,
      riserHeight: Math.round(riserHeight * 100) / 100,
      treadDepth: Math.round(treadDepth * 100) / 100,
      totalRun: Math.round(totalRun * 100) / 100,
      stringerLength: Math.round(stringerLength * 100) / 100,
      stringerCount,
      direction: stairOpt.direction,
      align: stairOpt.align || 'center',
    };
  }

  const idealRiser = STAIR_RULES.idealRiserHeight;
  const numRisers = Math.round(totalRiseIn / idealRiser);
  const riserHeight = totalRiseIn / numRisers;
  const treadDepth = STAIR_RULES.idealTreadDepth;
  const totalRun = treadDepth * (numRisers - 1);
  const stringerLength = Math.sqrt(totalRiseIn ** 2 + totalRun ** 2);
  return {
    width: 36,
    numRisers,
    numTreads: numRisers - 1,
    riserHeight: Math.round(riserHeight * 100) / 100,
    treadDepth,
    totalRun: Math.round(totalRun * 100) / 100,
    stringerLength: Math.round(stringerLength * 100) / 100,
    stringerCount: 3,
    direction: null,
  };
}

/** Calculate ramp geometry */
export function calculateRamp(totalRiseIn, rampOpt) {
  if (typeof totalRiseIn !== 'number' || isNaN(totalRiseIn) || totalRiseIn <= 0 || !rampOpt) return null;

  const mode = (rampOpt.mode === 'ada' || rampOpt.mode === 'utility') ? rampOpt.mode : 'ada';
  const width = Math.max(12, typeof rampOpt.width === 'number' && !isNaN(rampOpt.width) ? rampOpt.width : 36);
  const totalRise = totalRiseIn;
  let run = 0;
  let intermediateLandings = 0;
  let slopeRatio = '';
  let maxSlopeExceeded = false;

  if (mode === 'ada') {
    const requiredRun = totalRise * 12;
    run = requiredRun;
    if (typeof rampOpt.run === 'number' && !isNaN(rampOpt.run) && rampOpt.run < requiredRun) {
      maxSlopeExceeded = true;
    }
    intermediateLandings = Math.floor(totalRise / 30);
    slopeRatio = '1:12';
  } else {
    run = Math.max(12, typeof rampOpt.run === 'number' && !isNaN(rampOpt.run) ? rampOpt.run : (totalRise * 8));
    intermediateLandings = 0;
    maxSlopeExceeded = false;
    const computedRatio = totalRise > 0 ? (run / totalRise) : 0;
    slopeRatio = `1:${Math.round(computedRatio * 10) / 10}`;
  }

  const surfaceLength = Math.sqrt(totalRise ** 2 + run ** 2);

  return {
    mode,
    width,
    totalRise,
    run,
    surfaceLength: Math.round(surfaceLength * 100) / 100,
    intermediateLandings,
    slopeRatio,
    maxSlopeExceeded,
    direction: ['n', 's', 'e', 'w'].includes(rampOpt.direction) ? rampOpt.direction : 's',
    align: ['left', 'center', 'right'].includes(rampOpt.align) ? rampOpt.align : 'center',
  };
}

/** Run all structural calculations for a deck config */
export function calculateAll(config) {
  const { width, depth, height, stairRiseHeight, rampRiseHeight, joistSize, joistSpacing, species, beamConfig, postSize, soilCapacity, stairs: stairOpt, ramp: rampOpt, joistOrientation, vertices, x, y, beamCount } = config;
  const joistOrient = joistOrientation || 'vertical';
  const joists = calculateJoists(width, depth, joistSize, joistSpacing, species, joistOrient, vertices, x, y);
  const beams = calculateBeams(width, depth, joistSize, joistSpacing, species, beamConfig, joistOrient, beamCount);
  const posts = calculatePosts(beams, height, postSize, joistOrient);
  const footings = calculateFootings(posts, joistSpacing, beams.maxSpan, soilCapacity);
  const stairsRise = stairRiseHeight !== undefined ? stairRiseHeight : height;
  const stairs = stairsRise > 0 ? calculateStairs(stairsRise, stairOpt) : null;
  const rampRise = rampRiseHeight !== undefined ? rampRiseHeight : height;
  const ramp = rampRise > 0 ? calculateRamp(rampRise, rampOpt) : null;
  return { joists, beams, posts, footings, stairs, ramp };
}
