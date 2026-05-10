import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useDeckStore } from '../../store/deckStore';
import { WOOD_COLORS } from '../Materials/materialData';
import { LUMBER_ACTUAL, RAILING_RULES, STAIR_RULES } from '../../engine/spanTables';

const IN = 1 / 12; // inches to scene units (feet)

function DeckBoards({ width, depth, species, deckBoardSize }) {
  const color = WOOD_COLORS[species] || '#c4a35a';
  const boardW = LUMBER_ACTUAL[deckBoardSize]?.depth || 5.5;
  const boardH = LUMBER_ACTUAL[deckBoardSize]?.width || 1.0;
  const gap = 0.125;
  const boards = useMemo(() => {
    const arr = [];
    let y = 0, idx = 0;
    while (y < depth) {
      const bw = Math.min(boardW, depth - y);
      arr.push({ idx, y: y + bw / 2, bw });
      y += boardW + gap;
      idx++;
    }
    return arr;
  }, [width, depth, boardW]);

  return (
    <group>
      {boards.map(({ idx, y, bw }) => (
        <mesh key={`board-${idx}`} position={[width / 2 * IN, boardH / 2 * IN, y * IN]}>
          <boxGeometry args={[width * IN, boardH * IN, bw * IN]} />
          <meshStandardMaterial color={color} roughness={0.72} metalness={0.03} />
        </mesh>
      ))}
    </group>
  );
}

function Joists({ positions, depth, joistSize }) {
  const actual = LUMBER_ACTUAL[joistSize] || { width: 1.5, depth: 7.25 };
  return (
    <group>
      {positions.map((xIn, i) => (
        <mesh key={`joist-${i}`} position={[xIn * IN, -actual.depth / 2 * IN, depth / 2 * IN]}>
          <boxGeometry args={[actual.width * IN, actual.depth * IN, depth * IN]} />
          <meshStandardMaterial color="#5a4a32" roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
}

function Beams({ beamPositions, width, beamConfig, joistSize }) {
  const beamSize = beamConfig.split('-').slice(1).join('-') || '2x10';
  const actual = LUMBER_ACTUAL[beamSize] || { width: 1.5, depth: 9.25 };
  const joistActual = LUMBER_ACTUAL[joistSize] || { depth: 7.25 };
  const ply = parseInt(beamConfig.split('-')[0]) || 2;
  const beamTopY = -joistActual.depth;

  return (
    <group>
      {beamPositions.map((zIn, i) => (
        <group key={`beam-${i}`}>
          {Array.from({ length: ply }, (_, p) => {
            const offset = (p - (ply - 1) / 2) * actual.width;
            return (
              <mesh
                key={`beam-${i}-${p}`}
                position={[
                  (width / 2 + offset) * IN,
                  (beamTopY - actual.depth / 2) * IN,
                  zIn * IN,
                ]}
              >
                <boxGeometry args={[width * IN, actual.depth * IN, actual.width * IN]} />
                <meshStandardMaterial color="#8b6914" roughness={0.7} />
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

  return (
    <group>
      {posts.map((post, i) => {
        const postHeight = post.height + Math.abs(topOfPost);
        return (
          <mesh
            key={`post-${i}`}
            position={[
              post.x * IN,
              (topOfPost - postHeight / 2) * IN,
              post.y * IN,
            ]}
          >
            <boxGeometry args={[nominalWidth * IN, postHeight * IN, nominalWidth * IN]} />
            <meshStandardMaterial color="#6b5b45" roughness={0.82} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Railings (3D) ── */
function Railings({ railings, width, depth, height }) {
  const guardHeight = RAILING_RULES.guardMinHeight; // 36"
  const postWidth = 3.5; // 4x4 railing post actual size
  const railWidth = 1.5;
  const balusterSpacing = RAILING_RULES.balusterMaxSpacing; // 4"
  const deckTopY = (LUMBER_ACTUAL['5/4x6']?.width || 1.0) * IN;

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

        // Railing posts at corners
        const cornerPosts = [
          { x: x1, z: z1 },
          { x: x2, z: z2 },
        ];

        // Balusters
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
            {/* Corner posts */}
            {cornerPosts.map((p, i) => (
              <mesh key={`rpost-${edge}-${i}`} position={[p.x * IN, deckTopY + guardHeight / 2 * IN, p.z * IN]}>
                <boxGeometry args={[postWidth * IN, guardHeight * IN, postWidth * IN]} />
                <meshStandardMaterial color="#5a8a3a" roughness={0.7} />
              </mesh>
            ))}

            {/* Top rail */}
            <mesh position={[midX * IN, deckTopY + guardHeight * IN, midZ * IN]} rotation={[0, rotY, 0]}>
              <boxGeometry args={[length * IN, railWidth * IN, railWidth * IN]} />
              <meshStandardMaterial color="#4a7a2a" roughness={0.65} />
            </mesh>

            {/* Bottom rail */}
            <mesh position={[midX * IN, deckTopY + 4 * IN, midZ * IN]} rotation={[0, rotY, 0]}>
              <boxGeometry args={[length * IN, railWidth * IN, railWidth * IN]} />
              <meshStandardMaterial color="#4a7a2a" roughness={0.65} />
            </mesh>

            {/* Balusters */}
            {balusters.map((b, i) => (
              <mesh key={`bal-${edge}-${i}`} position={[b.x * IN, deckTopY + guardHeight / 2 * IN, b.z * IN]}>
                <boxGeometry args={[1 * IN, (guardHeight - 2) * IN, 1 * IN]} />
                <meshStandardMaterial color="#5a9a4a" roughness={0.75} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/* ── Stairs (3D) ── */
function Stairs({ stairEdge, stairCalcs, width, depth }) {
  if (!stairEdge || !stairCalcs) return null;

  const { numRisers, numTreads, riserHeight, totalRun } = stairCalcs;
  const treadDepth = STAIR_RULES.idealTreadDepth;
  const stairWidth = STAIR_RULES.maxStairWidth; // 36"
  const treadThickness = 1.0; // 5/4 deck board
  const deckTopY = (LUMBER_ACTUAL['5/4x6']?.width || 1.0);

  // Determine stair starting position and direction
  let startX, startZ, dirX, dirZ, rotY;
  if (stairEdge === 's') {
    startX = width / 2 - stairWidth / 2; startZ = depth;
    dirX = 0; dirZ = 1; rotY = 0;
  } else if (stairEdge === 'n') {
    startX = width / 2 - stairWidth / 2; startZ = 0;
    dirX = 0; dirZ = -1; rotY = Math.PI;
  } else if (stairEdge === 'e') {
    startX = width; startZ = depth / 2 - stairWidth / 2;
    dirX = 1; dirZ = 0; rotY = -Math.PI / 2;
  } else {
    startX = 0; startZ = depth / 2 - stairWidth / 2;
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

  // Stringers (side supports)
  const stringerLength = Math.sqrt(totalRun ** 2 + (deckTopY + numRisers * riserHeight) ** 2);
  const stringerAngle = Math.atan2(numRisers * riserHeight, totalRun);

  const isVertical = stairEdge === 'n' || stairEdge === 's';
  const treadW = isVertical ? stairWidth : treadDepth;
  const treadD = isVertical ? treadDepth : stairWidth;

  return (
    <group>
      {/* Treads */}
      {treads.map((t, i) => (
        <mesh key={`tread-${i}`} position={[t.x * IN, t.y * IN, t.z * IN]}>
          <boxGeometry args={[treadW * IN, treadThickness * IN, treadD * IN]} />
          <meshStandardMaterial color="#d4956b" roughness={0.7} />
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
        >
          <boxGeometry args={[
            (isVertical ? stairWidth : 0.75) * IN,
            riserHeight * IN,
            (isVertical ? 0.75 : stairWidth) * IN,
          ]} />
          <meshStandardMaterial color="#b07850" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/* ── House Wall (ledger) ── */
function HouseWall({ width, height }) {
  const wallHeight = Math.max(height, 96); // At least 8ft
  const wallThick = 6;
  const deckTopY = (LUMBER_ACTUAL['5/4x6']?.width || 1.0);
  return (
    <mesh position={[width / 2 * IN, (deckTopY + wallHeight / 2) * IN, -wallThick / 2 * IN]}>
      <boxGeometry args={[(width + 24) * IN, wallHeight * IN, wallThick * IN]} />
      <meshStandardMaterial color="#3a3a4a" roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#1a3a1a" roughness={1} />
    </mesh>
  );
}

export default function Scene3D() {
  const sections = useDeckStore((s) => s.sections);
  const sectionCalcs = useDeckStore((s) => s.sectionCalcs);
  const materials = useDeckStore((s) => s.materials);

  // Center camera on bounding box of all sections
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
    <div style={{ width: '100%', height: '100%' }}>
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

        <ambientLight intensity={0.45} />
        <directionalLight position={[20, 30, 20]} intensity={1.1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <directionalLight position={[-10, 15, -10]} intensity={0.3} color="#8888cc" />
        <hemisphereLight intensity={0.15} color="#aaddff" groundColor="#332200" />

        <color attach="background" args={['#0a1628']} />
        <fog attach="fog" args={['#0a1628', 40, 120]} />

        {sections.map((sec) => {
          const calcs = sectionCalcs[sec.id];
          if (!calcs) return null;
          return (
            <group key={sec.id} position={[sec.x * IN, 0, sec.y * IN]}>
              <DeckBoards width={sec.width} depth={sec.depth} species={materials.species} deckBoardSize={materials.deckBoardSize} />
              <Joists positions={calcs.joists.positions} depth={sec.depth} joistSize={materials.joistSize} />
              <Beams beamPositions={calcs.beams.positions} width={sec.width} beamConfig={materials.beamConfig} joistSize={materials.joistSize} />
              <Posts posts={calcs.posts.posts} postSize={materials.postSize} joistSize={materials.joistSize} beamConfig={materials.beamConfig} />
              {/* Railings — synced from 2D */}
              <Railings railings={sec.railings} width={sec.width} depth={sec.depth} height={sec.height} />
              {/* Stairs — synced from 2D */}
              <Stairs stairEdge={sec.stairs} stairCalcs={calcs.stairs} width={sec.width} depth={sec.depth} />
              {/* House wall for ledger-attached decks */}
              {sec.ledgerAttached && <HouseWall width={sec.width} height={sec.height} />}
            </group>
          );
        })}

        <GroundPlane />
        <gridHelper args={[100, 100, '#1a2a4a', '#111828']} position={[0, -4.99, 0]} />
      </Canvas>
    </div>
  );
}
