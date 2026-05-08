import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useDeckStore } from '../../store/deckStore';
import { WOOD_COLORS } from '../Materials/materialData';
import { LUMBER_ACTUAL } from '../../engine/spanTables';

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
  // Beams sit directly below joists
  const beamTopY = -joistActual.depth;
  
  return (
    <group>
      {beamPositions.map((zIn, i) => (
        <group key={`beam-${i}`}>
          {Array.from({ length: ply }, (_, p) => {
            // Offset each ply board sideways
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
            </group>
          );
        })}

        <GroundPlane />
        <gridHelper args={[100, 100, '#1a2a4a', '#111828']} position={[0, -4.99, 0]} />
      </Canvas>
    </div>
  );
}
