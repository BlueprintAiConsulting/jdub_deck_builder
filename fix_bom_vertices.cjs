const fs = require('fs');
const path = require('path');

const bomPath = path.join(__dirname, 'src/engine/bomGenerator.js');
let bomCode = fs.readFileSync(bomPath, 'utf8');

bomCode = bomCode.replace(
  "if (config.vertices && config.vertices.length >= 3) {",
  "const localVertices = (config.vertices && config.vertices.length >= 3) ? config.vertices.map(v => ({ x: v.x - (config.x || 0), y: v.y - (config.y || 0) })) : null;\n  if (localVertices) {"
);
bomCode = bomCode.replace(/config\.vertices/g, 'localVertices');
// Wait, the above might break Rim Joists, which uses config.vertices.
// Let's just be specific.

bomCode = fs.readFileSync(bomPath, 'utf8'); // reload

bomCode = bomCode.replace(
  /if \(config\.vertices && config\.vertices\.length >= 3\) \{\n    if \(isVerticalJoists\)/g,
  `const localV = config.vertices ? config.vertices.map(v => ({ x: v.x - (config.x || 0), y: v.y - (config.y || 0) })) : null;
  if (localV && localV.length >= 3) {
    if (isVerticalJoists)`
);

bomCode = bomCode.replace(
  /config\.vertices\);\n        spans\.forEach/g,
  'localV);\n        spans.forEach'
);

bomCode = bomCode.replace(
  /isPointInPolygon\(midX, midY, config\.vertices\)/g,
  'isPointInPolygon(midX, midY, localV)'
);

bomCode = bomCode.replace(
  /isPointInPolygon\(post\.x, post\.y, config\.vertices\)/g,
  'isPointInPolygon(post.x, post.y, localV)'
);


fs.writeFileSync(bomPath, bomCode, 'utf8');
console.log("bomGenerator.js fixed for localVertices");
