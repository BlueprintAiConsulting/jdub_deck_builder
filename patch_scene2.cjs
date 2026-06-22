const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/Viewport3D/Scene3D.jsx');
let code = fs.readFileSync(file, 'utf8');

// 1. Replace DeckBoards
const deckBoardsRegex = /function DeckBoards\(\{.*?\}\) \{[\s\S]*?return \([\s\S]*?<\/group>\);\n\}/;
const newDeckBoards = `function DeckBoards({ vertices, secX, secY, species, deckMaterial, deckColor, deckBoardSize, joistOrientation, deckingOrientation, pictureFrame, dividerCount, boardsPerDivider, deckingFlipped, deckingLayout, deckBoardGap, width, depth }) {
  const boardSizeIn = LUMBER_ACTUAL[deckBoardSize] || { width: 1.0, depth: 5.5 };
  const boardW = boardSizeIn.depth;
  const boardH = boardSizeIn.width;
  const gap = deckBoardGap !== undefined ? deckBoardGap : 0.25;
  const boardSpacing = boardW + gap;

  const getBoardColor = () => {
    const opts = DECK_COLOR_OPTIONS[deckMaterial] || [];
    const opt = opts.find(o => o.value === deckColor);
    return opt ? opt.color : (DECK_MATERIAL_COLORS[deckMaterial] || WOOD_COLORS[species] || '#c4a35a');
  };

  const color = getBoardColor();
  const { type } = getMaterialVisuals(deckMaterial, species);

  const meshes = useMemo(() => {
    const localVertices = vertices && vertices.length > 0 ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;
    const joistOrient = joistOrientation || 'vertical';
    const deckingOpt = deckingOrientation || 'perpendicular';
    const pfCount = pictureFrame || 0;
    const isFlipped = deckingFlipped === true || deckingOpt === 'diagonal-down';

    const arr = [];
    const fieldYOffset = pfCount > 0 ? -0.02 : 0; // Prevent Z-fighting by dropping field slightly if picture framed

    // 1. Picture Frame Boards
    if (pfCount > 0) {
      if (localVertices) {
        for (let i = 0; i < localVertices.length; i++) {
          const v1 = localVertices[i];
          const v2 = localVertices[(i + 1) % localVertices.length];
          const dx = v2.x - v1.x;
          const dy = v2.y - v1.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          if (len < 0.1) continue;
          const midX = (v1.x + v2.x) / 2;
          const midY = (v1.y + v2.y) / 2;
          const angle = Math.atan2(dy, dx);
          
          for (let k = 0; k < pfCount; k++) {
             const nx = -dy / len;
             const ny = dx / len;
             const offsetDist = k * boardSpacing + boardW / 2;
             const posX = midX + nx * offsetDist;
             const posZ = midY + ny * offsetDist;
             
             arr.push({
                id: \`frame-poly-\${i}-\${k}\`,
                posX, posZ,
                sizeX: len + boardSpacing, // Add slight overlap for corners
                sizeZ: boardW,
                rotY: -angle,
                posY: boardH / 2
             });
          }
        }
      } else {
        for (let k = 0; k < pfCount; k++) {
          const insetMin = k * boardSpacing;
          const insetMax = (k + 1) * boardSpacing;
          const offset = k * boardSpacing + boardW / 2;
          arr.push({ id: \`frame-n-\${k}\`, posX: width / 2, posZ: offset, sizeX: width - 2 * insetMin, sizeZ: boardW, rotY: 0, posY: boardH / 2 });
          arr.push({ id: \`frame-s-\${k}\`, posX: width / 2, posZ: depth - offset, sizeX: width - 2 * insetMin, sizeZ: boardW, rotY: 0, posY: boardH / 2 });
          arr.push({ id: \`frame-w-\${k}\`, posX: offset, posZ: depth / 2, sizeX: boardW, sizeZ: depth - 2 * insetMax, rotY: 0, posY: boardH / 2 });
          arr.push({ id: \`frame-e-\${k}\`, posX: width - offset, posZ: depth / 2, sizeX: boardW, sizeZ: depth - 2 * insetMax, rotY: 0, posY: boardH / 2 });
        }
      }
    }

    // 2. Inner Field Area
    const frameWidth = pfCount * boardSpacing;
    const insetVertices = localVertices ? localVertices : [
      { x: frameWidth, y: frameWidth },
      { x: width - frameWidth, y: frameWidth },
      { x: width - frameWidth, y: depth - frameWidth },
      { x: frameWidth, y: depth - frameWidth }
    ];

    const joistsVertical = (joistOrient !== 'horizontal');
    let runsVertical = joistsVertical ? (deckingOpt === 'parallel') : (deckingOpt !== 'parallel');
    if (isFlipped) runsVertical = !runsVertical;

    const fieldW = width - 2 * frameWidth;
    const fieldD = depth - 2 * frameWidth;
    const span = runsVertical ? fieldD : fieldW;
    
    let N = 0;
    if (dividerCount === 'auto') N = span > 240 ? 1 : 0;
    else N = Number(dividerCount || 0);

    const boardsPerDiv = boardsPerDivider || 1;
    const divWidth = boardsPerDiv * boardW + (boardsPerDiv > 1 ? gap : 0);

    // 3. Draw Divider Boards
    if (N > 0) {
      for (let k = 0; k < N; k++) {
        const divCenter = frameWidth + (span / (N + 1)) * (k + 1);
        if (runsVertical) {
          for (let d = 0; d < boardsPerDiv; d++) {
            const zOffset = (d - (boardsPerDiv - 1) / 2) * boardSpacing;
            if (localVertices) {
              const segments = getHorizontalIntersections(divCenter + zOffset, localVertices);
              segments.forEach((seg, sIdx) => {
                const len = seg.endX - seg.startX;
                if (len > 1) {
                  arr.push({ id: \`div-\${k}-\${d}-\${sIdx}\`, posX: (seg.startX + seg.endX) / 2, posZ: divCenter + zOffset, sizeX: len, sizeZ: boardW, rotY: 0, posY: boardH / 2 + fieldYOffset });
                }
              });
            } else {
              arr.push({ id: \`div-\${k}-\${d}\`, posX: width / 2, posZ: divCenter + zOffset, sizeX: fieldW, sizeZ: boardW, rotY: 0, posY: boardH / 2 + fieldYOffset });
            }
          }
        } else {
          for (let d = 0; d < boardsPerDiv; d++) {
            const xOffset = (d - (boardsPerDiv - 1) / 2) * boardSpacing;
            if (localVertices) {
              const segments = getVerticalIntersections(divCenter + xOffset, localVertices);
              segments.forEach((seg, sIdx) => {
                const len = seg.endY - seg.startY;
                if (len > 1) {
                  arr.push({ id: \`div-\${k}-\${d}-\${sIdx}\`, posX: divCenter + xOffset, posZ: (seg.startY + seg.endY) / 2, sizeX: boardW, sizeZ: len, rotY: 0, posY: boardH / 2 + fieldYOffset });
                }
              });
            } else {
              arr.push({ id: \`div-\${k}-\${d}\`, posX: divCenter + xOffset, posZ: depth / 2, sizeX: boardW, sizeZ: fieldD, rotY: 0, posY: boardH / 2 + fieldYOffset });
            }
          }
        }
      }
    }

    // 4. Generate Field Decking Boards
    if (deckingOpt === 'diagonal' || deckingOpt === 'diagonal-up' || deckingOpt === 'diagonal-down') {
      const theta = isFlipped ? -Math.PI / 4 : Math.PI / 4;
      const cosNeg = Math.cos(-theta);
      const sinNeg = Math.sin(-theta);
      const rotatedVertices = insetVertices.map(v => ({
        x: v.x * cosNeg - v.y * sinNeg,
        y: v.x * sinNeg + v.y * cosNeg
      }));
      const localYs = rotatedVertices.map(v => v.y);
      const localMinY = Math.min(...localYs);
      const localMaxY = Math.max(...localYs);
      
      let y = localMinY, idx = 0;
      while (y < localMaxY) {
        const bw = Math.min(boardW, localMaxY - y);
        const boardCenterY = y + bw / 2;
        const segments = getHorizontalIntersections(boardCenterY, rotatedVertices);
        
        segments.forEach((seg, sIdx) => {
          const boardLength = seg.endX - seg.startX;
          if (boardLength > 2.0) { // Filter slivers
            const rotatedCenterX = (seg.startX + seg.endX) / 2;
            const rotatedCenterY = boardCenterY;
            const cosPos = Math.cos(theta);
            const sinPos = Math.sin(theta);
            const posX = rotatedCenterX * cosPos - rotatedCenterY * sinPos;
            const posZ = rotatedCenterX * sinPos + rotatedCenterY * cosPos;
            arr.push({ id: \`field-\${idx}-\${sIdx}\`, posX, posZ, sizeX: boardLength, sizeZ: bw, rotY: -theta, posY: boardH / 2 + fieldYOffset });
          }
        });
        y += boardSpacing;
        idx++;
      }
    } else {
      if (runsVertical) {
        const localXs = insetVertices.map(v => v.x);
        const localMinX = Math.min(...localXs);
        const localMaxX = Math.max(...localXs);
        let x = localMinX, idx = 0;
        while (x < localMaxX) {
          const bw = Math.min(boardW, localMaxX - x);
          const boardCenterX = x + bw / 2;
          const segments = getVerticalIntersections(boardCenterX, insetVertices);
          segments.forEach((seg, sIdx) => {
            let currentSegments = [seg];
            for (let k = 0; k < N; k++) {
              const divCenter = frameWidth + (span / (N + 1)) * (k + 1);
              const divMinY = divCenter - divWidth / 2;
              const divMaxY = divCenter + divWidth / 2;
              const nextSegments = [];
              currentSegments.forEach((s) => {
                if (s.endY <= divMinY) nextSegments.push(s);
                else if (s.startY >= divMaxY) nextSegments.push(s);
                else {
                  if (divMinY - s.startY > 2.0) nextSegments.push({ startY: s.startY, endY: divMinY });
                  if (s.endY - divMaxY > 2.0) nextSegments.push({ startY: divMaxY, endY: s.endY });
                }
              });
              currentSegments = nextSegments;
            }
            currentSegments.forEach((sub, subIdx) => {
              const boardHeight = sub.endY - sub.startY;
              if (boardHeight > 2.0) { // Filter slivers
                arr.push({ id: \`field-\${idx}-\${sIdx}-\${subIdx}\`, posX: boardCenterX, posZ: sub.startY + boardHeight / 2, sizeX: bw, sizeZ: boardHeight, rotY: 0, posY: boardH / 2 + fieldYOffset });
              }
            });
          });
          x += boardSpacing;
          idx++;
        }
      } else {
        const localYs = insetVertices.map(v => v.y);
        const localMinY = Math.min(...localYs);
        const localMaxY = Math.max(...localYs);
        let y = localMinY, idx = 0;
        while (y < localMaxY) {
          const bw = Math.min(boardW, localMaxY - y);
          const boardCenterY = y + bw / 2;
          const segments = getHorizontalIntersections(boardCenterY, insetVertices);
          segments.forEach((seg, sIdx) => {
            let currentSegments = [seg];
            for (let k = 0; k < N; k++) {
              const divCenter = frameWidth + (span / (N + 1)) * (k + 1);
              const divMinX = divCenter - divWidth / 2;
              const divMaxX = divCenter + divWidth / 2;
              const nextSegments = [];
              currentSegments.forEach((s) => {
                if (s.endX <= divMinX) nextSegments.push(s);
                else if (s.startX >= divMaxX) nextSegments.push(s);
                else {
                  if (divMinX - s.startX > 2.0) nextSegments.push({ startX: s.startX, endX: divMinX });
                  if (s.endX - divMaxX > 2.0) nextSegments.push({ startX: divMaxX, endX: s.endX });
                }
              });
              currentSegments = nextSegments;
            }
            currentSegments.forEach((sub, subIdx) => {
              const boardLength = sub.endX - sub.startX;
              if (boardLength > 2.0) { // Filter slivers
                arr.push({ id: \`field-\${idx}-\${sIdx}-\${subIdx}\`, posX: sub.startX + boardLength / 2, posZ: boardCenterY, sizeX: boardLength, sizeZ: bw, rotY: 0, posY: boardH / 2 + fieldYOffset });
              }
            });
          });
          y += boardSpacing;
          idx++;
        }
      }
    }

    return arr;
  }, [vertices, secX, secY, width, depth, boardW, boardH, gap, boardSpacing, joistOrientation, deckingOrientation, pictureFrame, dividerCount, boardsPerDivider, deckingFlipped, isFlipped, runsVertical, frameWidth, span]);

  return (
    <group>
      {meshes.map((m, i) => {
        const varId = \`\${type}-\${i % 5}\`;
        const tex = getProceduralTexture(color, varId);
        const bump = getProceduralBumpTexture(varId);
        return (
          <mesh key={m.id} position={[m.posX * IN, m.posY * IN, m.posZ * IN]} rotation={[0, m.rotY, 0]} castShadow receiveShadow>
            <boxGeometry args={[m.sizeX * IN, boardH * IN, m.sizeZ * IN]} />
            {type === 'composite' ? (
              <meshStandardMaterial map={tex} roughness={0.7} bumpMap={bump} bumpScale={0.01} metalness={0.05} />
            ) : (
              <meshStandardMaterial map={tex} bumpMap={bump} bumpScale={0.02} roughness={0.8} />
            )}
          </mesh>
        );
      })}
    </group>
  );
}`;
code = code.replace(deckBoardsRegex, newDeckBoards);


// 2. Replace Railings
const railingsRegex = /function Railings\(\{.*?\}\) \{[\s\S]*?return \([\s\S]*?<\/group>\);\n\}/;
const newRailings = `function Railings({ railings, width, depth, height, species, deckMaterial, deckColor, vertices, secX, secY, joistSize }) {
  const guardHeight = Math.max(24, RAILING_RULES.guardMinHeight || 36);
  const postWidth = 3.5;
  const railWidth = 1.5;
  const balusterSpacing = Math.max(1.0, RAILING_RULES.balusterMaxSpacing || 4.0);
  const deckTopY = (LUMBER_ACTUAL['5/4x6']?.width || 1.0) * IN;
  const joistActual = LUMBER_ACTUAL[joistSize] || { depth: 7.25 };
  const postBottomY = -joistActual.depth * IN; // Mount to bottom of joists

  const getBoardColor = () => {
    const opts = DECK_COLOR_OPTIONS[deckMaterial] || [];
    const opt = opts.find(o => o.value === deckColor);
    return opt ? opt.color : (DECK_MATERIAL_COLORS[deckMaterial] || WOOD_COLORS[species] || '#c4a35a');
  };
  const color = getBoardColor();
  const { type } = getMaterialVisuals(deckMaterial, species);

  const edges = useMemo(() => {
    const result = [];
    if (!railings) return result;
    const localVertices = vertices && vertices.length > 0 ? vertices.map(v => ({ x: v.x - secX, y: v.y - secY })) : null;

    if (localVertices) {
      for (let i = 0; i < localVertices.length; i++) {
        const v1 = localVertices[i];
        const v2 = localVertices[(i + 1) % localVertices.length];
        
        // Skip edges based on legacy bounding box disables
        let skip = false;
        if (!railings.n && Math.abs(v1.y) < 1 && Math.abs(v2.y) < 1) skip = true;
        if (!railings.s && Math.abs(v1.y - depth) < 1 && Math.abs(v2.y - depth) < 1) skip = true;
        if (!railings.w && Math.abs(v1.x) < 1 && Math.abs(v2.x) < 1) skip = true;
        if (!railings.e && Math.abs(v1.x - width) < 1 && Math.abs(v2.x - width) < 1) skip = true;
        
        if (!skip) {
           result.push({ edge: \`poly-\${i}\`, x1: v1.x, z1: v1.y, x2: v2.x, z2: v2.y });
        }
      }
    } else {
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
  }, [railings, width, depth, vertices, secX, secY]);

  return (
    <group>
      {edges.map(({ edge, x1, z1, x2, z2 }, edgeIdx) => {
        const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
        if (length < 1) return null;
        
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;
        const angle = Math.atan2(z2 - z1, x2 - x1);
        const rotY = -angle;

        // Inset corner posts slightly so they don't hang entirely off the edge
        const insetX1 = x1 + (x2 - x1) * (postWidth / 2 / length);
        const insetZ1 = z1 + (z2 - z1) * (postWidth / 2 / length);
        const insetX2 = x2 - (x2 - x1) * (postWidth / 2 / length);
        const insetZ2 = z2 - (z2 - z1) * (postWidth / 2 / length);

        const cornerPosts = [
          { x: insetX1, z: insetZ1 },
          { x: insetX2, z: insetZ2 },
        ];

        const numBalusters = Math.max(0, Math.floor(length / (balusterSpacing + 1.5)) - 1);
        const balusters = [];
        for (let i = 1; i <= numBalusters; i++) {
          const frac = i / (numBalusters + 1);
          balusters.push({
            x: x1 + (x2 - x1) * frac,
            z: z1 + (z2 - z1) * frac,
          });
        }
        
        // Post drops down to joistBottom.
        const postH = (deckTopY - postBottomY) + guardHeight * IN;
        const postCenterY = postBottomY + postH / 2;

        return (
          <group key={\`railing-\${edge}\`}>
            {cornerPosts.map((p, i) => {
              const capY = postBottomY + postH;
              const postVar = \`\${type}-\${(edgeIdx * 2 + i) % 5}\`;
              const postTex = getProceduralTexture(color, postVar);
              const postBump = getProceduralBumpTexture(postVar);
              return (
                <group key={\`rpost-group-\${edge}-\${i}\`}>
                  <mesh position={[p.x * IN, postCenterY, p.z * IN]} rotation={[0, rotY, 0]} castShadow receiveShadow>
                    <boxGeometry args={[postWidth * IN, postH, postWidth * IN]} />
                    <meshStandardMaterial map={postTex} bumpMap={postBump} bumpScale={0.015} roughness={type === 'composite' ? 0.8 : 0.65} metalness={0.02} />
                  </mesh>
                  <mesh position={[p.x * IN, capY + 0.5 * IN, p.z * IN]} rotation={[0, rotY, 0]} castShadow>
                    <boxGeometry args={[4.2 * IN, 1 * IN, 4.2 * IN]} />
                    <meshStandardMaterial color="#2d3436" emissive="#000000" roughness={0.2} metalness={0.8} />
                  </mesh>
                </group>
              );
            })}

            {(() => {
              const railVar = \`\${type}-\${(edgeIdx * 2) % 5}\`;
              const railTex = getProceduralTexture(color, railVar);
              const railBump = getProceduralBumpTexture(railVar);
              return (
                <mesh position={[midX * IN, deckTopY + guardHeight * IN, midZ * IN]} rotation={[0, rotY, 0]} castShadow receiveShadow>
                  <boxGeometry args={[length * IN, railWidth * IN, railWidth * IN]} />
                  <meshStandardMaterial map={railTex} bumpMap={railBump} bumpScale={0.015} roughness={type === 'composite' ? 0.8 : 0.65} metalness={0.02} />
                </mesh>
              );
            })()}

            {(() => {
              const railVar = \`\${type}-\${(edgeIdx * 2 + 1) % 5}\`;
              const railTex = getProceduralTexture(color, railVar);
              const railBump = getProceduralBumpTexture(railVar);
              return (
                <mesh position={[midX * IN, deckTopY + 4 * IN, midZ * IN]} rotation={[0, rotY, 0]} castShadow receiveShadow>
                  <boxGeometry args={[length * IN, railWidth * IN, railWidth * IN]} />
                  <meshStandardMaterial map={railTex} bumpMap={railBump} bumpScale={0.015} roughness={type === 'composite' ? 0.8 : 0.65} metalness={0.02} />
                </mesh>
              );
            })()}

            {balusters.map((b, i) => {
              const balVar = \`\${type}-\${(edgeIdx * 11 + i) % 5}\`;
              const balTex = getProceduralTexture(color, balVar);
              const balBump = getProceduralBumpTexture(balVar);
              return (
                <mesh key={\`bal-\${edge}-\${i}\`} position={[b.x * IN, deckTopY + guardHeight / 2 * IN, b.z * IN]} rotation={[0, rotY, 0]} castShadow receiveShadow>
                  <boxGeometry args={[1 * IN, (guardHeight - 2) * IN, 1 * IN]} />
                  {type === 'composite' ? (
                    <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} />
                  ) : (
                    <meshStandardMaterial map={balTex} bumpMap={balBump} bumpScale={0.015} roughness={0.65} metalness={0.02} />
                  )}
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}`;
code = code.replace(railingsRegex, newRailings);

// 3. Update Render Loop to pass vertices, secX, secY, joistSize to Railings
code = code.replace(
  /<Railings \n\s*railings={sec\.railings} \n\s*width={sec\.width} \n\s*depth={sec\.depth} \n\s*height={sec\.height} \n\s*species={materials\.species}\n\s*deckMaterial={materials\.deckMaterial}\n\s*deckColor={materials\.deckColor}\n\s*\/>/m,
  `<Railings 
                    railings={sec.railings} 
                    width={sec.width} 
                    depth={sec.depth} 
                    height={sec.height} 
                    species={materials.species}
                    deckMaterial={materials.deckMaterial}
                    deckColor={materials.deckColor}
                    vertices={sec.vertices}
                    secX={sec.x}
                    secY={sec.y}
                    joistSize={materials.joistSize}
                  />`
);

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully patched DeckBoards and Railings.');
