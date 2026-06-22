const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/Viewport3D/Scene3D.jsx');
let code = fs.readFileSync(file, 'utf8');

// 1. Fix getHorizontalIntersections and getVerticalIntersections
const oldIntersectionRegex = /export function getHorizontalIntersections\(y, vertices\) \{[\s\S]*?return segments;\s*\}\s*export function getVerticalIntersections\(x, vertices\) \{[\s\S]*?return segments;\s*\}/;

const newIntersections = `export function getHorizontalIntersections(y, vertices) {
  const intersections = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    
    if (y >= minY && y < maxY) {
      const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
      intersections.push(x);
    }
  }
  
  const sorted = intersections.sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < sorted.length - 1; i += 2) {
    segments.push({ startX: sorted[i], endX: sorted[i + 1] });
  }
  return segments;
}

export function getVerticalIntersections(x, vertices) {
  const intersections = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    
    if (x >= minX && x < maxX) {
      const y = a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x);
      intersections.push(y);
    }
  }
  
  const sorted = intersections.sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < sorted.length - 1; i += 2) {
    segments.push({ startY: sorted[i], endY: sorted[i + 1] });
  }
  return segments;
}`;

code = code.replace(oldIntersectionRegex, newIntersections);

// 2. Joists Fix
const oldJoistsRegex = /function Joists\(\{\s*positions,\s*width,\s*depth,\s*joistSize,\s*joistOrientation\s*\}\)\s*\{[\s\S]*?return \(\s*<group>[\s\S]*?<\/group>\s*\);\s*\}/;

const newJoists = `function Joists({ positions, width, depth, joistSize, joistOrientation, vertices, secX, secY }) {
  const actual = LUMBER_ACTUAL[joistSize] || { width: 1.5, depth: 7.25 };
  const isHorizontal = joistOrientation === 'horizontal';
  const joistTexture = getProceduralTexture('#6e5f4d', 'wood-0');
  const joistBump = getProceduralBumpTexture('wood-0');

  const localVertices = vertices ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;

  return (
    <group>
      {positions.map((coordIn, i) => {
        let segments = [];
        if (localVertices && localVertices.length >= 3) {
          if (isHorizontal) {
            const hSegs = getHorizontalIntersections(coordIn, localVertices);
            hSegs.forEach(seg => {
              if (seg.endX - seg.startX > 0.5) segments.push(seg);
            });
          } else {
            const vSegs = getVerticalIntersections(coordIn, localVertices);
            vSegs.forEach(seg => {
              if (seg.endY - seg.startY > 0.5) segments.push(seg);
            });
          }
        } else {
          if (isHorizontal) segments.push({ startX: 0, endX: width });
          else segments.push({ startY: 0, endY: depth });
        }

        return segments.map((seg, sIdx) => {
          const posX = isHorizontal ? (seg.startX + seg.endX) / 2 : coordIn;
          const posZ = isHorizontal ? coordIn : (seg.startY + seg.endY) / 2;
          const sizeX = isHorizontal ? (seg.endX - seg.startX) : actual.width;
          const sizeZ = isHorizontal ? actual.width : (seg.endY - seg.startY);
          
          return (
            <mesh key={\`joist-\${i}-\${sIdx}\`} position={[posX * IN, -actual.depth / 2 * IN, posZ * IN]} castShadow receiveShadow>
              <boxGeometry args={[sizeX * IN, actual.depth * IN, sizeZ * IN]} />
              <meshStandardMaterial 
                map={joistTexture} color={joistTexture?.customColor || '#ffffff'} 
                roughness={0.8} 
                bumpMap={joistBump}
                bumpScale={0.012}
              />
            </mesh>
          );
        });
      })}
    </group>
  );
}`;

code = code.replace(oldJoistsRegex, newJoists);


// 3. Beams Fix
const oldBeamsRegex = /function Beams\(\{\s*beamPositions,\s*width,\s*depth,\s*beamConfig,\s*joistSize,\s*joistOrientation\s*\}\)\s*\{[\s\S]*?return \(\s*<group>[\s\S]*?<\/group>\s*\);\s*\}/;

const newBeams = `function Beams({ beamPositions, width, depth, beamConfig, joistSize, joistOrientation, vertices, secX, secY }) {
  const isHorizontal = joistOrientation === 'horizontal';
  const beamSize = beamConfig.split('-').slice(1).join('-') || '2x10';
  const actual = LUMBER_ACTUAL[beamSize] || { width: 1.5, depth: 9.25 };
  const joistActual = LUMBER_ACTUAL[joistSize] || { depth: 7.25 };
  const ply = parseInt(beamConfig.split('-')[0]) || 2;
  const beamTopY = -joistActual.depth;
  const beamTexture = getProceduralTexture('#564736', 'wood-1');
  const beamBump = getProceduralBumpTexture('wood-1');

  const localVertices = vertices ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;

  return (
    <group>
      {beamPositions.map((coordIn, i) => {
        let segments = [];
        if (localVertices && localVertices.length >= 3) {
          if (isHorizontal) {
            // If joists are horizontal, beams run vertical
            const vSegs = getVerticalIntersections(coordIn, localVertices);
            vSegs.forEach(seg => { if (seg.endY - seg.startY > 0.5) segments.push(seg); });
          } else {
            // If joists are vertical, beams run horizontal
            const hSegs = getHorizontalIntersections(coordIn, localVertices);
            hSegs.forEach(seg => { if (seg.endX - seg.startX > 0.5) segments.push(seg); });
          }
        } else {
          if (isHorizontal) segments.push({ startY: 0, endY: depth });
          else segments.push({ startX: 0, endX: width });
        }

        return segments.map((seg, sIdx) => (
          <group key={\`beam-\${i}-\${sIdx}\`}>
            {Array.from({ length: ply }, (_, p) => {
              const offset = (p - (ply - 1) / 2) * actual.width;
              const posX = isHorizontal ? coordIn + offset : (seg.startX + seg.endX) / 2;
              const posZ = isHorizontal ? (seg.startY + seg.endY) / 2 : coordIn + offset;
              const sizeX = isHorizontal ? actual.width : (seg.endX - seg.startX);
              const sizeZ = isHorizontal ? (seg.endY - seg.startY) : actual.width;
              return (
                <mesh
                  key={\`beam-\${i}-\${sIdx}-\${p}\`}
                  position={[
                    posX * IN,
                    (beamTopY - actual.depth / 2) * IN,
                    posZ * IN,
                  ]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[sizeX * IN, actual.depth * IN, sizeZ * IN]} />
                  <meshStandardMaterial 
                    map={beamTexture} color={beamTexture?.customColor || '#ffffff'} 
                    roughness={0.78} 
                    bumpMap={beamBump}
                    bumpScale={0.015}
                  />
                </mesh>
              );
            })}
          </group>
        ));
      })}
    </group>
  );
}`;

code = code.replace(oldBeamsRegex, newBeams);

// 4. Blocking (Rim Joists) Fix
const oldBlockingRegex = /function Blocking\(\{\s*blocking,\s*joistSize\s*\}\)\s*\{[\s\S]*?return \(\s*<group>[\s\S]*?<\/group>\s*\);\s*\}/;

const newBlocking = `function Blocking({ blocking, joistSize, vertices, secX, secY, width, depth }) {
  const actual = LUMBER_ACTUAL[joistSize] || { width: 1.5, depth: 7.25 };
  const woodTexture = getProceduralTexture('#6e5f4d', 'wood-2');
  const blockingBump = getProceduralBumpTexture('wood-2');

  if (!blocking || !blocking.enabled) return null;

  const localVertices = vertices ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;
  const segments = [];

  if (localVertices && localVertices.length >= 3) {
    for (let i = 0; i < localVertices.length; i++) {
      const v1 = localVertices[i];
      const v2 = localVertices[(i + 1) % localVertices.length];
      segments.push({ x1: v1.x, y1: v1.y, x2: v2.x, y2: v2.y });
    }
  } else if (blocking.segments) {
    segments.push(...blocking.segments);
  }

  return (
    <group>
      {segments.map((seg, i) => {
        const x1 = typeof seg.x1 === 'number' && !isNaN(seg.x1) ? seg.x1 : 0;
        const x2 = typeof seg.x2 === 'number' && !isNaN(seg.x2) ? seg.x2 : 0;
        const y1 = typeof seg.y1 === 'number' && !isNaN(seg.y1) ? seg.y1 : 0;
        const y2 = typeof seg.y2 === 'number' && !isNaN(seg.y2) ? seg.y2 : 0;

        const dx = x2 - x1;
        const dz = y2 - y1;
        const len = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
        const posX = (x1 + x2) / 2;
        const posZ = (y1 + y2) / 2;

        const rotY = Math.atan2(dz, dx);
        
        return (
          <mesh 
            key={\`block-\${i}\`} 
            position={[posX * IN, -actual.depth / 2 * IN, posZ * IN]} 
            rotation={[0, -rotY, 0]}
            castShadow 
            receiveShadow
          >
            <boxGeometry args={[len * IN, actual.depth * IN, actual.width * IN]} />
            <meshStandardMaterial 
              map={woodTexture} color={woodTexture?.customColor || '#ffffff'} 
              roughness={0.8} 
              bumpMap={blockingBump}
              bumpScale={0.01}
            />
          </mesh>
        );
      })}
    </group>
  );
}`;

code = code.replace(oldBlockingRegex, newBlocking);


// 5. Footers Fix
const oldFootersRegex = /function Footers\(\{\s*beamPositions,\s*width,\s*depth,\s*joistOrientation,\s*footerWidth,\s*height\s*\}\)\s*\{[\s\S]*?return \(\s*<group>[\s\S]*?<\/group>\s*\);\s*\}/;

const newFooters = `function Footers({ beamPositions, width, depth, joistOrientation, footerWidth, height, vertices, secX, secY }) {
  const isHorizontal = joistOrientation === 'horizontal';
  const fWidth = footerWidth || 12;
  const fDepth = 12; // 12 inches deep concrete grade beam
  const fColor = '#8a8a8a';
  const safeHeight = Math.max(1, typeof height === 'number' && !isNaN(height) ? height : 36);
  const yPos = -(safeHeight + 12 + fDepth / 2);
  const localVertices = vertices ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;
  const safeBeamPositions = Array.isArray(beamPositions) ? beamPositions : [];
  
  return (
    <group>
      {safeBeamPositions.map((coordIn, i) => {
        let segments = [];
        if (localVertices && localVertices.length >= 3) {
          if (isHorizontal) {
            const vSegs = getVerticalIntersections(coordIn, localVertices);
            vSegs.forEach(seg => { if (seg.endY - seg.startY > 0.5) segments.push(seg); });
          } else {
            const hSegs = getHorizontalIntersections(coordIn, localVertices);
            hSegs.forEach(seg => { if (seg.endX - seg.startX > 0.5) segments.push(seg); });
          }
        } else {
          if (isHorizontal) segments.push({ startY: 0, endY: depth });
          else segments.push({ startX: 0, endX: width });
        }

        return segments.map((seg, sIdx) => {
          const posX = isHorizontal ? coordIn : (seg.startX + seg.endX) / 2;
          const posZ = isHorizontal ? (seg.startY + seg.endY) / 2 : coordIn;
          const sizeX = isHorizontal ? fWidth : (seg.endX - seg.startX);
          const sizeZ = isHorizontal ? (seg.endY - seg.startY) : fWidth;
          
          return (
            <mesh 
              key={\`footer-\${i}-\${sIdx}\`} 
              position={[posX * IN, yPos * IN, posZ * IN]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[sizeX * IN, fDepth * IN, sizeZ * IN]} />
              <meshStandardMaterial color={fColor} roughness={0.9} />
            </mesh>
          );
        });
      })}
    </group>
  );
}`;

code = code.replace(oldFootersRegex, newFooters);

// 6. Posts Fix (Add Point in Polygon filtering)
const oldPostsRegex = /function Posts\(\{\s*posts,\s*postSize,\s*joistSize,\s*beamConfig\s*\}\)\s*\{[\s\S]*?return \(\s*<group>[\s\S]*?<\/group>\s*\);\s*\}/;

const newPosts = `function pointInPolygon(x, y, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function Posts({ posts, postSize, joistSize, beamConfig, vertices, secX, secY }) {
  const nominalWidth = postSize === '6x6' ? 5.5 : 3.5;
  const joistActual = LUMBER_ACTUAL[joistSize] || { depth: 7.25 };
  const beamSize = beamConfig.split('-').slice(1).join('-') || '2x10';
  const beamActual = LUMBER_ACTUAL[beamSize] || { depth: 9.25 };
  const topOfPost = -(joistActual.depth + beamActual.depth);
  const postTexture = getProceduralTexture('#5c4e3e', 'wood-3');
  const postBump = getProceduralBumpTexture('wood-3');

  const localVertices = vertices ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;

  return (
    <group>
      {posts.map((post, i) => {
        if (localVertices && localVertices.length >= 3) {
          if (!pointInPolygon(post.x, post.y, localVertices)) {
            return null; // Skip posts outside the custom polygon
          }
        }
        const postHeight = Math.max(0.1, post.height + topOfPost + 12);
        return (
          <mesh
            key={\`post-\${i}\`}
            position={[
              post.x * IN,
              (topOfPost - postHeight / 2) * IN,
              post.y * IN,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[nominalWidth * IN, postHeight * IN, nominalWidth * IN]} />
            <meshStandardMaterial 
              map={postTexture} color={postTexture?.customColor || '#ffffff'} 
              roughness={0.82} 
              bumpMap={postBump}
              bumpScale={0.015}
            />
          </mesh>
        );
      })}
    </group>
  );
}`;

code = code.replace(oldPostsRegex, newPosts);


// 7. Railings Fix
const oldRailingsEdgeRegex = /const edges = useMemo\(\(\) => \{[\s\S]*?if \(edge === 'e'\) \{ x1 = width; z1 = 0; x2 = width; z2 = depth; \}[\s\S]*?result\.push\(\{ edge, x1, z1, x2, z2 \}\);\s*\}\);\s*return result;\s*\}, \[railings, width, depth\]\);/;

const newRailingsEdges = `const edges = useMemo(() => {
    const result = [];
    if (!railings) return result;
    
    const localVertices = vertices ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;
    
    if (localVertices && localVertices.length >= 3) {
      for (let i = 0; i < localVertices.length; i++) {
        const v1 = localVertices[i];
        const v2 = localVertices[(i + 1) % localVertices.length];
        
        const dx = v2.x - v1.x;
        const dz = v2.y - v1.y;
        
        // Outward normal for clockwise vertices
        const nx = -dz;
        const nz = dx;
        
        let edgeLabel = '';
        if (Math.abs(nx) > Math.abs(nz)) {
          edgeLabel = nx < 0 ? 'w' : 'e';
        } else {
          edgeLabel = nz < 0 ? 'n' : 's';
        }
        
        if (railings[edgeLabel]) {
          result.push({ edge: edgeLabel, x1: v1.x, z1: v1.y, x2: v2.x, z2: v2.y });
        }
      }
    } else {
      // Fallback for rectangular
      const entries = Object.entries(railings);
      entries.forEach(([edge, on]) => {
        if (!on) return;
        let x1, z1, x2, z2;
        if (edge === 'n') { x1 = 0; z1 = 0; x2 = width; z2 = 0; }
        else if (edge === 's') { x1 = 0; z1 = depth; x2 = width; z2 = depth; }
        else if (edge === 'w') { x1 = 0; z1 = 0; x2 = 0; z2 = depth; }
        else if (edge === 'e') { x1 = width; z1 = 0; x2 = width; z2 = depth; }
        result.push({ edge, x1, z1, x2, z2 });
      });
    }
    return result;
  }, [railings, width, depth, vertices, secX, secY]);`;

code = code.replace(oldRailingsEdgeRegex, newRailingsEdges);


// We need to make sure Joists, Beams, Blocking, Footers, Posts, Railings are called with vertices, secX, secY
code = code.replace(/<Joists\s+positions=\{joistPositions\}\s+width=\{sec.width\}\s+depth=\{sec.depth\}\s+joistSize=\{sec.joistSize\}\s+joistOrientation=\{sec.joistOrientation\}\s*\/>/g, 
  '<Joists positions={joistPositions} width={sec.width} depth={sec.depth} joistSize={sec.joistSize} joistOrientation={sec.joistOrientation} vertices={sec.vertices} secX={sec.x} secY={sec.y} />');

code = code.replace(/<Beams\s+beamPositions=\{beamPositions\}\s+width=\{sec.width\}\s+depth=\{sec.depth\}\s+beamConfig=\{sec.beamConfig\}\s+joistSize=\{sec.joistSize\}\s+joistOrientation=\{sec.joistOrientation\}\s*\/>/g,
  '<Beams beamPositions={beamPositions} width={sec.width} depth={sec.depth} beamConfig={sec.beamConfig} joistSize={sec.joistSize} joistOrientation={sec.joistOrientation} vertices={sec.vertices} secX={sec.x} secY={sec.y} />');

code = code.replace(/<Blocking\s+blocking=\{sec.blocking\}\s+joistSize=\{sec.joistSize\}\s*\/>/g,
  '<Blocking blocking={sec.blocking} joistSize={sec.joistSize} vertices={sec.vertices} secX={sec.x} secY={sec.y} width={sec.width} depth={sec.depth} />');

code = code.replace(/<Footers\s+beamPositions=\{beamPositions\}\s+width=\{sec.width\}\s+depth=\{sec.depth\}\s+joistOrientation=\{sec.joistOrientation\}\s+footerWidth=\{sec.footerWidth\}\s+height=\{sec.height\}\s*\/>/g,
  '<Footers beamPositions={beamPositions} width={sec.width} depth={sec.depth} joistOrientation={sec.joistOrientation} footerWidth={sec.footerWidth} height={sec.height} vertices={sec.vertices} secX={sec.x} secY={sec.y} />');

code = code.replace(/<Posts\s+posts=\{calcs.posts\}\s+postSize=\{sec.postSize\}\s+joistSize=\{sec.joistSize\}\s+beamConfig=\{sec.beamConfig\}\s*\/>/g,
  '<Posts posts={calcs.posts} postSize={sec.postSize} joistSize={sec.joistSize} beamConfig={sec.beamConfig} vertices={sec.vertices} secX={sec.x} secY={sec.y} />');

code = code.replace(/<Railings\s+railings=\{sec.railings\}\s+width=\{sec.width\}\s+depth=\{sec.depth\}\s+height=\{sec.height\}\s+species=\{materials.species\}\s+deckMaterial=\{materials.deckMaterial\}\s+deckColor=\{materials.deckColor\}\s*\/>/g,
  '<Railings railings={sec.railings} width={sec.width} depth={sec.depth} height={sec.height} species={materials.species} deckMaterial={materials.deckMaterial} deckColor={materials.deckColor} vertices={sec.vertices} secX={sec.x} secY={sec.y} />');

fs.writeFileSync(file, code, 'utf8');
console.log('Geometry successfully rewritten.');
