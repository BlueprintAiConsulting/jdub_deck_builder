const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, 'src/components/Viewport3D/Scene3D.jsx');
const utilsPath = path.join(__dirname, 'src/utils/polygonUtils.js');

let sceneCode = fs.readFileSync(scenePath, 'utf8');
let utilsCode = fs.readFileSync(utilsPath, 'utf8');

// The first block: getHorizontalIntersections and getVerticalIntersections
const block1Regex = /export function getHorizontalIntersections[\s\S]*?function getVerticalIntersections[\s\S]*?return segments;\n\}\n/;
const match1 = sceneCode.match(block1Regex);

// The second block: getEdgeTransform
const block2Regex = /function getEdgeTransform[^{]*\{[\s\S]*?\}\n\}\n/;
const match2 = sceneCode.match(block2Regex);

if (match1 && match2) {
  sceneCode = sceneCode.replace(match1[0], '');
  sceneCode = sceneCode.replace(match2[0], '');
  
  utilsCode += '\n\n' + match1[0] + '\n' + match2[0].replace('function getEdgeTransform', 'export function getEdgeTransform');
  
  const importRegex = /import \{\s*isPointInPolygon,\s*getPolygonBoundingBox\s*\}\s*from\s*'..\/..\/utils\/polygonUtils\.js';/;
  sceneCode = sceneCode.replace(importRegex, `import {
  isPointInPolygon,
  getPolygonBoundingBox,
  getHorizontalIntersections,
  getVerticalIntersections,
  getEdgeTransform
} from '../../utils/polygonUtils.js';`);

  fs.writeFileSync(scenePath, sceneCode, 'utf8');
  fs.writeFileSync(utilsPath, utilsCode, 'utf8');
  console.log("Successfully extracted math to polygonUtils.js!");
} else {
  console.log("Could not match the functions in Scene3D.jsx.");
}
