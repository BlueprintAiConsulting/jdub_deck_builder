const fs = require('fs');
const path = require('path');

const canvasPath = path.join(__dirname, 'src/components/Viewport2D/Canvas2D.jsx');
let canvasCode = fs.readFileSync(canvasPath, 'utf8');

// Stairs
const oldStairsRegex = /\/\/ Stairs[\s\S]*?\/\/ Ramps/;
const newStairsCode = `// Stairs
      if (sec.stairs && calcs.stairs && visibleLayers.accessories) {
        const st = calcs.stairs;
        const stairDir = typeof sec.stairs === 'string' ? sec.stairs : (sec.stairs.direction || 's');
        const stairW = st.width * S;
        const stairD = st.totalRun * S;
        const offset = getSubObjectOffset(sec, 'stairs');
        
        const isStairsSelected = isSelected && selectedSubObjectType === 'stairs';
        ctx.fillStyle = isStairsSelected 
          ? (isLightTheme ? 'rgba(29, 78, 216, 0.1)' : 'rgba(59, 130, 246, 0.15)')
          : legendColors.stairs + '26';
        ctx.strokeStyle = isStairsSelected ? '#1d4ed8' : legendColors.stairs;
        ctx.lineWidth = isStairsSelected ? 3.0 : 1.5;
        
        const { centerX, centerZ, rotY } = getEdgeTransform(sec.vertices, sec.x, sec.y, stairDir, offset, st.width, sec.width, sec.depth);
        const cx = (centerX + sec.x) * S + ox;
        const cy = (centerZ + sec.y) * S + oy;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-rotY); // -rotY because canvas +Y is down, 3D +Z is out

        ctx.fillRect(-stairW / 2, 0, stairW, stairD);
        ctx.strokeRect(-stairW / 2, 0, stairW, stairD);
        
        const treadCount = st.numTreads;
        for (let i = 1; i < treadCount; i++) {
          const frac = i / treadCount;
          ctx.beginPath();
          ctx.moveTo(-stairW / 2, stairD * frac);
          ctx.lineTo(stairW / 2, stairD * frac);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Ramps`;

canvasCode = canvasCode.replace(oldStairsRegex, newStairsCode);

// Ramps
const oldRampsRegex = /\/\/ Ramps[\s\S]*?\/\/ Render house outline/;
const newRampsCode = `// Ramps
      if (sec.ramp && calcs.ramp) {
        const rm = calcs.ramp;
        const rampDir = typeof sec.ramp === 'string' ? sec.ramp : (sec.ramp.direction || 's');
        const rampW = rm.width * S;
        const footprintRun = rm.run + 60 * (rm.intermediateLandings || 0);
        const rampD = footprintRun * S;
        const offset = getSubObjectOffset(sec, 'ramp');
        
        const isRampSelected = isSelected && selectedSubObjectType === 'ramp';
        ctx.fillStyle = isRampSelected 
          ? (isLightTheme ? 'rgba(29, 78, 216, 0.1)' : 'rgba(59, 130, 246, 0.15)')
          : legendColors.ramps + '26';
        ctx.strokeStyle = isRampSelected ? '#1d4ed8' : legendColors.ramps;
        ctx.lineWidth = isRampSelected ? 3.0 : 1.5;
        
        const { centerX, centerZ, rotY } = getEdgeTransform(sec.vertices, sec.x, sec.y, rampDir, offset, rm.width, sec.width, sec.depth);
        const cx = (centerX + sec.x) * S + ox;
        const cy = (centerZ + sec.y) * S + oy;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-rotY);

        ctx.fillRect(-rampW / 2, 0, rampW, rampD);
        ctx.strokeRect(-rampW / 2, 0, rampW, rampD);
        
        // Draw ramp arrow
        ctx.beginPath();
        ctx.moveTo(0, rampD * 0.9);
        ctx.lineTo(0, rampD * 0.1);
        ctx.moveTo(-10, rampD * 0.1 + 10);
        ctx.lineTo(0, rampD * 0.1);
        ctx.lineTo(10, rampD * 0.1 + 10);
        ctx.stroke();
        
        ctx.restore();
      }

      // Render house outline`;

canvasCode = canvasCode.replace(oldRampsRegex, newRampsCode);

fs.writeFileSync(canvasPath, canvasCode, 'utf8');
console.log("Canvas2D accessories patch applied.");
