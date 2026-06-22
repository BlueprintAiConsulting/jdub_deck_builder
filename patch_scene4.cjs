const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/Viewport3D/Scene3D.jsx');
let code = fs.readFileSync(file, 'utf8');

// 1. Redefine getProceduralTexture to return an object { map, color }
const oldTexLoaderRegex = /export function getProceduralTexture\(colorHex, type\) \{[\s\S]*?return null;\s*\}/;

const newTexLoader = `export function getProceduralTexture(colorHex, type) {
  let tex = null;
  let useColor = new Color(0xffffff);

  if (type === 'siding') tex = loadStaticTexture('siding', 1, 1);
  else if (type === 'concrete') tex = loadStaticTexture('concrete', 4, 4);
  else if (type === 'shingles') tex = loadStaticTexture('shingles', 4, 4);
  else if (type && type.startsWith('wood')) {
    tex = loadStaticTexture('wood_grain', 1, 4, false);
    useColor = new Color(colorHex).multiplyScalar(1.5);
  } else if (type && type.startsWith('composite')) {
    tex = loadStaticTexture('composite_grain', 1, 4, false);
    useColor = new Color(colorHex).multiplyScalar(1.5);
  } else if (type === 'grass') {
    tex = _legacyProceduralTexture(colorHex, type);
  }
  
  // To stay backwards compatible if something expects a raw texture:
  if (tex) {
    tex.customColor = useColor;
  }
  return tex;
}`;

code = code.replace(oldTexLoaderRegex, newTexLoader);

// 2. Replace map={texVar} with map={texVar} color={texVar?.customColor || '#ffffff'}
// Find all getProceduralTexture variable assignments
const matches = [...code.matchAll(/const\s+([a-zA-Z0-9_]+)\s*=\s*getProceduralTexture/g)];
const texVars = [...new Set(matches.map(m => m[1]))]; // e.g. 'boardTexture', 'joistTexture', 'sidingTexture'

// In case my previous script added `color={color} map={tex}`, let's strip that first to avoid duplicates
code = code.replace(/color=\{color\}\s+map=\{/g, 'map={');

for (const texVar of texVars) {
  // Replace exactly map={texVar} with map={texVar} color={texVar?.customColor}
  const regex = new RegExp('map=\\{' + texVar + '\\}', 'g');
  code = code.replace(regex, `map={` + texVar + `} color={` + texVar + `?.customColor || '#ffffff'}`);
}

// 3. Move House outside of section map and make it wide.
// We'll replace the internal House call first to remove it from sections loop.
code = code.replace(/\{sec\.ledgerAttached\s*&&\s*<House width=\{sec\.width\} height=\{sec\.height\}\s*\/>\}/g, '');

// Insert the House call at the bottom of the canvas, before GroundPlane
const hasLedgerCheck = `
        {sections.some(s => s.ledgerAttached) && <House />}
        <GroundPlane heightAxis={heightAxis} />
`;
code = code.replace(/<GroundPlane heightAxis=\{heightAxis\}\s*\/>/, hasLedgerCheck);

// 4. Update the House component definition to be generic and wide
const oldHouseDefRegex = /function House\(\{\s*width,\s*height\s*\}\)\s*\{[\s\S]*?return \(\s*<group position=\{\[safeW \/ 2 \* IN, 0, 0\]\}\>[\s\S]*?<\/group>\s*\);\s*\}/;

const newHouseDef = `function House() {
  const safeW = 480; // 40 feet wide
  const safeH = 36;
  const wallHeightAboveDeck = 96; // 8 feet
  const totalWallHeight = safeH + wallHeightAboveDeck;
  const wallThick = 6;
  
  const sidingTexture = getProceduralTexture('#cbd5e1', 'siding');
  const shingleTexture = getProceduralTexture('#2f3640', 'shingles');
  const concreteTexture = getProceduralTexture('#b2bec3', 'concrete');
  
  if (sidingTexture && sidingTexture.repeat) {
    sidingTexture.repeat.set(4, totalWallHeight / 64);
  }
  if (shingleTexture && shingleTexture.repeat) {
    shingleTexture.repeat.set(4, 1);
  }
  
  return (
    <group position={[0, 0, 0]}>
      {/* 1. Main Siding Wall */}
      <mesh position={[0, (wallHeightAboveDeck - safeH) / 2 * IN, -wallThick / 2 * IN]} castShadow receiveShadow>
        <boxGeometry args={[(safeW + 36) * IN, totalWallHeight * IN, wallThick * IN]} />
        <meshStandardMaterial map={sidingTexture} color={sidingTexture?.customColor || '#ffffff'} roughness={0.8} />
      </mesh>

      {/* 2. Concrete Foundation Base */}
      <mesh position={[0, -(safeH + 60) / 2 * IN, -(wallThick - 0.5) / 2 * IN]} castShadow receiveShadow>
        <boxGeometry args={[(safeW + 36) * IN, (safeH + 60) * IN, (wallThick - 0.5) * IN]} />
        <meshStandardMaterial map={concreteTexture} color={concreteTexture?.customColor || '#ffffff'} roughness={0.9} />
      </mesh>

      {/* 3. Vertical White Corner Trim */}
      <mesh position={[-(safeW + 36.5) / 2 * IN, (wallHeightAboveDeck - safeH) / 2 * IN, -2.5 * IN]} castShadow>
        <boxGeometry args={[4 * IN, totalWallHeight * IN, 4.5 * IN]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
      <mesh position={[(safeW + 36.5) / 2 * IN, (wallHeightAboveDeck - safeH) / 2 * IN, -2.5 * IN]} castShadow>
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
        <mesh position={[-16 * IN, 0, 0.8 * IN]}>
          <boxGeometry args={[32 * IN, 76 * IN, 0.1 * IN]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} wireframe={true} />
        </mesh>
        <mesh position={[16 * IN, 0, 0.5 * IN]}>
          <boxGeometry args={[32 * IN, 76 * IN, 0.1 * IN]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} wireframe={true} />
        </mesh>
      </group>

      {/* 5. Flanking Windows */}
      <group position={[-120 * IN, 48 * IN, 0.1 * IN]}>
        <mesh castShadow>
          <boxGeometry args={[48 * IN, 54 * IN, 2.5 * IN]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.4 * IN]}>
          <boxGeometry args={[42 * IN, 48 * IN, 0.5 * IN]} />
          <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.7 * IN]}>
          <boxGeometry args={[42 * IN, 2 * IN, 0.2 * IN]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
      </group>

      <group position={[120 * IN, 48 * IN, 0.1 * IN]}>
        <mesh castShadow>
          <boxGeometry args={[48 * IN, 54 * IN, 2.5 * IN]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.4 * IN]}>
          <boxGeometry args={[42 * IN, 48 * IN, 0.5 * IN]} />
          <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.7 * IN]}>
          <boxGeometry args={[42 * IN, 2 * IN, 0.2 * IN]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
      </group>

      {/* 6. Gabled Roof Overhang */}
      <group position={[0, wallHeightAboveDeck * IN, 0]}>
        <mesh position={[0, 12 * IN, -30 * IN]} rotation={[-18 * Math.PI / 180, 0, 0]} castShadow>
          <boxGeometry args={[(safeW + 42) * IN, 1 * IN, 84 * IN]} />
          <meshStandardMaterial map={shingleTexture} color={shingleTexture?.customColor || '#ffffff'} roughness={0.95} />
        </mesh>
        <mesh position={[0, -0.5 * IN, 6 * IN]} castShadow>
          <boxGeometry args={[(safeW + 40) * IN, 1 * IN, 12 * IN]} />
          <meshStandardMaterial color="#ffffff" roughness={0.6} />
        </mesh>
        <mesh position={[0, -1.5 * IN, 12.2 * IN]} castShadow>
          <boxGeometry args={[(safeW + 40.5) * IN, 4 * IN, 0.5 * IN]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}`;

code = code.replace(oldHouseDefRegex, newHouseDef);

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully patched scene 4!');
