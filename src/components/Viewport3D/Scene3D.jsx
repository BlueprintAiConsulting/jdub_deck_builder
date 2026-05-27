import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useDeckStore } from '../../store/deckStore';
import { WOOD_COLORS } from '../Materials/materialData';
import { LUMBER_ACTUAL, RAILING_RULES, STAIR_RULES } from '../../engine/spanTables';
import './Scene3D.css';

const IN = 1 / 12; // inches to scene units (feet)

const textureCache = {};

export function getProceduralTexture(colorHex, type) {
  const cacheKey = `${colorHex}-${type}`;
  if (textureCache[cacheKey]) {
    return textureCache[cacheKey];
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base fill
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 512, 512);

  if (type === 'composite') {
    // Composite/PVC extrusion stripes
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const alpha = Math.random() * 0.04;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = 4; y < 512; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
  } else {
    // Wood grain lines
    for (let y = 0; y < 512; y += Math.random() * 3 + 1) {
      const darkAlpha = Math.random() * 0.06;
      ctx.fillStyle = `rgba(0,0,0,${darkAlpha})`;
      ctx.fillRect(0, y, 512, Math.random() * 1.5 + 0.5);
    }
    
    // Wave growth rings
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const yOffset = i * 75 - 50;
      ctx.beginPath();
      ctx.moveTo(0, yOffset);
      ctx.bezierCurveTo(128, yOffset + 35, 384, yOffset - 25, 512, yOffset + 15);
      ctx.stroke();
    }

    // Wood knot
    const knotX = 220;
    const knotY = 180;
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.strokeStyle = 'rgba(0,0,0,0.03)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(knotX, knotY, 15, 8, 0.08, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    for (let r = 20; r < 70; r += 12) {
      ctx.beginPath();
      ctx.ellipse(knotX, knotY, r, r * 0.45, 0.08, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache[cacheKey] = texture;
  return texture;
}

export function getMaterialVisuals(deckMaterial, species) {
  let color = '#c4a35a';
  let type = 'wood';

  if (deckMaterial === 'CEDAR') {
    color = WOOD_COLORS['CEDAR'] || '#b5724b';
  } else if (deckMaterial === 'REDWOOD') {
    color = WOOD_COLORS['REDWOOD'] || '#8b3a3a';
  } else if (deckMaterial === 'COMPOSITE') {
    color = '#5c5650';
    type = 'composite';
  } else if (deckMaterial === 'PVC') {
    color = '#cbd5e1';
    type = 'composite';
  } else {
    color = WOOD_COLORS[species] || '#c4a35a';
  }

  return { color, type };
}

export function getHorizontalIntersections(y, vertices) {
  const intersections = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    
    if (y >= minY && y <= maxY && minY !== maxY) {
      const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
      intersections.push(x);
    }
  }
  
  const sorted = intersections.sort((a, b) => a - b);
  const unique = [];
  for (let i = 0; i < sorted.length; i++) {
    if (unique.length === 0 || Math.abs(sorted[i] - unique[unique.length - 1]) > 0.001) {
      unique.push(sorted[i]);
    }
  }
  
  const segments = [];
  for (let i = 0; i < unique.length - 1; i += 2) {
    segments.push({ startX: unique[i], endX: unique[i + 1] });
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
    
    if (x >= minX && x <= maxX && minX !== maxX) {
      const y = a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x);
      intersections.push(y);
    }
  }
  
  const sorted = intersections.sort((a, b) => a - b);
  const unique = [];
  for (let i = 0; i < sorted.length; i++) {
    if (unique.length === 0 || Math.abs(sorted[i] - unique[unique.length - 1]) > 0.001) {
      unique.push(sorted[i]);
    }
  }
  
  const segments = [];
  for (let i = 0; i < unique.length - 1; i += 2) {
    segments.push({ startY: unique[i], endY: unique[i + 1] });
  }
  return segments;
}

function DeckBoards({ vertices, secX, secY, species, deckMaterial, deckBoardSize, joistOrientation, deckingOrientation }) {
  const { color, type } = getMaterialVisuals(deckMaterial, species);
  const texture = getProceduralTexture(color, type);
  const boardW = LUMBER_ACTUAL[deckBoardSize || '5/4x6']?.depth || 5.5;
  const boardH = LUMBER_ACTUAL[deckBoardSize || '5/4x6']?.width || 1.0;
  const gap = 0.125;

  const boards = useMemo(() => {
    if (!vertices || vertices.length === 0) return [];
    
    const localVertices = vertices.map(v => ({ x: v.x - secX, y: v.y - secY }));
    const joistOrient = joistOrientation || 'vertical';
    const deckingOpt = deckingOrientation || 'perpendicular';

    const arr = [];
    if (deckingOpt === 'diagonal') {
      const theta = Math.PI / 4;
      const cosNeg = Math.cos(-theta);
      const sinNeg = Math.sin(-theta);
      const rotatedVertices = localVertices.map(v => ({
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
          if (boardLength > 0.5) {
            const rotatedCenterX = (seg.startX + seg.endX) / 2;
            const rotatedCenterY = boardCenterY;
            const cosPos = Math.cos(theta);
            const sinPos = Math.sin(theta);
            const posX = rotatedCenterX * cosPos - rotatedCenterY * sinPos;
            const posZ = rotatedCenterX * sinPos + rotatedCenterY * cosPos;
            arr.push({
              id: `${idx}-${sIdx}`,
              posX,
              posZ,
              sizeX: boardLength,
              sizeZ: bw,
              rotY: -theta
            });
          }
        });
        y += boardW + gap;
        idx++;
      }
    } else {
      const joistsVertical = (joistOrient !== 'horizontal');
      const runsVertical = joistsVertical ? (deckingOpt === 'parallel') : (deckingOpt !== 'parallel');
      
      if (runsVertical) {
        const localXs = localVertices.map(v => v.x);
        const localMinX = Math.min(...localXs);
        const localMaxX = Math.max(...localXs);
        let x = localMinX, idx = 0;
        while (x < localMaxX) {
          const bw = Math.min(boardW, localMaxX - x);
          const boardCenterX = x + bw / 2;
          const segments = getVerticalIntersections(boardCenterX, localVertices);
          segments.forEach((seg, sIdx) => {
            const boardHeight = seg.endY - seg.startY;
            if (boardHeight > 0.5) {
              arr.push({
                id: `${idx}-${sIdx}`,
                posX: boardCenterX,
                posZ: seg.startY + boardHeight / 2,
                sizeX: bw,
                sizeZ: boardHeight,
                rotY: 0
              });
            }
          });
          x += boardW + gap;
          idx++;
        }
      } else {
        const localYs = localVertices.map(v => v.y);
        const localMinY = Math.min(...localYs);
        const localMaxY = Math.max(...localYs);
        let y = localMinY, idx = 0;
        while (y < localMaxY) {
          const bw = Math.min(boardW, localMaxY - y);
          const boardCenterY = y + bw / 2;
          const segments = getHorizontalIntersections(boardCenterY, localVertices);
          segments.forEach((seg, sIdx) => {
            const boardWidth = seg.endX - seg.startX;
            if (boardWidth > 0.5) {
              arr.push({
                id: `${idx}-${sIdx}`,
                posX: seg.startX + boardWidth / 2,
                posZ: boardCenterY,
                sizeX: boardWidth,
                sizeZ: bw,
                rotY: 0
              });
            }
          });
          y += boardW + gap;
          idx++;
        }
      }
    }
    return arr;
  }, [vertices, secX, secY, boardW, joistOrientation, deckingOrientation]);

  return (
    <group>
      {boards.map(({ id, posX, posZ, sizeX, sizeZ, rotY }) => (
        <mesh key={`board-${id}`} position={[posX * IN, boardH / 2 * IN, posZ * IN]} rotation={[0, rotY, 0]} castShadow receiveShadow>
          <boxGeometry args={[sizeX * IN, boardH * IN, sizeZ * IN]} />
          <meshStandardMaterial map={texture} roughness={type === 'composite' ? 0.8 : 0.65} metalness={0.03} />
        </mesh>
      ))}
    </group>
  );
}

function Joists({ positions, width, depth, joistSize, joistOrientation }) {
  const actual = LUMBER_ACTUAL[joistSize] || { width: 1.5, depth: 7.25 };
  const isHorizontal = joistOrientation === 'horizontal';
  const joistTexture = getProceduralTexture('#5a4d3b', 'wood');

  return (
    <group>
      {positions.map((coordIn, i) => {
        const posX = isHorizontal ? width / 2 : coordIn;
        const posZ = isHorizontal ? coordIn : depth / 2;
        const sizeX = isHorizontal ? width : actual.width;
        const sizeZ = isHorizontal ? actual.width : depth;
        return (
          <mesh key={`joist-${i}`} position={[posX * IN, -actual.depth / 2 * IN, posZ * IN]} castShadow receiveShadow>
            <boxGeometry args={[sizeX * IN, actual.depth * IN, sizeZ * IN]} />
            <meshStandardMaterial map={joistTexture} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

function Beams({ beamPositions, width, depth, beamConfig, joistSize, joistOrientation }) {
  const isHorizontal = joistOrientation === 'horizontal';
  const beamSize = beamConfig.split('-').slice(1).join('-') || '2x10';
  const actual = LUMBER_ACTUAL[beamSize] || { width: 1.5, depth: 9.25 };
  const joistActual = LUMBER_ACTUAL[joistSize] || { depth: 7.25 };
  const ply = parseInt(beamConfig.split('-')[0]) || 2;
  const beamTopY = -joistActual.depth;
  const beamTexture = getProceduralTexture('#4e3f2d', 'wood');

  return (
    <group>
      {beamPositions.map((coordIn, i) => (
        <group key={`beam-${i}`}>
          {Array.from({ length: ply }, (_, p) => {
            const offset = (p - (ply - 1) / 2) * actual.width;
            const posX = isHorizontal ? coordIn * IN : (width / 2 + offset) * IN;
            const posZ = isHorizontal ? (depth / 2 + offset) * IN : coordIn * IN;
            const sizeX = isHorizontal ? actual.width * IN : width * IN;
            const sizeZ = isHorizontal ? depth * IN : actual.width * IN;
            return (
              <mesh
                key={`beam-${i}-${p}`}
                position={[
                  posX,
                  (beamTopY - actual.depth / 2) * IN,
                  posZ,
                ]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[sizeX, actual.depth * IN, sizeZ]} />
                <meshStandardMaterial map={beamTexture} roughness={0.8} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function Posts({ posts, postSize, joistSize, beamConfig }) {
  const nominalWidth = postSize === '6x6' ? 5.5 : 3.5;
  const joistActual = LUMBER_ACTUAL[joistSize] || { depth: 7.25 };
  const beamSize = beamConfig.split('-').slice(1).join('-') || '2x10';
  const beamActual = LUMBER_ACTUAL[beamSize] || { depth: 9.25 };
  const topOfPost = -(joistActual.depth + beamActual.depth);
  const postTexture = getProceduralTexture('#504230', 'wood');

  return (
    <group>
      {posts.map((post, i) => {
        const postHeight = post.height + 60 + topOfPost;
        return (
          <mesh
            key={`post-${i}`}
            position={[
              post.x * IN,
              (topOfPost - postHeight / 2) * IN,
              post.y * IN,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[nominalWidth * IN, postHeight * IN, nominalWidth * IN]} />
            <meshStandardMaterial map={postTexture} roughness={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

function Railings({ railings, width, depth, height, species, deckMaterial, lightingPreset }) {
  const isNight = lightingPreset === 'night';
  const guardHeight = RAILING_RULES.guardMinHeight; // 36"
  const postWidth = 3.5;
  const railWidth = 1.5;
  const balusterSpacing = RAILING_RULES.balusterMaxSpacing;
  const deckTopY = (LUMBER_ACTUAL['5/4x6']?.width || 1.0) * IN;

  const { color, type } = getMaterialVisuals(deckMaterial, species);
  const texture = getProceduralTexture(color, type);

  const edges = useMemo(() => {
    const result = [];
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
    return result;
  }, [railings, width, depth]);

  return (
    <group>
      {edges.map(({ edge, x1, z1, x2, z2 }) => {
        const length = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;
        const isHorizontal = edge === 'n' || edge === 's';
        const rotY = isHorizontal ? 0 : Math.PI / 2;

        const cornerPosts = [
          { x: x1, z: z1 },
          { x: x2, z: z2 },
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

        return (
          <group key={`railing-${edge}`}>
            {/* Corner posts with Caps */}
            {cornerPosts.map((p, i) => {
              const capY = deckTopY + guardHeight * IN;
              return (
                <group key={`rpost-group-${edge}-${i}`}>
                  <mesh position={[p.x * IN, deckTopY + guardHeight / 2 * IN, p.z * IN]} castShadow receiveShadow>
                    <boxGeometry args={[postWidth * IN, guardHeight * IN, postWidth * IN]} />
                    <meshStandardMaterial map={texture} roughness={0.7} />
                  </mesh>

                  {/* Post Cap */}
                  <mesh position={[p.x * IN, capY + 0.5 * IN, p.z * IN]} castShadow>
                    <boxGeometry args={[4.2 * IN, 1 * IN, 4.2 * IN]} />
                    <meshStandardMaterial 
                      color={isNight ? '#ffeaa7' : '#2d3436'} 
                      emissive={isNight ? '#ffeaa7' : '#000000'}
                      emissiveIntensity={isNight ? 1.5 : 0}
                      roughness={0.2} 
                      metalness={0.8}
                    />
                  </mesh>

                  {/* Glowing post cap point light */}
                  {isNight && (
                    <pointLight 
                      position={[p.x * IN, capY + 1 * IN, p.z * IN]}
                      intensity={1.5} 
                      distance={8} 
                      decay={2} 
                      color="#ffeaa7" 
                    />
                  )}
                </group>
              );
            })}

            {/* Top rail */}
            <mesh position={[midX * IN, deckTopY + guardHeight * IN, midZ * IN]} rotation={[0, rotY, 0]} castShadow receiveShadow>
              <boxGeometry args={[length * IN, railWidth * IN, railWidth * IN]} />
              <meshStandardMaterial map={texture} roughness={0.65} />
            </mesh>

            {/* Bottom rail */}
            <mesh position={[midX * IN, deckTopY + 4 * IN, midZ * IN]} rotation={[0, rotY, 0]} castShadow receiveShadow>
              <boxGeometry args={[length * IN, railWidth * IN, railWidth * IN]} />
              <meshStandardMaterial map={texture} roughness={0.65} />
            </mesh>

            {/* Balusters */}
            {balusters.map((b, i) => (
              <mesh key={`bal-${edge}-${i}`} position={[b.x * IN, deckTopY + guardHeight / 2 * IN, b.z * IN]} castShadow receiveShadow>
                <boxGeometry args={[1 * IN, (guardHeight - 2) * IN, 1 * IN]} />
                {type === 'composite' ? (
                  <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} />
                ) : (
                  <meshStandardMaterial map={texture} roughness={0.75} />
                )}
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function Stairs({ stairEdge, stairCalcs, width, depth, species, deckMaterial }) {
  if (!stairEdge || !stairCalcs) return null;

  const { numRisers, numTreads, riserHeight, totalRun } = stairCalcs;
  const stairWidth = stairCalcs.width || STAIR_RULES.maxStairWidth;
  const treadDepth = stairCalcs.treadDepth || STAIR_RULES.idealTreadDepth;
  const treadThickness = 1.0;
  const deckTopY = (LUMBER_ACTUAL['5/4x6']?.width || 1.0);

  const { color, type } = getMaterialVisuals(deckMaterial, species);
  const texture = getProceduralTexture(color, type);

  let startX, startZ, dirX, dirZ, rotY;
  const align = stairCalcs.align || 'center';
  if (stairEdge === 's') {
    startX = align === 'left' ? 0 : (align === 'right' ? width - stairWidth : width / 2 - stairWidth / 2);
    startZ = depth;
    dirX = 0; dirZ = 1; rotY = 0;
  } else if (stairEdge === 'n') {
    startX = align === 'left' ? 0 : (align === 'right' ? width - stairWidth : width / 2 - stairWidth / 2);
    startZ = 0;
    dirX = 0; dirZ = -1; rotY = Math.PI;
  } else if (stairEdge === 'e') {
    startX = width;
    startZ = align === 'left' ? 0 : (align === 'right' ? depth - stairWidth : depth / 2 - stairWidth / 2);
    dirX = 1; dirZ = 0; rotY = -Math.PI / 2;
  } else {
    startX = 0;
    startZ = align === 'left' ? 0 : (align === 'right' ? depth - stairWidth : depth / 2 - stairWidth / 2);
    dirX = -1; dirZ = 0; rotY = Math.PI / 2;
  }

  const treads = [];
  for (let i = 0; i < numTreads; i++) {
    const rise = deckTopY - (i + 1) * riserHeight;
    const run = (i + 0.5) * treadDepth;
    treads.push({
      x: startX + dirX * run,
      y: rise,
      z: startZ + dirZ * run,
    });
  }

  const isVertical = stairEdge === 'n' || stairEdge === 's';
  const treadW = isVertical ? stairWidth : treadDepth;
  const treadD = isVertical ? treadDepth : stairWidth;

  return (
    <group>
      {/* Treads */}
      {treads.map((t, i) => (
        <mesh key={`tread-${i}`} position={[t.x * IN, t.y * IN, t.z * IN]} castShadow receiveShadow>
          <boxGeometry args={[treadW * IN, treadThickness * IN, treadD * IN]} />
          <meshStandardMaterial map={texture} roughness={0.7} />
        </mesh>
      ))}

      {/* Risers */}
      {treads.map((t, i) => (
        <mesh
          key={`riser-${i}`}
          position={[
            t.x * IN,
            (t.y + riserHeight / 2) * IN,
            (t.z + dirZ * treadDepth / 2) * IN + (isVertical ? 0 : dirX * treadDepth / 2 * IN),
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[
            (isVertical ? stairWidth : 0.75) * IN,
            riserHeight * IN,
            (isVertical ? 0.75 : stairWidth) * IN,
          ]} />
          <meshStandardMaterial map={texture} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function HouseWall({ width, height }) {
  const wallHeight = Math.max(height, 96);
  const wallThick = 6;
  const deckTopY = (LUMBER_ACTUAL['5/4x6']?.width || 1.0);
  return (
    <mesh position={[width / 2 * IN, (deckTopY + wallHeight / 2) * IN, -wallThick / 2 * IN]} castShadow receiveShadow>
      <boxGeometry args={[(width + 24) * IN, wallHeight * IN, wallThick * IN]} />
      <meshStandardMaterial color="#3a3a4a" roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

function GroundPlane({ lightingPreset }) {
  const theme = useDeckStore((s) => s.theme);
  const isLightTheme = theme === 'light';

  let groundColor = isLightTheme ? '#2d5a27' : '#1a3a1a';
  if (lightingPreset === 'night') {
    groundColor = '#061305';
  } else if (lightingPreset === 'goldenHour') {
    groundColor = isLightTheme ? '#4a6b2c' : '#1b2612';
  }

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color={groundColor} roughness={1} />
    </mesh>
  );
}

export default function Scene3D() {
  const theme = useDeckStore((s) => s.theme);
  const sections = useDeckStore((s) => s.sections);
  const sectionCalcs = useDeckStore((s) => s.sectionCalcs);
  const materials = useDeckStore((s) => s.materials);
  const lightingPreset = useDeckStore((s) => s.lightingPreset) || 'daylight';
  const setLightingPreset = useDeckStore((s) => s.setLightingPreset);

  const isNight = lightingPreset === 'night';
  const isGoldenHour = lightingPreset === 'goldenHour';
  const isDaylight = lightingPreset === 'daylight';

  // Preset lighting values
  let ambientColor = '#ffffff';
  let ambientIntensity = 0.45;
  
  let sunPosition = [20, 35, 20];
  let sunColor = '#ffffff';
  let sunIntensity = 1.2;
  
  let fillPosition = [-10, 15, -10];
  let fillColor = '#a9c1e6';
  let fillIntensity = 0.3;
  
  let hemiColor = '#aaddff';
  let hemiGroundColor = '#332200';
  let hemiIntensity = 0.2;
  
  const isLightTheme = theme === 'light';
  let bgColor = isLightTheme ? '#f1f5f9' : '#0a1628';
  let fogNear = 40;
  let fogFar = 120;

  if (isNight) {
    ambientColor = '#0a0f1d';
    ambientIntensity = 0.04;
    
    sunPosition = [-10, 20, -10];
    sunColor = '#9bb6e0';
    sunIntensity = 0.15;
    
    fillIntensity = 0;
    
    hemiColor = '#3b82f6';
    hemiGroundColor = '#000000';
    hemiIntensity = 0.02;
    
    bgColor = '#030712';
    fogNear = 25;
    fogFar = 75;
  } else if (isGoldenHour) {
    ambientColor = '#ffd2a1';
    ambientIntensity = 0.35;
    
    sunPosition = [35, 12, 15];
    sunColor = '#ff8833';
    sunIntensity = 1.4;
    
    fillPosition = [-20, 10, -20];
    fillColor = '#443355';
    fillIntensity = 0.2;
    
    hemiColor = '#ffaa66';
    hemiGroundColor = '#221100';
    hemiIntensity = 0.15;
    
    bgColor = isLightTheme ? '#fcd34d' : '#1a0f0d';
    fogNear = 30;
    fogFar = 90;
  } else {
    if (isLightTheme) {
      bgColor = '#f1f5f9';
    } else {
      bgColor = '#0a1628';
    }
  }

  const bounds = useMemo(() => {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, maxH = 0;
    sections.forEach((s) => {
      minX = Math.min(minX, s.x); minZ = Math.min(minZ, s.y);
      maxX = Math.max(maxX, s.x + s.width); maxZ = Math.max(maxZ, s.y + s.depth);
      maxH = Math.max(maxH, s.height);
    });
    return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ, h: maxH };
  }, [sections]);

  const cameraTarget = useMemo(() => [bounds.cx * IN, 0, bounds.cz * IN], [bounds]);

  return (
    <div className="scene3d-container">
      <Canvas shadows>
        <PerspectiveCamera
          makeDefault
          position={[
            (bounds.cx + bounds.w) * IN * 1.2,
            bounds.h * IN * 3,
            (bounds.cz + bounds.d) * IN * 1.2,
          ]}
          fov={50}
        />
        <OrbitControls target={cameraTarget} enableDamping dampingFactor={0.1} />

        <ambientLight intensity={ambientIntensity} color={ambientColor} />
        
        <directionalLight 
          position={sunPosition} 
          intensity={sunIntensity} 
          color={sunColor} 
          castShadow 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048} 
        />
        
        {fillIntensity > 0 && (
          <directionalLight 
            position={fillPosition} 
            intensity={fillIntensity} 
            color={fillColor} 
          />
        )}
        
        <hemisphereLight 
          intensity={hemiIntensity} 
          color={hemiColor} 
          groundColor={hemiGroundColor} 
        />

        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, fogNear, fogFar]} />

        {sections.map((sec) => {
          const calcs = sectionCalcs[sec.id];
          if (!calcs) return null;
          return (
            <group key={sec.id} position={[sec.x * IN, sec.height * IN, sec.y * IN]}>
              <DeckBoards 
                vertices={sec.vertices} 
                secX={sec.x} 
                secY={sec.y} 
                species={materials.species} 
                deckMaterial={materials.deckMaterial} 
                deckBoardSize={materials.deckBoardSize} 
                joistOrientation={sec.joistOrientation} 
                deckingOrientation={sec.deckingOrientation} 
              />
              <Joists positions={calcs.joists.positions} width={sec.width} depth={sec.depth} joistSize={materials.joistSize} joistOrientation={sec.joistOrientation} />
              <Beams beamPositions={calcs.beams.positions} width={sec.width} depth={sec.depth} beamConfig={materials.beamConfig} joistSize={materials.joistSize} joistOrientation={sec.joistOrientation} />
              <Posts posts={calcs.posts.posts} postSize={materials.postSize} joistSize={materials.joistSize} beamConfig={materials.beamConfig} />
              
              <Railings 
                railings={sec.railings} 
                width={sec.width} 
                depth={sec.depth} 
                height={sec.height} 
                species={materials.species}
                deckMaterial={materials.deckMaterial}
                lightingPreset={lightingPreset}
              />
              
              <Stairs 
                stairEdge={typeof sec.stairs === 'string' ? sec.stairs : (sec.stairs?.direction)} 
                stairCalcs={calcs.stairs} 
                width={sec.width} 
                depth={sec.depth} 
                species={materials.species}
                deckMaterial={materials.deckMaterial}
              />
              
              {sec.ledgerAttached && <HouseWall width={sec.width} height={sec.height} />}
            </group>
          );
        })}

        <GroundPlane lightingPreset={lightingPreset} />
        
        <gridHelper 
          args={[
            100, 
            100, 
            isNight ? '#111827' : (isLightTheme ? '#cbd5e1' : '#1a2a4a'), 
            isNight ? '#030712' : (isLightTheme ? '#e2e8f0' : '#111828')
          ]} 
          position={[0, -4.99, 0]} 
        />
      </Canvas>

      {/* Floating Preset Selector Controls */}
      <div className="viewport-overlay-controls" role="group" aria-label="Environment lighting presets">
        <button 
          className={`lighting-preset-btn lighting-preset-btn--daylight ${isDaylight ? 'lighting-preset-btn--active' : ''}`}
          onClick={() => setLightingPreset('daylight')}
          aria-label="Toggle Daylight Mode"
          title="Daylight Mode"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
          <span>Daylight</span>
        </button>
        
        <button 
          className={`lighting-preset-btn lighting-preset-btn--goldenHour ${isGoldenHour ? 'lighting-preset-btn--active' : ''}`}
          onClick={() => setLightingPreset('goldenHour')}
          aria-label="Toggle Golden Hour Mode"
          title="Golden Hour Mode"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v2M4.93 4.93l1.41 1.41M19.07 4.93l-1.41 1.41M2 12h2M20 12h2M12 18H2M22 18h-4M16 12a4 4 0 0 0-8 0"/>
          </svg>
          <span>Golden Hour</span>
        </button>
        
        <button 
          className={`lighting-preset-btn lighting-preset-btn--night ${isNight ? 'lighting-preset-btn--active' : ''}`}
          onClick={() => setLightingPreset('night')}
          aria-label="Toggle Night Mode"
          title="Night Mode"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
          <span>Night</span>
        </button>
      </div>
    </div>
  );
}
