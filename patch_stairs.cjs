const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/Viewport3D/Scene3D.jsx');
let code = fs.readFileSync(file, 'utf8');

// Insert the helper function right before Stairs
const helperCode = `function getEdgeTransform(vertices, secX, secY, targetEdge, offset, objectWidth, fallbackWidth, fallbackDepth) {
  if (!vertices || vertices.length < 3) {
    let centerX, centerZ, rotY = 0;
    if (targetEdge === 's' || targetEdge === 'n') {
      centerX = offset + objectWidth / 2;
      centerZ = targetEdge === 's' ? fallbackDepth : 0;
      rotY = targetEdge === 's' ? 0 : Math.PI;
    } else {
      centerX = targetEdge === 'e' ? fallbackWidth : 0;
      centerZ = offset + objectWidth / 2;
      rotY = targetEdge === 'e' ? -Math.PI / 2 : Math.PI / 2;
    }
    return { centerX, centerZ, rotY };
  }

  const localVertices = vertices.map(v => ({ x: v.x - secX, y: v.y - secY }));
  let targetSegments = [];

  for (let i = 0; i < localVertices.length; i++) {
    const v1 = localVertices[i];
    const v2 = localVertices[(i + 1) % localVertices.length];
    const dx = v2.x - v1.x;
    const dz = v2.y - v1.y;
    const nx = -dz;
    const nz = dx;
    let edgeLabel = '';
    if (Math.abs(nx) > Math.abs(nz)) {
      edgeLabel = nx < 0 ? 'w' : 'e';
    } else {
      edgeLabel = nz < 0 ? 'n' : 's';
    }
    if (edgeLabel === targetEdge) {
      targetSegments.push({ v1, v2, dx, dz, len: Math.sqrt(dx*dx + dz*dz) });
    }
  }

  if (targetSegments.length === 0) {
     return getEdgeTransform(null, 0, 0, targetEdge, offset, objectWidth, fallbackWidth, fallbackDepth);
  }

  let selectedSeg = targetSegments[0];

  if (targetEdge === 's' || targetEdge === 'n') {
    const targetX = offset + objectWidth / 2;
    selectedSeg = targetSegments.find(s => 
      (targetX >= Math.min(s.v1.x, s.v2.x) && targetX <= Math.max(s.v1.x, s.v2.x))
    ) || targetSegments[0];
    
    if (Math.abs(selectedSeg.dx) > 0.001) {
       const t = (targetX - selectedSeg.v1.x) / selectedSeg.dx;
       const z = selectedSeg.v1.y + t * selectedSeg.dz;
       return { 
         centerX: targetX, 
         centerZ: z, 
         rotY: Math.atan2(-selectedSeg.dz, selectedSeg.dx)
       };
    } else {
       return { centerX: selectedSeg.v1.x, centerZ: selectedSeg.v1.y, rotY: Math.atan2(-selectedSeg.dz, selectedSeg.dx) };
    }
  } else {
    const targetZ = offset + objectWidth / 2;
    selectedSeg = targetSegments.find(s => 
      (targetZ >= Math.min(s.v1.y, s.v2.y) && targetZ <= Math.max(s.v1.y, s.v2.y))
    ) || targetSegments[0];

    if (Math.abs(selectedSeg.dz) > 0.001) {
       const t = (targetZ - selectedSeg.v1.y) / selectedSeg.dz;
       const x = selectedSeg.v1.x + t * selectedSeg.dx;
       return { 
         centerX: x, 
         centerZ: targetZ, 
         rotY: Math.atan2(-selectedSeg.dz, selectedSeg.dx)
       };
    } else {
       return { centerX: selectedSeg.v1.x, centerZ: selectedSeg.v1.y, rotY: Math.atan2(-selectedSeg.dz, selectedSeg.dx) };
    }
  }
}

function Stairs({`;

code = code.replace('function Stairs({', helperCode);

// 1. Update Stairs signature
code = code.replace(
  /function Stairs\(\{ section, stairEdge, stairCalcs, width, depth, species, deckMaterial, deckColor \}\) \{/,
  'function Stairs({ section, stairEdge, stairCalcs, width, depth, species, deckMaterial, deckColor, vertices, secX, secY }) {'
);

// 2. Replace Stairs positioning math
const stairsMathRegex = /\/\/ Compute rotation around Y axis based on edge direction[\s\S]*?centerZ = offset \+ stairWidth \/ 2;\s*\}/;
const newStairsMath = `// Retrieve current visual offset of the stairs
  const offset = getSubObjectOffset(section, 'stairs');
  const { centerX, centerZ, rotY } = getEdgeTransform(vertices, secX, secY, stairEdge, offset, stairWidth, width, depth);`;

code = code.replace(stairsMathRegex, newStairsMath);

// 3. Update Ramp signature
code = code.replace(
  /function Ramp\(\{ section, rampEdge, rampCalcs, width, depth, species, deckMaterial, deckColor, postSize, height: rawHeight \}\) \{/,
  'function Ramp({ section, rampEdge, rampCalcs, width, depth, species, deckMaterial, deckColor, postSize, height: rawHeight, vertices, secX, secY }) {'
);

// 4. Replace Ramp positioning math
const rampMathRegex = /const offset = getSubObjectOffset\(section, 'ramp'\);[\s\S]*?const groupZ = \(rampEdge === 'e' \|\| rampEdge === 'w'\) \? startZ \+ rampWidth \/ 2 : startZ;/;
const newRampMath = `const offset = getSubObjectOffset(section, 'ramp');
  const { centerX: groupX, centerZ: groupZ, rotY } = getEdgeTransform(vertices, secX, secY, rampEdge, offset, rampWidth, width, depth);`;

code = code.replace(rampMathRegex, newRampMath);

// 5. Update calling sites in Scene3D
code = code.replace(
  /<Stairs\s+section=\{sec\}\s+stairEdge=\{sec.stairEdge\}\s+stairCalcs=\{sec.stairCalcs\}\s+width=\{sec.width\}\s+depth=\{sec.depth\}\s+species=\{materials.species\}\s+deckMaterial=\{materials.deckMaterial\}\s+deckColor=\{materials.deckColor\}\s*\/>/g,
  '<Stairs section={sec} stairEdge={sec.stairEdge} stairCalcs={sec.stairCalcs} width={sec.width} depth={sec.depth} species={materials.species} deckMaterial={materials.deckMaterial} deckColor={materials.deckColor} vertices={sec.vertices} secX={sec.x} secY={sec.y} />'
);

code = code.replace(
  /<Ramp\s+section=\{sec\}\s+rampEdge=\{sec.rampEdge\}\s+rampCalcs=\{sec.rampCalcs\}\s+width=\{sec.width\}\s+depth=\{sec.depth\}\s+species=\{materials.species\}\s+deckMaterial=\{materials.deckMaterial\}\s+deckColor=\{materials.deckColor\}\s+postSize=\{sec.postSize\}\s+height=\{sec.height\}\s*\/>/g,
  '<Ramp section={sec} rampEdge={sec.rampEdge} rampCalcs={sec.rampCalcs} width={sec.width} depth={sec.depth} species={materials.species} deckMaterial={materials.deckMaterial} deckColor={materials.deckColor} postSize={sec.postSize} height={sec.height} vertices={sec.vertices} secX={sec.x} secY={sec.y} />'
);

fs.writeFileSync(file, code, 'utf8');
console.log('Stairs and Ramps successfully rewritten.');
