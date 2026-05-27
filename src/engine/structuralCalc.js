import {
  JOIST_SPANS, BEAM_SPANS, LUMBER_ACTUAL,
  POST_SIZES, STAIR_RULES, RAILING_RULES, FOOTING_SIZES,
} from './spanTables';

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
export function calculateJoists(deckWidthIn, deckDepthIn, joistSize, joistSpacing, species, joistOrientation = 'vertical') {
  const isHorizontal = joistOrientation === 'horizontal';
  const width = isHorizontal ? deckDepthIn : deckWidthIn;
  const depth = isHorizontal ? deckWidthIn : deckDepthIn;

  const spans = JOIST_SPANS[species]?.[joistSize];
  const maxSpan = spans?.[joistSpacing] || 120;
  const actual = LUMBER_ACTUAL[joistSize];
  const joistCount = Math.ceil(width / joistSpacing) + 1;
  const joistLength = Math.min(depth, maxSpan);
  const needsInteriorBeam = depth > maxSpan;
  return {
    count: joistCount,
    length: joistLength,
    maxSpan,
    spacing: joistSpacing,
    needsInteriorBeam,
    actualDimensions: actual,
    positions: Array.from({ length: joistCount }, (_, i) => i * joistSpacing),
  };
}

/** Calculate beam layout */
export function calculateBeams(deckWidthIn, deckDepthIn, joistSize, joistSpacing, species, beamConfig, joistOrientation = 'vertical') {
  const isHorizontal = joistOrientation === 'horizontal';
  const width = isHorizontal ? deckDepthIn : deckWidthIn;
  const depth = isHorizontal ? deckWidthIn : deckDepthIn;

  const joistSpanFt = (depth / 12);
  const bucket = getJoistSpanBucket(joistSpanFt);
  const config = beamConfig || '2-2x10';
  const maxBeamSpan = BEAM_SPANS[bucket]?.[config] || 96;
  const beamCount = depth > JOIST_SPANS[species]?.[joistSize]?.[joistSpacing]
    ? 2 : 1;
  return {
    config,
    count: beamCount,
    maxSpan: maxBeamSpan,
    length: width,
    positions: beamCount === 1
      ? [depth]
      : [depth / 2, depth],
  };
}

/** Calculate post layout */
export function calculatePosts(beams, deckHeightIn, postSize, joistOrientation = 'vertical') {
  const isHorizontal = joistOrientation === 'horizontal';
  const post = POST_SIZES[postSize] || POST_SIZES['6x6'];
  const posts = [];
  beams.positions.forEach((beamCoord) => {
    const count = Math.ceil(beams.length / beams.maxSpan) + 1;
    const spacing = beams.length / (count - 1);
    for (let i = 0; i < count; i++) {
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
export function calculateFootings(posts, joistSpacing, beamMaxSpan, soilCapacity) {
  const cap = soilCapacity || 2000;
  const tributaryArea = (joistSpacing / 12) * (beamMaxSpan / 12);
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
    const numRisers = numTreads + 1;
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

/** Run all structural calculations for a deck config */
export function calculateAll(config) {
  const { width, depth, height, stairRiseHeight, joistSize, joistSpacing, species, beamConfig, postSize, soilCapacity, stairs: stairOpt, joistOrientation } = config;
  const joistOrient = joistOrientation || 'vertical';
  const joists = calculateJoists(width, depth, joistSize, joistSpacing, species, joistOrient);
  const beams = calculateBeams(width, depth, joistSize, joistSpacing, species, beamConfig, joistOrient);
  const posts = calculatePosts(beams, height, postSize, joistOrient);
  const footings = calculateFootings(posts, joistSpacing, beams.maxSpan, soilCapacity);
  const stairsRise = stairRiseHeight !== undefined ? stairRiseHeight : height;
  const stairs = stairsRise > 0 ? calculateStairs(stairsRise, stairOpt) : null;
  return { joists, beams, posts, footings, stairs };
}
