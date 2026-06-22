const fs = require('fs');
const path = require('path');

const canvasPath = path.join(__dirname, 'src/components/Viewport2D/Canvas2D.jsx');
let canvasCode = fs.readFileSync(canvasPath, 'utf8');

// 1. Import math functions
if (!canvasCode.includes('getHorizontalIntersections')) {
  canvasCode = canvasCode.replace(
    /import \{\s*isPointInPolygon,/,
    "import { isPointInPolygon, getHorizontalIntersections, getVerticalIntersections, getEdgeTransform,"
  );
}

// 2. Joists & Blocking
const oldJoistsRegex = /\/\/ Joists[\s\S]*?\/\/ Beams/;
const newJoistsCode = `// Joists
      if (visibleLayers.framing) {
        ctx.strokeStyle = legendColors.joists;
        ctx.lineWidth = 1.5;
        
        const localVertices = (sec.vertices && sec.vertices.length >= 3) ? sec.vertices.map(v => ({ x: v.x - sec.x, y: v.y - sec.y })) : null;

        if (joistsVertical) {
          calcs.joists.positions.forEach((xIn) => {
            const x = sx + xIn * S;
            if (x > sx + sw + 1) return;
            if (localVertices) {
               const spans = getVerticalIntersections(xIn, localVertices);
               spans.forEach(span => {
                 ctx.beginPath(); ctx.moveTo(x, sy + span.minY * S); ctx.lineTo(x, sy + span.maxY * S); ctx.stroke();
               });
            } else {
               ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy + sd); ctx.stroke();
            }
          });
        } else {
          calcs.joists.positions.forEach((yIn) => {
            const y = sy + yIn * S;
            if (y > sy + sd + 1) return;
            if (localVertices) {
               const spans = getHorizontalIntersections(yIn, localVertices);
               spans.forEach(span => {
                 ctx.beginPath(); ctx.moveTo(sx + span.minX * S, y); ctx.lineTo(sx + span.maxX * S, y); ctx.stroke();
               });
            } else {
               ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + sw, y); ctx.stroke();
            }
          });
        }

        // Blocking
        if (calcs.joists.blocking && calcs.joists.blocking.enabled && calcs.joists.blocking.segments) {
          ctx.strokeStyle = legendColors.joists;
          ctx.lineWidth = 1.5;
          calcs.joists.blocking.segments.forEach((seg) => {
            const midX = (seg.x1 + seg.x2) / 2;
            const midY = (seg.y1 + seg.y2) / 2;
            if (localVertices && !isPointInPolygon(midX, midY, localVertices)) return;
            
            ctx.beginPath();
            ctx.moveTo(sx + seg.x1 * S, sy + seg.y1 * S);
            ctx.lineTo(sx + seg.x2 * S, sy + seg.y2 * S);
            ctx.stroke();
          });
        }

        // Beams`;

canvasCode = canvasCode.replace(oldJoistsRegex, newJoistsCode);

// 3. Beams
const oldBeamsRegex = /\/\/ Beams[\s\S]*?\/\/ Posts/;
const newBeamsCode = `// Beams
        ctx.strokeStyle = legendColors.beams;
        ctx.lineWidth = 3;
        const localV = (sec.vertices && sec.vertices.length >= 3) ? sec.vertices.map(v => ({ x: v.x - sec.x, y: v.y - sec.y })) : null;

        if (joistsVertical) { // Beams are horizontal
          calcs.beams.positions.forEach((yIn) => {
            const y = sy + yIn * S;
            if (localV) {
               const spans = getHorizontalIntersections(yIn, localV);
               spans.forEach(span => {
                 ctx.beginPath(); ctx.moveTo(sx + span.minX * S - 6, y); ctx.lineTo(sx + span.maxX * S + 6, y); ctx.stroke();
               });
            } else {
               ctx.beginPath(); ctx.moveTo(sx - 6, y); ctx.lineTo(sx + sw + 6, y); ctx.stroke();
            }
          });
        } else { // Beams are vertical
          calcs.beams.positions.forEach((xIn) => {
            const x = sx + xIn * S;
            if (localV) {
               const spans = getVerticalIntersections(xIn, localV);
               spans.forEach(span => {
                 ctx.beginPath(); ctx.moveTo(x, sy + span.minY * S - 6); ctx.lineTo(x, sy + span.maxY * S + 6); ctx.stroke();
               });
            } else {
               ctx.beginPath(); ctx.moveTo(x, sy - 6); ctx.lineTo(x, sy + sd - 6); ctx.stroke();
            }
          });
        }
      }

      // Posts`;

canvasCode = canvasCode.replace(oldBeamsRegex, newBeamsCode);

// 4. Posts
const oldPostsRegex = /\/\/ Posts[\s\S]*?\/\/ Railings/;
const newPostsCode = `// Posts
      if (visibleLayers.foundation) {
        const localV = (sec.vertices && sec.vertices.length >= 3) ? sec.vertices.map(v => ({ x: v.x - sec.x, y: v.y - sec.y })) : null;
        calcs.posts.posts.forEach((post) => {
          if (localV && !isPointInPolygon(post.x, post.y, localV)) return;
          const px = sx + post.x * S, py = sy + post.y * S;
          ctx.fillStyle = legendColors.posts + '33'; // ~20% alpha
          ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = legendColors.posts;
          ctx.fillRect(px - 3.5, py - 3.5, 7, 7);
        });
      }

      // Railings`;
canvasCode = canvasCode.replace(oldPostsRegex, newPostsCode);

// 5. Railings
const oldRailingsRegex = /\/\/ Railings[\s\S]*?\/\/ Stairs/;
const newRailingsCode = `// Railings
      if (visibleLayers.accessories) {
        ctx.strokeStyle = legendColors.railings;
        ctx.lineWidth = 3;
        
        if (sec.vertices && sec.vertices.length >= 3) {
          // Polygon railings
          for (let i = 0; i < sec.vertices.length; i++) {
             const v1 = sec.vertices[i];
             const v2 = sec.vertices[(i+1)%sec.vertices.length];
             const dx = v2.x - v1.x;
             const dz = v2.y - v1.y;
             let edgeLabel = '';
             if (Math.abs(-dz) > Math.abs(dx)) { edgeLabel = -dz < 0 ? 'w' : 'e'; } 
             else { edgeLabel = dx < 0 ? 'n' : 's'; }
             
             if (sec.railings[edgeLabel]) {
               ctx.beginPath();
               ctx.moveTo(v1.x * S + ox, v1.y * S + oy);
               ctx.lineTo(v2.x * S + ox, v2.y * S + oy);
               ctx.stroke();
             }
          }
        } else {
          // Bounding box fallback
          Object.entries(sec.railings).forEach(([edge, on]) => {
            if (!on) return;
            ctx.beginPath();
            if (edge === 'n') { ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); }
            if (edge === 's') { ctx.moveTo(sx, sy + sd); ctx.lineTo(sx + sw, sy + sd); }
            if (edge === 'w') { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sd); }
            if (edge === 'e') { ctx.moveTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + sd); }
            ctx.stroke();
          });
        }
      }

      // Stairs`;
canvasCode = canvasCode.replace(oldRailingsRegex, newRailingsCode);

// 6. Stairs and Ramps... wait, let's just do Stairs and Ramps separately.
fs.writeFileSync(canvasPath, canvasCode, 'utf8');
console.log("Canvas2D partial patch applied.");
