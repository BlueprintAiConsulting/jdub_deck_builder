const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, 'src/components/Viewport3D/Scene3D.jsx');
const polygonUtilsPath = path.join(__dirname, 'src/utils/polygonUtils.js');

let sceneCode = fs.readFileSync(scenePath, 'utf8');
let utilsCode = fs.readFileSync(polygonUtilsPath, 'utf8');

// The math functions to extract
const intersectionsMatch = sceneCode.match(/function getHorizontalIntersections[\s\S]*?function getEdgeTransform[^{]*\{[\s\S]*?\}\n\}\n/);
if (!intersectionsMatch) {
  console.log("Could not find the math functions in Scene3D.jsx");
  process.exit(1);
}

const mathCode = intersectionsMatch[0];

// Remove them from Scene3D.jsx
sceneCode = sceneCode.replace(mathCode, '');

// Make them exported functions in polygonUtils.js
let exportedMathCode = mathCode.replace(/function getHorizontalIntersections/g, 'export function getHorizontalIntersections')
  .replace(/function getVerticalIntersections/g, 'export function getVerticalIntersections')
  .replace(/function getEdgeTransform/g, 'export function getEdgeTransform');

// Append to polygonUtils.js
utilsCode += '\n\n' + exportedMathCode;

// Update imports in Scene3D.jsx
const importRegex = /import \{\s*isPointInPolygon,\s*getPolygonBoundingBox\s*\}\s*from\s*'..\/..\/utils\/polygonUtils\.js';/;
sceneCode = sceneCode.replace(importRegex, `import {
  isPointInPolygon,
  getPolygonBoundingBox,
  getHorizontalIntersections,
  getVerticalIntersections,
  getEdgeTransform
} from '../../utils/polygonUtils.js';`);

fs.writeFileSync(scenePath, sceneCode, 'utf8');
fs.writeFileSync(polygonUtilsPath, utilsCode, 'utf8');

console.log("Math functions successfully extracted to polygonUtils.js and Scene3D.jsx updated.");
