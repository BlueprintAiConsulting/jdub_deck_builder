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
export function calculateJoists(deckWidthIn, deckDepthIn, joistSize, joistSpacing, species) {
  const spans = JOIST_SPANS[species]?.[joistSize];
  const maxSpan = spans?.[joistSpacing] || 120;
  const actual = LUMBER_ACTUAL[joistSize];
  const joistCount = Math.ceil(deckWidthIn / joistSpacing) + 1;
  const joistLength = Math.min(deckDepthIn, maxSpan);
  const needsInteriorBeam = deckDepthIn > maxSpan;
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
export function calculateBeams(deckWidthIn, deckDepthIn, joistSize, joistSpacing, species, beamConfig) {
  const joistSpanFt = (deckDepthIn / 12);
  const bucket = getJoistSpanBucket(joistSpanFt);
  const config = beamConfig || '2-2x10';
  const maxBeamSpan = BEAM_SPANS[bucket]?.[config] || 96;
  const beamCount = deckDepthIn > JOIST_SPANS[species]?.[joistSize]?.[joistSpacing]
    ? 2 : 1;
  return {
    config,
    count: beamCount,
    maxSpan: maxBeamSpan,
    length: deckWidthIn,
    positions: beamCount === 1
      ? [deckDepthIn]
      : [deckDepthIn / 2, deckDepthIn],
  };
}

/** Calculate post layout */
export function calculatePosts(beams, deckHeightIn, postSize) {
  const post = POST_SIZES[postSize] || POST_SIZES['6x6'];
  const posts = [];
  beams.positions.forEach((beamY) => {
    const count = Math.ceil(beams.length / beams.maxSpan) + 1;
    const spacing = beams.length / (count - 1);
    for (let i = 0; i < count; i++) {
      posts.push({ x: i * spacing, y: beamY, height: deckHeightIn });
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
export function calculateStairs(totalRiseIn) {
  if (totalRiseIn <= 0) return null;
  const idealRiser = STAIR_RULES.idealRiserHeight;
  const numRisers = Math.round(totalRiseIn / idealRiser);
  const riserHeight = totalRiseIn / numRisers;
  const treadDepth = STAIR_RULES.idealTreadDepth;
  const totalRun = treadDepth * (numRisers - 1);
  const stringerLength = Math.sqrt(totalRiseIn ** 2 + totalRun ** 2);
  return {
    numRisers,
    numTreads: numRisers - 1,
    riserHeight: Math.round(riserHeight * 100) / 100,
    treadDepth,
    totalRun: Math.round(totalRun * 100) / 100,
    stringerLength: Math.round(stringerLength * 100) / 100,
    stringerCount: 3,
  };
}

/** Run all structural calculations for a deck config */
export function calculateAll(config) {
  const { width, depth, height, joistSize, joistSpacing, species, beamConfig, postSize, soilCapacity } = config;
  const joists = calculateJoists(width, depth, joistSize, joistSpacing, species);
  const beams = calculateBeams(width, depth, joistSize, joistSpacing, species, beamConfig);
  const posts = calculatePosts(beams, height, postSize);
  const footings = calculateFootings(posts, joistSpacing, beams.maxSpan, soilCapacity);
  const stairs = height > 0 ? calculateStairs(height) : null;
  return { joists, beams, posts, footings, stairs };
}
