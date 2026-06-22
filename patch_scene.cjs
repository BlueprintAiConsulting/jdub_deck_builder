const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/Viewport3D/Scene3D.jsx');
let code = fs.readFileSync(file, 'utf8');

// 1. Add `isPointInPolygon` import
code = code.replace(
  "import { getSubObjectOffset } from '../../utils/polygonUtils';",
  "import { getSubObjectOffset, isPointInPolygon } from '../../utils/polygonUtils';"
);

// 2. Replace Joists
const joistsRegex = /function Joists\(\{ positions, width, depth, joistSize, joistOrientation \}\) \{[\s\S]*?return \([\s\S]*?<\/group>\);\n\}/;
const newJoists = `function Joists({ positions, width, depth, joistSize, joistOrientation, vertices, secX, secY }) {
  const actual = LUMBER_ACTUAL[joistSize] || { width: 1.5, depth: 7.25 };
  const isHorizontal = joistOrientation === 'horizontal';
  const joistTexture = getProceduralTexture('#6e5f4d', 'wood-0');
  const joistBump = getProceduralBumpTexture('wood-0');
  const localVertices = vertices && vertices.length > 0 ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;

  return (
    <group>
      {positions.map((coordIn, i) => {
        if (localVertices) {
          if (isHorizontal) {
            const segments = getHorizontalIntersections(coordIn, localVertices);
            return (
              <group key={\`jgrp-\${i}\`}>
                {segments.map((seg, sIdx) => {
                  const len = seg.endX - seg.startX;
                  if (len < 1) return null;
                  const midX = (seg.startX + seg.endX) / 2;
                  return (
                    <mesh key={\`j-\${i}-\${sIdx}\`} position={[midX * IN, -actual.depth / 2 * IN, coordIn * IN]} castShadow receiveShadow>
                      <boxGeometry args={[len * IN, actual.depth * IN, actual.width * IN]} />
                      <meshStandardMaterial map={joistTexture} roughness={0.8} bumpMap={joistBump} bumpScale={0.012} />
                    </mesh>
                  );
                })}
              </group>
            );
          } else {
            const segments = getVerticalIntersections(coordIn, localVertices);
            return (
              <group key={\`jgrp-\${i}\`}>
                {segments.map((seg, sIdx) => {
                  const len = seg.endY - seg.startY;
                  if (len < 1) return null;
                  const midZ = (seg.startY + seg.endY) / 2;
                  return (
                    <mesh key={\`j-\${i}-\${sIdx}\`} position={[coordIn * IN, -actual.depth / 2 * IN, midZ * IN]} castShadow receiveShadow>
                      <boxGeometry args={[actual.width * IN, actual.depth * IN, len * IN]} />
                      <meshStandardMaterial map={joistTexture} roughness={0.8} bumpMap={joistBump} bumpScale={0.012} />
                    </mesh>
                  );
                })}
              </group>
            );
          }
        }

        const posX = isHorizontal ? width / 2 : coordIn;
        const posZ = isHorizontal ? coordIn : depth / 2;
        const sizeX = isHorizontal ? width : actual.width;
        const sizeZ = isHorizontal ? actual.width : depth;
        return (
          <mesh key={\`joist-\${i}\`} position={[posX * IN, -actual.depth / 2 * IN, posZ * IN]} castShadow receiveShadow>
            <boxGeometry args={[sizeX * IN, actual.depth * IN, sizeZ * IN]} />
            <meshStandardMaterial map={joistTexture} roughness={0.8} bumpMap={joistBump} bumpScale={0.012} />
          </mesh>
        );
      })}
    </group>
  );
}`;
code = code.replace(joistsRegex, newJoists);

// 3. Replace Beams
const beamsRegex = /function Beams\(\{ beamPositions, width, depth, beamConfig, joistSize, joistOrientation \}\) \{[\s\S]*?return \([\s\S]*?<\/group>\);\n\}/;
const newBeams = `function Beams({ beamPositions, width, depth, beamConfig, joistSize, joistOrientation, vertices, secX, secY }) {
  const isHorizontal = joistOrientation === 'horizontal';
  const beamSize = beamConfig.split('-').slice(1).join('-') || '2x10';
  const actual = LUMBER_ACTUAL[beamSize] || { width: 1.5, depth: 9.25 };
  const joistActual = LUMBER_ACTUAL[joistSize] || { depth: 7.25 };
  const ply = parseInt(beamConfig.split('-')[0]) || 2;
  const beamTopY = beamConfig === 'flush' ? 0 : -joistActual.depth; // Correct vertical alignment
  const beamTexture = getProceduralTexture('#564736', 'wood-1');
  const beamBump = getProceduralBumpTexture('wood-1');
  const localVertices = vertices && vertices.length > 0 ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;

  return (
    <group>
      {beamPositions.map((coordIn, i) => (
        <group key={\`beam-\${i}\`}>
          {Array.from({ length: ply }, (_, p) => {
            const offset = (p - (ply - 1) / 2) * actual.width;
            
            if (localVertices) {
              if (isHorizontal) {
                const zCoord = coordIn + offset;
                const segments = getHorizontalIntersections(zCoord, localVertices);
                return segments.map((seg, sIdx) => {
                  const len = seg.endX - seg.startX;
                  if (len < 1) return null;
                  const midX = (seg.startX + seg.endX) / 2;
                  return (
                    <mesh key={\`b-\${i}-\${p}-\${sIdx}\`} position={[midX * IN, (beamTopY - actual.depth / 2) * IN, zCoord * IN]} castShadow receiveShadow>
                      <boxGeometry args={[len * IN, actual.depth * IN, actual.width * IN]} />
                      <meshStandardMaterial map={beamTexture} roughness={0.78} bumpMap={beamBump} bumpScale={0.015} />
                    </mesh>
                  );
                });
              } else {
                const xCoord = coordIn + offset;
                const segments = getVerticalIntersections(xCoord, localVertices);
                return segments.map((seg, sIdx) => {
                  const len = seg.endY - seg.startY;
                  if (len < 1) return null;
                  const midZ = (seg.startY + seg.endY) / 2;
                  return (
                    <mesh key={\`b-\${i}-\${p}-\${sIdx}\`} position={[xCoord * IN, (beamTopY - actual.depth / 2) * IN, midZ * IN]} castShadow receiveShadow>
                      <boxGeometry args={[actual.width * IN, actual.depth * IN, len * IN]} />
                      <meshStandardMaterial map={beamTexture} roughness={0.78} bumpMap={beamBump} bumpScale={0.015} />
                    </mesh>
                  );
                });
              }
            }

            const posX = isHorizontal ? coordIn * IN : (width / 2 + offset) * IN;
            const posZ = isHorizontal ? (depth / 2 + offset) * IN : coordIn * IN;
            const sizeX = isHorizontal ? actual.width * IN : width * IN;
            const sizeZ = isHorizontal ? depth * IN : actual.width * IN;
            return (
              <mesh key={\`beam-\${i}-\${p}\`} position={[posX, (beamTopY - actual.depth / 2) * IN, posZ]} castShadow receiveShadow>
                <boxGeometry args={[sizeX, actual.depth * IN, sizeZ]} />
                <meshStandardMaterial map={beamTexture} roughness={0.78} bumpMap={beamBump} bumpScale={0.015} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}`;
code = code.replace(beamsRegex, newBeams);

// 4. Replace Posts
const postsRegex = /function Posts\(\{ posts, postSize, joistSize, beamConfig \}\) \{[\s\S]*?return \([\s\S]*?<\/group>\);\n\}/;
const newPosts = `function Posts({ posts, postSize, joistSize, beamConfig, vertices, secX, secY }) {
  const nominalWidth = postSize === '6x6' ? 5.5 : 3.5;
  const joistActual = LUMBER_ACTUAL[joistSize] || { depth: 7.25 };
  const beamSize = beamConfig.split('-').slice(1).join('-') || '2x10';
  const beamActual = LUMBER_ACTUAL[beamSize] || { depth: 9.25 };
  const topOfPost = beamConfig === 'flush' ? -beamActual.depth : -(joistActual.depth + beamActual.depth);
  const postTexture = getProceduralTexture('#5c4e3e', 'wood-3');
  const postBump = getProceduralBumpTexture('wood-3');
  const localVertices = vertices && vertices.length > 0 ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;

  return (
    <group>
      {posts.map((post, i) => {
        if (localVertices && !isPointInPolygon(post.x, post.y, localVertices)) return null;

        const postHeight = Math.max(0.1, post.height + topOfPost + 12);
        return (
          <mesh key={\`post-\${i}\`} position={[post.x * IN, (topOfPost - postHeight / 2) * IN, post.y * IN]} castShadow receiveShadow>
            <boxGeometry args={[nominalWidth * IN, postHeight * IN, nominalWidth * IN]} />
            <meshStandardMaterial map={postTexture} roughness={0.82} bumpMap={postBump} bumpScale={0.015} />
          </mesh>
        );
      })}
    </group>
  );
}`;
code = code.replace(postsRegex, newPosts);

// 5. Replace Footers
const footersRegex = /function Footers\(\{ beamPositions, width, depth, joistOrientation, footerWidth, height \}\) \{[\s\S]*?return \([\s\S]*?<\/group>\);\n\}/;
const newFooters = `function Footers({ beamPositions, width, depth, joistOrientation, footerWidth, height, vertices, secX, secY, posts }) {
  const fWidth = footerWidth || 12;
  const fDepth = 12;
  const fColor = '#8a8a8a';
  const safeHeight = Math.max(1, typeof height === 'number' && !isNaN(height) ? height : 36);
  const yPos = -(safeHeight + 12 + fDepth / 2);
  const localVertices = vertices && vertices.length > 0 ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;
  const safePosts = Array.isArray(posts) ? posts : [];
  
  return (
    <group>
      {safePosts.map((post, i) => {
        if (localVertices && !isPointInPolygon(post.x, post.y, localVertices)) return null;
        return (
          <mesh key={\`footer-\${i}\`} position={[post.x * IN, yPos * IN, post.y * IN]} castShadow receiveShadow>
            <cylinderGeometry args={[fWidth / 2 * IN, fWidth / 2 * IN, fDepth * IN, 32]} />
            <meshStandardMaterial color={fColor} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}`;
code = code.replace(footersRegex, newFooters);

// 6. Update Render Loop to pass vertices, secX, secY, and posts
code = code.replace(
  /<Joists positions={calcs.joists.positions} width={sec.width} depth={sec.depth} joistSize={materials.joistSize} joistOrientation={sec.joistOrientation} \/>/,
  "<Joists positions={calcs.joists.positions} width={sec.width} depth={sec.depth} joistSize={materials.joistSize} joistOrientation={sec.joistOrientation} vertices={sec.vertices} secX={sec.x} secY={sec.y} />"
);

code = code.replace(
  /<Beams beamPositions={calcs.beams.positions} width={sec.width} depth={sec.depth} beamConfig={materials.beamConfig} joistSize={materials.joistSize} joistOrientation={sec.joistOrientation} \/>/,
  "<Beams beamPositions={calcs.beams.positions} width={sec.width} depth={sec.depth} beamConfig={materials.beamConfig} joistSize={materials.joistSize} joistOrientation={sec.joistOrientation} vertices={sec.vertices} secX={sec.x} secY={sec.y} />"
);

code = code.replace(
  /<Posts posts={calcs.posts.posts} postSize={materials.postSize} joistSize={materials.joistSize} beamConfig={materials.beamConfig} \/>/,
  "<Posts posts={calcs.posts.posts} postSize={materials.postSize} joistSize={materials.joistSize} beamConfig={materials.beamConfig} vertices={sec.vertices} secX={sec.x} secY={sec.y} />"
);

code = code.replace(
  /<Footers \n\s*beamPositions={calcs\.beams\.positions} \n\s*width={sec\.width} \n\s*depth={sec\.depth} \n\s*joistOrientation={sec\.joistOrientation} \n\s*footerWidth={sec\.footerWidth}\n\s*height={sec\.height}\n\s*\/>/m,
  `<Footers 
                      beamPositions={calcs.beams.positions} 
                      width={sec.width} 
                      depth={sec.depth} 
                      joistOrientation={sec.joistOrientation} 
                      footerWidth={sec.footerWidth}
                      height={sec.height}
                      vertices={sec.vertices}
                      secX={sec.x}
                      secY={sec.y}
                      posts={calcs.posts.posts}
                    />`
);


fs.writeFileSync(file, code, 'utf8');
console.log('Successfully patched Joists, Beams, Posts, and Footers.');
