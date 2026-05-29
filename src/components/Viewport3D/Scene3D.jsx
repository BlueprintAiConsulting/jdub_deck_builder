import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useDeckStore } from '../../store/deckStore';
import { WOOD_COLORS, DECK_MATERIAL_COLORS, DECK_COLOR_OPTIONS } from '../Materials/materialData';
import { LUMBER_ACTUAL, RAILING_RULES, STAIR_RULES } from '../../engine/spanTables';
import './Scene3D.css';
import { getSubObjectOffset } from '../../utils/polygonUtils';

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

  if (type === 'siding') {
    const numSlats = 16;
    const slatH = 512 / numSlats;
    const baseColor = new THREE.Color(colorHex);
    
    for (let i = 0; i < numSlats; i++) {
      const y = i * slatH;
      // Draw linear gradient shadow for lap siding
      const grad = ctx.createLinearGradient(0, y, 0, y + slatH);
      const colStart = baseColor.clone().multiplyScalar(1.05).getStyle();
      const colMid = baseColor.getStyle();
      const colEnd = baseColor.clone().multiplyScalar(0.85).getStyle();
      
      grad.addColorStop(0, colStart);
      grad.addColorStop(0.15, colMid);
      grad.addColorStop(0.85, colMid);
      grad.addColorStop(1.0, colEnd);
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, 512, slatH);
      
      // Bottom overlap shadow highlight line
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(0, y + slatH - 1.5, 512, 1.5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(0, y, 512, 0.5);
    }
  } else if (type === 'shingles') {
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 512, 512);
    
    const rowH = 32;
    const colW = 64;
    for (let r = 0; r < 16; r++) {
      const y = r * rowH;
      const offset = (r % 2) * (colW / 2);
      for (let c = -1; c < 9; c++) {
        const x = c * colW + offset;
        const factor = 1 - (Math.random() * 0.12 - 0.06);
        const shColor = new THREE.Color(colorHex).multiplyScalar(factor);
        
        ctx.fillStyle = shColor.getStyle();
        ctx.fillRect(x + 1, y + 1, colW - 2, rowH - 2);
        
        // Shadow lines
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y + rowH - 1, colW, 1);
        ctx.fillRect(x + colW - 1, y, 1, rowH);
      }
    }
  } else if (type === 'grass') {
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 512, 512);
    
    // Draw fine grass blades
    for (let i = 0; i < 18000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const len = Math.random() * 3 + 2;
      const angle = (Math.random() * 20 - 10) * Math.PI / 180;
      
      const greenVal = Math.floor(75 + Math.random() * 55);
      const redVal = Math.floor(40 + Math.random() * 25);
      ctx.strokeStyle = `rgb(${redVal}, ${greenVal}, 25)`;
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * Math.sin(angle), y - len * Math.cos(angle));
      ctx.stroke();
    }
  } else if (type === 'concrete') {
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 512, 512);
    
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const alpha = Math.random() * 0.08;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, y, Math.random() * 2 + 1, Math.random() * 2 + 1);
    }
  } else if (type === 'composite') {
    // Base fill
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 512, 512);
    
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
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }
    
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = 4; y < 512; y += 8) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }
  } else {
    // Base fill
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 512, 512);

    // Wood grain lines (including light/dark contrast lines)
    for (let y = 0; y < 512; y += Math.random() * 4 + 2) {
      const alpha = Math.random() * 0.05;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha * 0.4})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, y, 512, Math.random() * 2 + 0.5);
    }
    
    // Wave growth rings
    ctx.strokeStyle = 'rgba(0,0,0,0.035)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) {
      const yOffset = i * 75 - 50;
      ctx.beginPath();
      ctx.moveTo(0, yOffset);
      ctx.bezierCurveTo(128, yOffset + 30, 384, yOffset - 20, 512, yOffset + 10);
      ctx.stroke();
    }

    // Wood knot
    const knotX = 220;
    const knotY = 180;
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.strokeStyle = 'rgba(0,0,0,0.02)';
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

export function getProceduralBumpTexture(type) {
  const cacheKey = `bump-${type}`;
  if (textureCache[cacheKey]) {
    return textureCache[cacheKey];
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  if (type === 'wood') {
    for (let y = 0; y < 256; y += Math.random() * 4 + 2) {
      const isHigh = Math.random() > 0.5;
      ctx.fillStyle = isHigh ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, y, 256, Math.random() * 2 + 1);
    }
  } else if (type === 'composite') {
    for (let y = 0; y < 256; y += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      ctx.fillRect(0, y, 256, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(0, y + 2, 256, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
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

function DeckBoards({ vertices, secX, secY, species, deckMaterial, deckColor, deckBoardSize, joistOrientation, deckingOrientation, pictureFrame, dividerCount, boardsPerDivider, deckingFlipped, deckingLayout, deckBoardGap, width, depth }) {
  const getBoardColor = () => {
    const opts = DECK_COLOR_OPTIONS[deckMaterial] || [];
    const opt = opts.find(o => o.value === deckColor);
    return opt ? opt.color : (DECK_MATERIAL_COLORS[deckMaterial] || WOOD_COLORS[species] || '#c4a35a');
  };
  const color = getBoardColor();
  const { type } = getMaterialVisuals(deckMaterial, species);
  const texture = getProceduralTexture(color, type);
  const boardW = LUMBER_ACTUAL[deckBoardSize || '5/4x6']?.depth || 5.5;
  const boardH = LUMBER_ACTUAL[deckBoardSize || '5/4x6']?.width || 1.0;
  const gap = typeof deckBoardGap === 'number' ? deckBoardGap : 0.125;
  const boardSpacing = boardW + gap;

  const boards = useMemo(() => {
    if (!vertices || vertices.length === 0) return [];
    
    const localVertices = vertices.map(v => ({ x: v.x - secX, y: v.y - secY }));
    const joistOrient = joistOrientation || 'vertical';
    const deckingOpt = deckingOrientation || 'perpendicular';
    const pfCount = pictureFrame || 0;
    const isFlipped = deckingFlipped === true;

    const arr = [];
    
    // 1. Picture Frame Boards
    if (pfCount > 0) {
      for (let k = 0; k < pfCount; k++) {
        const insetMin = k * boardSpacing;
        const insetMax = (k + 1) * boardSpacing;
        const offset = k * boardSpacing + boardW / 2;

        // North
        arr.push({
          id: `frame-n-${k}`,
          posX: width / 2,
          posZ: offset,
          sizeX: width - 2 * insetMin,
          sizeZ: boardW,
          rotY: 0
        });
        // South
        arr.push({
          id: `frame-s-${k}`,
          posX: width / 2,
          posZ: depth - offset,
          sizeX: width - 2 * insetMin,
          sizeZ: boardW,
          rotY: 0
        });
        // West
        arr.push({
          id: `frame-w-${k}`,
          posX: offset,
          posZ: depth / 2,
          sizeX: boardW,
          sizeZ: depth - 2 * insetMax,
          rotY: 0
        });
        // East
        arr.push({
          id: `frame-e-${k}`,
          posX: width - offset,
          posZ: depth / 2,
          sizeX: boardW,
          sizeZ: depth - 2 * insetMax,
          rotY: 0
        });
      }
    }

    // 2. Inner Field Area
    const frameWidth = pfCount * boardSpacing;
    const insetVertices = [
      { x: frameWidth, y: frameWidth },
      { x: width - frameWidth, y: frameWidth },
      { x: width - frameWidth, y: depth - frameWidth },
      { x: frameWidth, y: depth - frameWidth }
    ];

    // Determine decking line direction
    const joistsVertical = (joistOrient !== 'horizontal');
    let runsVertical = joistsVertical ? (deckingOpt === 'parallel') : (deckingOpt !== 'parallel');
    if (isFlipped) {
      runsVertical = !runsVertical;
    }

    // Decide if divider is present
    const fieldW = width - 2 * frameWidth;
    const fieldD = depth - 2 * frameWidth;
    const span = runsVertical ? fieldD : fieldW;
    
    let dividerType = dividerCount !== undefined ? dividerCount : 'auto';
    let N = 0;
    if (dividerType === 'auto') {
      N = span > 240 ? 1 : 0;
    } else {
      N = Number(dividerType || 0);
    }

    const boardsPerDiv = boardsPerDivider || 1;
    const divWidth = boardsPerDiv * boardW + (boardsPerDiv > 1 ? gap : 0);

    // 3. Draw Divider Boards
    if (N > 0) {
      for (let k = 0; k < N; k++) {
        const divCenter = frameWidth + (span / (N + 1)) * (k + 1);
        if (runsVertical) {
          // Divider runs horizontal (E-W) centered at divCenter
          if (boardsPerDiv === 1) {
            arr.push({
              id: `div-${k}-0`,
              posX: width / 2,
              posZ: divCenter,
              sizeX: fieldW,
              sizeZ: boardW,
              rotY: 0
            });
          } else {
            // Double divider
            arr.push({
              id: `div-${k}-0`,
              posX: width / 2,
              posZ: divCenter - boardSpacing / 2,
              sizeX: fieldW,
              sizeZ: boardW,
              rotY: 0
            });
            arr.push({
              id: `div-${k}-1`,
              posX: width / 2,
              posZ: divCenter + boardSpacing / 2,
              sizeX: fieldW,
              sizeZ: boardW,
              rotY: 0
            });
          }
        } else {
          // Divider runs vertical (N-S) centered at divCenter
          if (boardsPerDiv === 1) {
            arr.push({
              id: `div-${k}-0`,
              posX: divCenter,
              posZ: depth / 2,
              sizeX: boardW,
              sizeZ: fieldD,
              rotY: 0
            });
          } else {
            // Double divider
            arr.push({
              id: `div-${k}-0`,
              posX: divCenter - boardSpacing / 2,
              posZ: depth / 2,
              sizeX: boardW,
              sizeZ: fieldD,
              rotY: 0
            });
            arr.push({
              id: `div-${k}-1`,
              posX: divCenter + boardSpacing / 2,
              posZ: depth / 2,
              sizeX: boardW,
              sizeZ: fieldD,
              rotY: 0
            });
          }
        }
      }
    }

    // 4. Generate Field Decking Boards
    if (deckingOpt === 'diagonal') {
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
          if (boardLength > 0.5) {
            const rotatedCenterX = (seg.startX + seg.endX) / 2;
            const rotatedCenterY = boardCenterY;
            const cosPos = Math.cos(theta);
            const sinPos = Math.sin(theta);
            const posX = rotatedCenterX * cosPos - rotatedCenterY * sinPos;
            const posZ = rotatedCenterX * sinPos + rotatedCenterY * cosPos;
            arr.push({
              id: `field-${idx}-${sIdx}`,
              posX,
              posZ,
              sizeX: boardLength,
              sizeZ: bw,
              rotY: -theta
            });
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
            // Apply divider splitting progressively
            let currentSegments = [seg];
            for (let k = 0; k < N; k++) {
              const divCenter = frameWidth + (span / (N + 1)) * (k + 1);
              const divMinY = divCenter - divWidth / 2;
              const divMaxY = divCenter + divWidth / 2;

              const nextSegments = [];
              currentSegments.forEach((s) => {
                if (s.endY <= divMinY) {
                  nextSegments.push(s);
                } else if (s.startY >= divMaxY) {
                  nextSegments.push(s);
                } else {
                  if (divMinY - s.startY > 0.5) nextSegments.push({ startY: s.startY, endY: divMinY });
                  if (s.endY - divMaxY > 0.5) nextSegments.push({ startY: divMaxY, endY: s.endY });
                }
              });
              currentSegments = nextSegments;
            }

            currentSegments.forEach((sub, subIdx) => {
              const boardHeight = sub.endY - sub.startY;
              if (boardHeight > 0.5) {
                arr.push({
                  id: `field-${idx}-${sIdx}-${subIdx}`,
                  posX: boardCenterX,
                  posZ: sub.startY + boardHeight / 2,
                  sizeX: bw,
                  sizeZ: boardHeight,
                  rotY: 0
                });
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
            // Apply divider splitting progressively
            let currentSegments = [seg];
            for (let k = 0; k < N; k++) {
              const divCenter = frameWidth + (span / (N + 1)) * (k + 1);
              const divMinX = divCenter - divWidth / 2;
              const divMaxX = divCenter + divWidth / 2;

              const nextSegments = [];
              currentSegments.forEach((s) => {
                if (s.endX <= divMinX) {
                  nextSegments.push(s);
                } else if (s.startX >= divMaxX) {
                  nextSegments.push(s);
                } else {
                  if (divMinX - s.startX > 0.5) nextSegments.push({ startX: s.startX, endX: divMinX });
                  if (s.endX - divMaxX > 0.5) nextSegments.push({ startX: divMaxX, endX: s.endX });
                }
              });
              currentSegments = nextSegments;
            }

            currentSegments.forEach((sub, subIdx) => {
              const boardWidth = sub.endX - sub.startX;
              if (boardWidth > 0.5) {
                arr.push({
                  id: `field-${idx}-${sIdx}-${subIdx}`,
                  posX: sub.startX + boardWidth / 2,
                  posZ: boardCenterY,
                  sizeX: boardWidth,
                  sizeZ: bw,
                  rotY: 0
                });
              }
            });
          });
          y += boardSpacing;
          idx++;
        }
      }
    }
    return arr;
  }, [vertices, secX, secY, boardW, joistOrientation, deckingOrientation, pictureFrame, dividerCount, boardsPerDivider, deckingFlipped, deckingLayout, deckBoardGap, width, depth]);

  const bumpTexture = getProceduralBumpTexture(type);

  return (
    <group>
      {boards.map(({ id, posX, posZ, sizeX, sizeZ, rotY }) => (
        <mesh key={`board-${id}`} position={[posX * IN, boardH / 2 * IN, posZ * IN]} rotation={[0, rotY, 0]} castShadow receiveShadow>
          <boxGeometry args={[sizeX * IN, boardH * IN, sizeZ * IN]} />
          <meshStandardMaterial 
            map={texture} 
            bumpMap={bumpTexture}
            bumpScale={0.012}
            roughness={type === 'composite' ? 0.85 : 0.6} 
            metalness={0.02} 
          />
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

function Blocking({ blocking, joistSize }) {
  const actual = LUMBER_ACTUAL[joistSize] || { width: 1.5, depth: 7.25 };
  const woodTexture = getProceduralTexture('#5a4d3b', 'wood');

  if (!blocking || !blocking.enabled || !blocking.segments) return null;

  return (
    <group>
      {blocking.segments.map((seg, i) => {
        const dx = seg.x2 - seg.x1;
        const dz = seg.y2 - seg.y1;
        const len = Math.sqrt(dx * dx + dz * dz);
        const posX = (seg.x1 + seg.x2) / 2;
        const posZ = (seg.y1 + seg.y2) / 2;

        const isHorizontal = Math.abs(dz) > Math.abs(dx);
        const sizeX = isHorizontal ? actual.width : len;
        const sizeZ = isHorizontal ? len : actual.width;

        return (
          <mesh 
            key={`block-${i}`} 
            position={[posX * IN, -actual.depth / 2 * IN, posZ * IN]} 
            castShadow 
            receiveShadow
          >
            <boxGeometry args={[sizeX * IN, actual.depth * IN, sizeZ * IN]} />
            <meshStandardMaterial map={woodTexture} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

function Footers({ beamPositions, width, depth, joistOrientation, footerWidth, height }) {
  const isHorizontal = joistOrientation === 'horizontal';
  const fWidth = footerWidth || 12;
  const fDepth = 12; // 12 inches deep concrete grade beam
  const fColor = '#8a8a8a';
  const yPos = -(height + fDepth / 2);
  
  return (
    <group>
      {beamPositions.map((coordIn, i) => {
        const posX = isHorizontal ? coordIn * IN : (width / 2) * IN;
        const posZ = isHorizontal ? (depth / 2) * IN : coordIn * IN;
        const sizeX = isHorizontal ? fWidth * IN : width * IN;
        const sizeZ = isHorizontal ? depth * IN : fWidth * IN;
        
        return (
          <mesh 
            key={`footer-${i}`} 
            position={[posX, yPos * IN, posZ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[sizeX, fDepth * IN, sizeZ]} />
            <meshStandardMaterial color={fColor} roughness={0.9} />
          </mesh>
        );
      })}
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
        const postHeight = Math.max(0.1, post.height + topOfPost);
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

function Railings({ railings, width, depth, height, species, deckMaterial }) {
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
                      color="#2d3436" 
                      emissive="#000000"
                      emissiveIntensity={0}
                      roughness={0.2} 
                      metalness={0.8}
                    />
                  </mesh>
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

function Stairs({ section, stairEdge, stairCalcs, width, depth, species, deckMaterial }) {
  if (!stairEdge || !stairCalcs || !section) return null;

  const stairWidth = stairCalcs.width || STAIR_RULES.maxStairWidth;
  const treadDepth = stairCalcs.treadDepth || STAIR_RULES.idealTreadDepth;
  const treadThickness = 1.0;
  const deckTopY = (LUMBER_ACTUAL['5/4x6']?.width || 1.0);

  const safeNumTreads = Math.max(1, stairCalcs.numTreads || 1);
  const safeTreadDepth = treadDepth || 10;
  const safeTotalRun = Math.max(1, stairCalcs.totalRun || (safeNumTreads * safeTreadDepth));
  const safeRiserHeight = stairCalcs.riserHeight || 7.25;
  const safeNumRisers = stairCalcs.numRisers || (safeNumTreads + 1);

  const { color, type } = getMaterialVisuals(deckMaterial, species);
  const texture = getProceduralTexture(color, type);
  const woodTexture = getProceduralTexture('#5a4d3b', 'wood'); // wood texture for stringers

  // Compute rotation around Y axis based on edge direction
  let rotY = 0;
  if (stairEdge === 's') rotY = 0;
  else if (stairEdge === 'n') rotY = Math.PI;
  else if (stairEdge === 'e') rotY = -Math.PI / 2;
  else if (stairEdge === 'w') rotY = Math.PI / 2;

  // Retrieve current visual offset of the stairs
  const offset = getSubObjectOffset(section, 'stairs');
  let centerX, centerZ;
  if (stairEdge === 's' || stairEdge === 'n') {
    centerX = offset + stairWidth / 2;
    centerZ = stairEdge === 's' ? depth : 0;
  } else { // 'e' or 'w'
    centerX = stairEdge === 'e' ? width : 0;
    centerZ = offset + stairWidth / 2;
  }

  // Treads local coordinates (X is centered, Z runs forward 0 -> totalRun)
  const treads = [];
  for (let i = 0; i < safeNumTreads; i++) {
    treads.push({
      x: 0,
      y: deckTopY - (i + 1) * safeRiserHeight,
      z: (i + 0.5) * safeTreadDepth,
    });
  }

  // Risers local coordinates (X is centered, Z is at the back of each step)
  const risers = [];
  for (let i = 0; i < safeNumTreads; i++) {
    risers.push({
      x: 0,
      y: deckTopY - (i + 0.5) * safeRiserHeight,
      z: i * safeTreadDepth,
    });
  }

  // Side stringers flanking the treads
  const totalRise = safeNumRisers * safeRiserHeight;
  const stringerLength = Math.sqrt(totalRise ** 2 + safeTotalRun ** 2);
  const theta = Math.atan2(totalRise, safeTotalRun);
  const stringerDepth = 11.25; // 2x12 lumber depth

  return (
    <group position={[centerX * IN, 0, centerZ * IN]} rotation={[0, rotY, 0]}>
      {/* Treads */}
      {treads.map((t, i) => (
        <mesh key={`tread-${i}`} position={[t.x * IN, t.y * IN, t.z * IN]} castShadow receiveShadow>
          <boxGeometry args={[stairWidth * IN, treadThickness * IN, treadDepth * IN]} />
          <meshStandardMaterial map={texture} roughness={0.7} />
        </mesh>
      ))}

      {/* Risers */}
      {risers.map((r, i) => (
        <mesh key={`riser-${i}`} position={[r.x * IN, r.y * IN, r.z * IN]} castShadow receiveShadow>
          <boxGeometry args={[stairWidth * IN, safeRiserHeight * IN, 0.75 * IN]} />
          <meshStandardMaterial map={texture} roughness={0.8} />
        </mesh>
      ))}

      {/* Left Stringer (flanking baseboard) */}
      <mesh 
        position={[(-stairWidth / 2 - 0.75) * IN, (deckTopY - totalRise / 2) * IN, (safeTotalRun / 2) * IN]} 
        rotation={[theta, 0, 0]} 
        castShadow 
        receiveShadow
      >
        <boxGeometry args={[1.5 * IN, stringerDepth * IN, stringerLength * IN]} />
        <meshStandardMaterial map={woodTexture} roughness={0.8} />
      </mesh>

      {/* Right Stringer (flanking baseboard) */}
      <mesh 
        position={[(stairWidth / 2 + 0.75) * IN, (deckTopY - totalRise / 2) * IN, (safeTotalRun / 2) * IN]} 
        rotation={[theta, 0, 0]} 
        castShadow 
        receiveShadow
      >
        <boxGeometry args={[1.5 * IN, stringerDepth * IN, stringerLength * IN]} />
        <meshStandardMaterial map={woodTexture} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Ramp({ section, rampEdge, rampCalcs, width, depth, species, deckMaterial, postSize, height: rawHeight }) {
  if (!rampEdge || !rampCalcs || !section) return null;

  const safeHeight = typeof rawHeight === 'number' && !isNaN(rawHeight) ? rawHeight : 36;
  const safeRampWidth = Math.max(12, typeof rampCalcs.width === 'number' && !isNaN(rampCalcs.width) ? rampCalcs.width : 36);
  const safeRun = Math.max(12, typeof rampCalcs.run === 'number' && !isNaN(rampCalcs.run) ? rampCalcs.run : 12);
  const safeRise = Math.max(0, typeof rampCalcs.totalRise === 'number' && !isNaN(rampCalcs.totalRise) ? rampCalcs.totalRise : 0);

  const rampWidth = safeRampWidth;
  const run = safeRun;
  const totalRise = safeRise;
  const height = safeHeight;

  const treadThickness = 1.0;
  const deckTopY = (LUMBER_ACTUAL['5/4x6']?.width || 1.0);

  const { color, type } = getMaterialVisuals(deckMaterial, species);
  const texture = getProceduralTexture(color, type);
  
  // Textures for framing/posts
  const woodTexture = getProceduralTexture('#5a4d3b', 'wood');
  const postTexture = getProceduralTexture('#504230', 'wood');

  const offset = getSubObjectOffset(section, 'ramp');
  let startX, startZ, rotY;
  if (rampEdge === 's') {
    startX = offset;
    startZ = depth;
    rotY = 0;
  } else if (rampEdge === 'n') {
    startX = offset;
    startZ = 0;
    rotY = Math.PI;
  } else if (rampEdge === 'e') {
    startX = width;
    startZ = offset;
    rotY = -Math.PI / 2;
  } else {
    startX = 0;
    startZ = offset;
    rotY = Math.PI / 2;
  }

  // Position at top-center of the ramp (at the deck edge)
  const groupX = (rampEdge === 's' || rampEdge === 'n') ? startX + rampWidth / 2 : startX;
  const groupZ = (rampEdge === 'e' || rampEdge === 'w') ? startZ + rampWidth / 2 : startZ;

  const postActualWidth = postSize === '6x6' ? 5.5 : 3.5;
  const stringerDepth = 11.25; // 2x12

  const N = rampCalcs.intermediateLandings || 0;
  const numSegments = N + 1;
  const segRun = run / numSegments;
  const segRise = totalRise / numSegments;
  const segSurfaceLength = Math.sqrt(segRun ** 2 + segRise ** 2);
  const theta = Math.atan2(segRise, segRun);
  const landingRun = 60;
  const landingW = Math.max(60, rampWidth);

  const elements = [];
  let currentZ = 0;
  let currentY = 0;

  for (let j = 0; j < 2 * numSegments - 1; j++) {
    const isLanding = j % 2 === 1;

    if (!isLanding) {
      const nextZ = currentZ + segRun;
      const nextY = currentY - segRise;
      const z_mid = (currentZ + nextZ) / 2;
      const y_mid = (currentY + nextY) / 2;

      // 1. Decking surface and 2x12 Sloped Stringers
      elements.push(
        <group key={`ramp-seg-${j}`} position={[0, y_mid * IN, z_mid * IN]} rotation={[theta, 0, 0]}>
          <mesh castShadow receiveShadow userData={{ type: 'ramp-decking' }}>
            <boxGeometry args={[rampWidth * IN, treadThickness * IN, segSurfaceLength * IN]} />
            <meshStandardMaterial map={texture} roughness={0.7} />
          </mesh>
          {(() => {
            const numStringers = Math.max(3, Math.ceil(rampWidth / 16) + 1);
            const stringerElements = [];
            for (let s = 0; s < numStringers; s++) {
              let x_pos = 0;
              if (numStringers > 1) {
                x_pos = -rampWidth / 2 + 0.75 + s * (rampWidth - 1.5) / (numStringers - 1);
              }
              stringerElements.push(
                <mesh key={`stringer-${s}`} position={[x_pos * IN, -(treadThickness + stringerDepth / 2) * IN, 0]} castShadow receiveShadow>
                  <boxGeometry args={[1.5 * IN, stringerDepth * IN, segSurfaceLength * IN]} />
                  <meshStandardMaterial map={woodTexture} roughness={0.8} />
                </mesh>
              );
            }
            return stringerElements;
          })()}
        </group>
      );

      // 2. Vertical Support Posts under stringers (one pair at midpoint)
      const y_top_in = y_mid - treadThickness - stringerDepth;
      const y_bottom_in = -height;
      const postHeight_in = Math.max(12, y_top_in - y_bottom_in);
      const y_post_center_in = y_top_in - postHeight_in / 2;
      
      const x_left = -rampWidth / 2 + postActualWidth / 2;
      const x_right = rampWidth / 2 - postActualWidth / 2;

      elements.push(
        <group key={`ramp-seg-posts-${j}`}>
          <mesh position={[x_left * IN, y_post_center_in * IN, z_mid * IN]} castShadow receiveShadow>
            <boxGeometry args={[postActualWidth * IN, postHeight_in * IN, postActualWidth * IN]} />
            <meshStandardMaterial map={postTexture} roughness={0.85} />
          </mesh>
          <mesh position={[x_right * IN, y_post_center_in * IN, z_mid * IN]} castShadow receiveShadow>
            <boxGeometry args={[postActualWidth * IN, postHeight_in * IN, postActualWidth * IN]} />
            <meshStandardMaterial map={postTexture} roughness={0.85} />
          </mesh>
        </group>
      );

      currentZ = nextZ;
      currentY = nextY;
    } else {
      const nextZ = currentZ + landingRun;
      const nextY = currentY;
      const z_mid = (currentZ + nextZ) / 2;
      const y_mid = currentY;

      // 1. Landing Decking Surface
      elements.push(
        <mesh key={`ramp-land-${j}`} position={[0, (y_mid - treadThickness / 2) * IN, z_mid * IN]} castShadow receiveShadow userData={{ type: 'ramp-decking' }}>
          <boxGeometry args={[landingW * IN, treadThickness * IN, landingRun * IN]} />
          <meshStandardMaterial map={texture} roughness={0.7} />
        </mesh>
      );

      // 2. Landing Framing (2x12 Joists)
      const framingElements = [];
      framingElements.push(
        <mesh key={`land-rim-l-${j}`} position={[-landingW / 2 + 0.75 * IN, (y_mid - treadThickness - stringerDepth / 2) * IN, z_mid * IN]} castShadow receiveShadow>
          <boxGeometry args={[1.5 * IN, stringerDepth * IN, landingRun * IN]} />
          <meshStandardMaterial map={woodTexture} roughness={0.8} />
        </mesh>,
        <mesh key={`land-rim-r-${j}`} position={[(landingW / 2 - 0.75) * IN, (y_mid - treadThickness - stringerDepth / 2) * IN, z_mid * IN]} castShadow receiveShadow>
          <boxGeometry args={[1.5 * IN, stringerDepth * IN, landingRun * IN]} />
          <meshStandardMaterial map={woodTexture} roughness={0.8} />
        </mesh>
      );

      framingElements.push(
        <mesh key={`land-rim-f-${j}`} position={[0, (y_mid - treadThickness - stringerDepth / 2) * IN, (currentZ + 0.75) * IN]} castShadow receiveShadow>
          <boxGeometry args={[(landingW - 3) * IN, stringerDepth * IN, 1.5 * IN]} />
          <meshStandardMaterial map={woodTexture} roughness={0.8} />
        </mesh>,
        <mesh key={`land-rim-b-${j}`} position={[0, (y_mid - treadThickness - stringerDepth / 2) * IN, (nextZ - 0.75) * IN]} castShadow receiveShadow>
          <boxGeometry args={[(landingW - 3) * IN, stringerDepth * IN, 1.5 * IN]} />
          <meshStandardMaterial map={woodTexture} roughness={0.8} />
        </mesh>
      );

      const innerW = landingW - 3;
      const numIntJoists = Math.max(0, Math.ceil(innerW / 16) - 1);
      for (let s = 0; s < numIntJoists; s++) {
        const x_pos = -landingW / 2 + 1.5 + (s + 1) * innerW / (numIntJoists + 1);
        framingElements.push(
          <mesh key={`land-int-joist-${s}-${j}`} position={[x_pos * IN, (y_mid - treadThickness - stringerDepth / 2) * IN, z_mid * IN]} castShadow receiveShadow>
            <boxGeometry args={[1.5 * IN, stringerDepth * IN, (landingRun - 3) * IN]} />
            <meshStandardMaterial map={woodTexture} roughness={0.8} />
          </mesh>
        );
      }

      elements.push(<group key={`ramp-land-framing-${j}`}>{framingElements}</group>);

      // 3. Support Posts (4 corner posts)
      const y_top_in = y_mid - treadThickness - stringerDepth;
      const y_bottom_in = -height;
      const postHeight_in = Math.max(12, y_top_in - y_bottom_in);
      const y_post_center_in = y_top_in - postHeight_in / 2;

      const x_left = -landingW / 2 + postActualWidth / 2;
      const x_right = landingW / 2 - postActualWidth / 2;
      const z_front = currentZ + postActualWidth / 2;
      const z_back = nextZ - postActualWidth / 2;

      elements.push(
        <group key={`ramp-land-posts-${j}`}>
          <mesh position={[x_left * IN, y_post_center_in * IN, z_front * IN]} castShadow receiveShadow>
            <boxGeometry args={[postActualWidth * IN, postHeight_in * IN, postActualWidth * IN]} />
            <meshStandardMaterial map={postTexture} roughness={0.85} />
          </mesh>
          <mesh position={[x_right * IN, y_post_center_in * IN, z_front * IN]} castShadow receiveShadow>
            <boxGeometry args={[postActualWidth * IN, postHeight_in * IN, postActualWidth * IN]} />
            <meshStandardMaterial map={postTexture} roughness={0.85} />
          </mesh>
          <mesh position={[x_left * IN, y_post_center_in * IN, z_back * IN]} castShadow receiveShadow>
            <boxGeometry args={[postActualWidth * IN, postHeight_in * IN, postActualWidth * IN]} />
            <meshStandardMaterial map={postTexture} roughness={0.85} />
          </mesh>
          <mesh position={[x_right * IN, y_post_center_in * IN, z_back * IN]} castShadow receiveShadow>
            <boxGeometry args={[postActualWidth * IN, postHeight_in * IN, postActualWidth * IN]} />
            <meshStandardMaterial map={postTexture} roughness={0.85} />
          </mesh>
        </group>
      );

      currentZ = nextZ;
      currentY = nextY;
    }
  }

  return (
    <group position={[groupX * IN, deckTopY * IN, groupZ * IN]} rotation={[0, rotY, 0]}>
      {elements}
    </group>
  );
}

function House({ width, height }) {
  const wallHeightAboveDeck = 96; // 8 feet
  const totalWallHeight = height + wallHeightAboveDeck;
  const wallThick = 6;
  
  const sidingTexture = getProceduralTexture('#cbd5e1', 'siding');
  const shingleTexture = getProceduralTexture('#2f3640', 'shingles');
  const concreteTexture = getProceduralTexture('#b2bec3', 'concrete');
  
  // Apply texture wrap settings
  sidingTexture.repeat.set(1.5, totalWallHeight / 64);
  shingleTexture.repeat.set(2, 1);
  
  return (
    <group position={[width / 2 * IN, 0, 0]}>
      {/* 1. Main Siding Wall */}
      <mesh position={[0, (wallHeightAboveDeck - height) / 2 * IN, -wallThick / 2 * IN]} castShadow receiveShadow>
        <boxGeometry args={[(width + 36) * IN, totalWallHeight * IN, wallThick * IN]} />
        <meshStandardMaterial map={sidingTexture} roughness={0.8} />
      </mesh>

      {/* 2. Concrete Foundation Base (below the deck floor level) */}
      <mesh position={[0, -height / 2 * IN, -(wallThick - 0.5) / 2 * IN]} castShadow receiveShadow>
        <boxGeometry args={[(width + 36) * IN, height * IN, (wallThick - 0.5) * IN]} />
        <meshStandardMaterial map={concreteTexture} roughness={0.9} />
      </mesh>

      {/* 3. Vertical White Corner Trim */}
      <mesh position={[-(width + 36.5) / 2 * IN, (wallHeightAboveDeck - height) / 2 * IN, -2.5 * IN]} castShadow>
        <boxGeometry args={[4 * IN, totalWallHeight * IN, 4.5 * IN]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
      <mesh position={[(width + 36.5) / 2 * IN, (wallHeightAboveDeck - height) / 2 * IN, -2.5 * IN]} castShadow>
        <boxGeometry args={[4 * IN, totalWallHeight * IN, 4.5 * IN]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>

      {/* 4. Sliding Glass Patio Door (Centered at deck level) */}
      <group position={[0, 42 * IN, 0.1 * IN]}>
        <mesh castShadow>
          <boxGeometry args={[74 * IN, 82 * IN, 3 * IN]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        <mesh position={[-16 * IN, 0, 0.5 * IN]}>
          <boxGeometry args={[32 * IN, 76 * IN, 0.5 * IN]} />
          <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
        </mesh>
        <mesh position={[16 * IN, 0, 0.2 * IN]}>
          <boxGeometry args={[32 * IN, 76 * IN, 0.5 * IN]} />
          <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
        </mesh>
        {/* White outline highlights */}
        <mesh position={[-16 * IN, 0, 0.8 * IN]}>
          <boxGeometry args={[32 * IN, 76 * IN, 0.1 * IN]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} wireframe={true} />
        </mesh>
        <mesh position={[16 * IN, 0, 0.5 * IN]}>
          <boxGeometry args={[32 * IN, 76 * IN, 0.1 * IN]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} wireframe={true} />
        </mesh>
      </group>

      {/* 5. Flanking Windows (Left and Right of the Door) */}
      {width > 120 && (
        <>
          <group position={[-Math.max(48, width / 3.2) * IN, 48 * IN, 0.1 * IN]}>
            <mesh castShadow>
              <boxGeometry args={[38 * IN, 54 * IN, 2.5 * IN]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.4 * IN]}>
              <boxGeometry args={[32 * IN, 48 * IN, 0.5 * IN]} />
              <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
            </mesh>
            <mesh position={[0, 0, 0.7 * IN]}>
              <boxGeometry args={[32 * IN, 2 * IN, 0.2 * IN]} />
              <meshStandardMaterial color="#ffffff" roughness={0.4} />
            </mesh>
          </group>

          <group position={[Math.max(48, width / 3.2) * IN, 48 * IN, 0.1 * IN]}>
            <mesh castShadow>
              <boxGeometry args={[38 * IN, 54 * IN, 2.5 * IN]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.4 * IN]}>
              <boxGeometry args={[32 * IN, 48 * IN, 0.5 * IN]} />
              <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
            </mesh>
            <mesh position={[0, 0, 0.7 * IN]}>
              <boxGeometry args={[32 * IN, 2 * IN, 0.2 * IN]} />
              <meshStandardMaterial color="#ffffff" roughness={0.4} />
            </mesh>
          </group>
        </>
      )}

      {/* 6. Gabled Roof Overhang (above the wall, Y = wallHeightAboveDeck) */}
      <group position={[0, wallHeightAboveDeck * IN, 0]}>
        <mesh position={[0, 12 * IN, -30 * IN]} rotation={[-18 * Math.PI / 180, 0, 0]} castShadow>
          <boxGeometry args={[(width + 42) * IN, 1 * IN, 84 * IN]} />
          <meshStandardMaterial map={shingleTexture} roughness={0.95} />
        </mesh>
        <mesh position={[0, -0.5 * IN, 6 * IN]} castShadow>
          <boxGeometry args={[(width + 40) * IN, 1 * IN, 12 * IN]} />
          <meshStandardMaterial color="#ffffff" roughness={0.6} />
        </mesh>
        <mesh position={[0, -1.5 * IN, 12.2 * IN]} castShadow>
          <boxGeometry args={[(width + 40.5) * IN, 4 * IN, 0.5 * IN]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function GroundPlane({ heightAxis }) {
  const theme = useDeckStore((s) => s.theme);
  const isLightTheme = theme === 'light';

  const groundColor = isLightTheme ? '#2d5a27' : '#173614';
  const grassTexture = getProceduralTexture(groundColor, 'grass');
  grassTexture.repeat.set(24, 24);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial 
        map={grassTexture}
        roughness={1.0} 
        transparent={heightAxis < 0}
        opacity={heightAxis < 0 ? 0.3 : 1.0}
      />
    </mesh>
  );
}

/* ── Camera Controller Helper Component ── */
function CameraController({ viewTrigger, viewType, bounds, controlsRef, onViewComplete }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!viewType || !viewTrigger) return;

    const cx = bounds.cx * IN;
    const cz = bounds.cz * IN;
    const cy = 0;
    const size = Math.max(bounds.w, bounds.d) * IN;
    const dist = Math.max(15, size * 1.5);

    const controls = controlsRef.current;
    
    let targetPos = [cx, cy, cz];
    let camPos = [camera.position.x, camera.position.y, camera.position.z];

    if (viewType === 'iso') {
      camPos = [cx + dist * 0.8, cy + dist * 0.8, cz + dist * 0.8];
    } else if (viewType === 'top') {
      camPos = [cx, cy + dist * 1.2, cz + 0.001];
    } else if (viewType === 'front') {
      camPos = [cx, cy + dist * 0.2, cz + dist];
    } else if (viewType === 'side') {
      camPos = [cx + dist, cy + dist * 0.2, cz];
    } else if (viewType === 'reset') {
      camPos = [
        (bounds.cx + bounds.w) * IN * 1.2,
        bounds.h * IN * 3,
        (bounds.cz + bounds.d) * IN * 1.2,
      ];
    }

    camera.position.set(...camPos);
    if (controls) {
      controls.target.set(...targetPos);
      controls.update();
    }
    camera.lookAt(...targetPos);

    onViewComplete();
  }, [viewTrigger, viewType, bounds, controlsRef, onViewComplete, camera]);

  return null;
}

export default function Scene3D() {
  const theme = useDeckStore((s) => s.theme);
  const sections = useDeckStore((s) => s.sections);
  const sectionCalcs = useDeckStore((s) => s.sectionCalcs);
  const materials = useDeckStore((s) => s.materials);
  const visibleLayers = useDeckStore((s) => s.visibleLayers3d || { decking: true, framing: true, foundation: true, accessories: true });



  // Preset lighting values
  const ambientColor = '#ffffff';
  const ambientIntensity = 0.45;
  
  const sunPosition = [20, 35, 20];
  const sunColor = '#ffffff';
  const sunIntensity = 1.2;
  
  const fillPosition = [-10, 15, -10];
  const fillColor = '#a9c1e6';
  const fillIntensity = 0.3;
  
  const hemiColor = '#aaddff';
  const hemiGroundColor = '#332200';
  const hemiIntensity = 0.2;
  
  const isLightTheme = theme === 'light';
  const bgColor = isLightTheme ? '#f1f5f9' : '#0a1628';
  const fogNear = 40;
  const fogFar = 120;
  
  const [viewType, setViewType] = useState(null);
  const [viewTrigger, setViewTrigger] = useState(0);
  const [heightAxis, setHeightAxis] = useState(0);
  const controlsRef = useRef();

  const triggerView = (type) => {
    setViewType(type);
    setViewTrigger(prev => prev + 1);
  };

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

  const shadowCamSize = useMemo(() => {
    return Math.max(20, Math.max(bounds.w, bounds.d) * IN * 1.2);
  }, [bounds]);

  return (
    <div className="scene3d-container">
      <Canvas shadows onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFSoftShadowMap; }}>
        <PerspectiveCamera
          makeDefault
          position={[
            (bounds.cx + bounds.w) * IN * 1.2,
            bounds.h * IN * 3,
            (bounds.cz + bounds.d) * IN * 1.2,
          ]}
          fov={50}
        />
        <OrbitControls 
          ref={controlsRef} 
          target={cameraTarget} 
          enableDamping 
          dampingFactor={0.1} 
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
          }}
        />
        
        <CameraController
          viewTrigger={viewTrigger}
          viewType={viewType}
          bounds={bounds}
          controlsRef={controlsRef}
          onViewComplete={() => setViewType(null)}
        />

        <ambientLight intensity={ambientIntensity} color={ambientColor} />
        
        <directionalLight 
          position={sunPosition} 
          intensity={sunIntensity} 
          color={sunColor} 
          castShadow 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048} 
          shadow-bias={-0.0004}
          shadow-camera-left={-shadowCamSize}
          shadow-camera-right={shadowCamSize}
          shadow-camera-top={shadowCamSize}
          shadow-camera-bottom={-shadowCamSize}
          shadow-camera-near={0.1}
          shadow-camera-far={150}
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
              {visibleLayers.decking && (
                <DeckBoards 
                  vertices={sec.vertices} 
                  secX={sec.x} 
                  secY={sec.y} 
                  species={materials.species} 
                  deckMaterial={materials.deckMaterial} 
                  deckColor={materials.deckColor}
                  deckBoardSize={materials.deckBoardSize} 
                  joistOrientation={sec.joistOrientation} 
                  deckingOrientation={sec.deckingOrientation} 
                  pictureFrame={sec.pictureFrame}
                  dividerCount={sec.dividerCount}
                  boardsPerDivider={sec.boardsPerDivider}
                  deckingFlipped={sec.deckingFlipped}
                  deckingLayout={sec.deckingLayout}
                  deckBoardGap={sec.deckBoardGap}
                  width={sec.width}
                  depth={sec.depth}
                />
              )}
              {visibleLayers.framing && (
                <>
                  <Joists positions={calcs.joists.positions} width={sec.width} depth={sec.depth} joistSize={materials.joistSize} joistOrientation={sec.joistOrientation} />
                  <Blocking blocking={calcs.joists.blocking} joistSize={materials.joistSize} />
                  <Beams beamPositions={calcs.beams.positions} width={sec.width} depth={sec.depth} beamConfig={materials.beamConfig} joistSize={materials.joistSize} joistOrientation={sec.joistOrientation} />
                </>
              )}
              {visibleLayers.foundation && (
                <>
                  <Posts posts={calcs.posts.posts} postSize={materials.postSize} joistSize={materials.joistSize} beamConfig={materials.beamConfig} />
                  {heightAxis < 0 && (
                    <Footers 
                      beamPositions={calcs.beams.positions} 
                      width={sec.width} 
                      depth={sec.depth} 
                      joistOrientation={sec.joistOrientation} 
                      footerWidth={sec.footerWidth}
                      height={sec.height}
                    />
                  )}
                </>
              )}
              {visibleLayers.accessories && (
                <>
                  <Railings 
                    railings={sec.railings} 
                    width={sec.width} 
                    depth={sec.depth} 
                    height={sec.height} 
                    species={materials.species}
                    deckMaterial={materials.deckMaterial}
                  />
                  <Stairs 
                    section={sec}
                    stairEdge={typeof sec.stairs === 'string' ? sec.stairs : (sec.stairs?.direction)} 
                    stairCalcs={calcs.stairs} 
                    width={sec.width} 
                    depth={sec.depth} 
                    species={materials.species}
                    deckMaterial={materials.deckMaterial}
                  />
                  <Ramp 
                    section={sec}
                    rampEdge={typeof sec.ramp === 'string' ? sec.ramp : (sec.ramp?.direction)} 
                    rampCalcs={calcs.ramp} 
                    width={sec.width} 
                    depth={sec.depth} 
                    species={materials.species} 
                    deckMaterial={materials.deckMaterial} 
                    postSize={materials.postSize}
                    height={sec.height}
                  />
                </>
              )}
              {sec.ledgerAttached && <House width={sec.width} height={sec.height} />}
            </group>
          );
        })}

        <GroundPlane heightAxis={heightAxis} />
        
        <gridHelper 
          args={[
            100, 
            100, 
            isLightTheme ? '#cbd5e1' : '#1a2a4a', 
            isLightTheme ? '#e2e8f0' : '#111828'
          ]} 
          position={[0, 0.01, 0]} 
        />
      </Canvas>


      {/* Floating 3D Viewport Controls HUD */}
      <div className="viewport-3d-hud" id="viewport-3d-hud">
        <button className="btn btn--sm btn--ghost" onClick={() => triggerView('iso')} title="Isometric 3D View">ISO</button>
        <button className="btn btn--sm btn--ghost" onClick={() => triggerView('top')} title="Top 2D Plan View">Top</button>
        <button className="btn btn--sm btn--ghost" onClick={() => triggerView('front')} title="Front Elevation View">Front</button>
        <button className="btn btn--sm btn--ghost" onClick={() => triggerView('side')} title="Side Elevation View">Side</button>
        <div style={{ width: '1px', height: '14px', background: 'var(--border-default)', margin: '0 4px' }} />
        <button className="btn btn--sm btn--ghost btn--icon" onClick={() => triggerView('reset')} title="Reset Camera" style={{ minWidth: '24px', minHeight: '24px', padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <div style={{ width: '1px', height: '14px', background: 'var(--border-default)', margin: '0 4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', padding: '0 4px' }}>
          <span style={{ fontWeight: 600 }}>Height Axis:</span>
          <input
            id="height-axis-slider"
            type="range"
            min="-60"
            max="0"
            step="1"
            value={heightAxis}
            onChange={(e) => setHeightAxis(Number(e.target.value))}
            style={{ width: '80px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', minWidth: '36px', textAlign: 'right' }}>
            {heightAxis === 0 ? 'Above' : `${heightAxis}"`}
          </span>
        </div>
      </div>
    </div>
  );
}
