import { formatDimension } from './units';

// Draw architectural dimension line on canvas
export function drawDimensionLine(ctx, p1, p2, text, offset, isLightTheme = true) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;

  const px = -uy;
  const py = ux;

  const gap = 4;
  const ex1_start = { x: p1.x + px * gap, y: p1.y + py * gap };
  const ex2_start = { x: p2.x + px * gap, y: p2.y + py * gap };

  const extLength = Math.abs(offset) + 4;
  const sign = Math.sign(offset);
  const ex1_end = { x: p1.x + px * sign * extLength, y: p1.y + py * sign * extLength };
  const ex2_end = { x: p2.x + px * sign * extLength, y: p2.y + py * sign * extLength };

  const dim_start = { x: p1.x + px * offset, y: p1.y + py * offset };
  const dim_end = { x: p2.x + px * offset, y: p2.y + py * offset };

  // Set line style for blueprint
  ctx.strokeStyle = isLightTheme ? '#64748b' : '#94a3b8';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(ex1_start.x, ex1_start.y);
  ctx.lineTo(ex1_end.x, ex1_end.y);
  ctx.moveTo(ex2_start.x, ex2_start.y);
  ctx.lineTo(ex2_end.x, ex2_end.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(dim_start.x - ux * 3, dim_start.y - uy * 3);
  ctx.lineTo(dim_end.x + ux * 3, dim_end.y + uy * 3);
  ctx.stroke();

  // Architectural ticks (diagonal slashes)
  const slashSize = 4;
  const sx1 = ux * slashSize + px * sign * slashSize;
  const sy1 = uy * slashSize + py * sign * slashSize;

  ctx.beginPath();
  ctx.moveTo(dim_start.x - sx1, dim_start.y - sy1);
  ctx.lineTo(dim_start.x + sx1, dim_start.y + sy1);
  ctx.moveTo(dim_end.x - sx1, dim_end.y - sy1);
  ctx.lineTo(dim_end.x + sx1, dim_end.y + sy1);
  ctx.stroke();

  // Center coordinates for text
  const cx = (dim_start.x + dim_end.x) / 2;
  const cy = (dim_start.y + dim_end.y) / 2;

  ctx.save();
  ctx.translate(cx, cy);
  let angle = Math.atan2(dy, dx);
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
    angle += Math.PI;
  }
  ctx.rotate(angle);

  // Background padding box to make text readable over grid/elements
  ctx.font = '600 9px "JetBrains Mono", monospace';
  const textWidth = ctx.measureText(text).width + 6;
  ctx.fillStyle = isLightTheme ? '#ffffff' : '#060a14';
  ctx.fillRect(-textWidth / 2, -6, textWidth, 12);

  // Render the text
  ctx.fillStyle = isLightTheme ? '#0f172a' : '#cbd5e1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Render a professional 2D deck blueprint onto a canvas.
 */
export function renderBlueprint(canvas, sections, sectionCalcs, materials, showDimensions, projectName) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear to white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Draw blueprint double border
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(10, 10, width - 20, height - 20);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(14, 14, width - 28, height - 28);

  if (!sections || sections.length === 0) return;

  // Title Block height at the bottom
  const titleBlockHeight = 70;
  const printAreaHeight = height - titleBlockHeight - 30;

  // Calculate layout bounding box in design space (inches)
  const xs = [];
  const xMaxs = [];
  const ys = [];
  const yMaxs = [];

  sections.forEach(s => {
    xs.push(s.x);
    xMaxs.push(s.x + s.width);
    ys.push(s.y);
    yMaxs.push(s.y + s.depth);
  });

  const minX = Math.min(...xs);
  const maxX = Math.max(...xMaxs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...yMaxs);

  const designWidth = maxX - minX;
  const designDepth = maxY - minY;

  // Calculate scale S to fit the layout into the printing area (with 80px margin)
  const margin = 80;
  const availW = width - margin * 2;
  const availH = printAreaHeight - margin * 2;

  const scaleX = availW / designWidth;
  const scaleY = availH / designDepth;
  const S = Math.min(scaleX, scaleY, 1.5); // Cap scale at 1.5 pixels/inch to prevent over-stretching small decks

  // Centering translation offsets
  const ox = (width - designWidth * S) / 2 - minX * S;
  const oy = (printAreaHeight - designDepth * S) / 2 - minY * S + 15;

  // Draw blueprint grid (subtle 1ft grid)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 0.5;
  const gs = 12 * S;
  const gridStartX = Math.floor(minX / 12) * 12 * S + ox;
  const gridEndX = Math.ceil(maxX / 12) * 12 * S + ox;
  const gridStartY = Math.floor(minY / 12) * 12 * S + oy;
  const gridEndY = Math.ceil(maxY / 12) * 12 * S + oy;

  for (let x = gridStartX; x <= gridEndX; x += gs) {
    ctx.beginPath(); ctx.moveTo(x, 15); ctx.lineTo(x, printAreaHeight); ctx.stroke();
  }
  for (let y = gridStartY; y <= gridEndY; y += gs) {
    ctx.beginPath(); ctx.moveTo(15, y); ctx.lineTo(width - 15, y); ctx.stroke();
  }

  // Draw Sections
  sections.forEach((sec, secIdx) => {
    const calcs = sectionCalcs[sec.id];
    if (!calcs) return;

    const sx = sec.x * S + ox;
    const sy = sec.y * S + oy;
    const sw = sec.width * S;
    const sd = sec.depth * S;

    // 1. Draw deck body
    ctx.fillStyle = sec.type === 'landing' ? '#f1f5f9' : '#fafafa';
    ctx.fillRect(sx, sy, sw, sd);

    // 2. Draw joists
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    calcs.joists.positions.forEach((xIn) => {
      const x = sx + xIn * S;
      ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy + sd); ctx.stroke();
    });

    // 3. Draw Beams
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.5;
    calcs.beams.positions.forEach((yIn) => {
      const y = sy + yIn * S;
      ctx.beginPath(); ctx.moveTo(sx - 4, y); ctx.lineTo(sx + sw + 4, y); ctx.stroke();
    });

    // 4. Draw Posts
    calcs.posts.posts.forEach((post) => {
      const px = sx + post.x * S;
      const py = sy + post.y * S;
      // Post footing circle
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.stroke();

      // Physical post square
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(px - 3, py - 3, 6, 6);
    });

    // 5. Draw Railings
    Object.entries(sec.railings).forEach(([edge, on]) => {
      if (!on) return;
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (edge === 'n') { ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); }
      else if (edge === 's') { ctx.moveTo(sx, sy + sd); ctx.lineTo(sx + sw, sy + sd); }
      else if (edge === 'e') { ctx.moveTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + sd); }
      else if (edge === 'w') { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sd); }
      ctx.stroke();
    });

    // 6. Draw House Wall / Ledger
    if (sec.ledgerAttached) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + sw, sy);
      ctx.stroke();

      // House Wall Hatching representation
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      const hatchSpacing = 6;
      for (let hx = sx; hx < sx + sw; hx += hatchSpacing) {
        ctx.beginPath();
        ctx.moveTo(hx, sy - 4);
        ctx.lineTo(hx + 4, sy + 1);
        ctx.stroke();
      }
    }

    // 7. Draw Stairs
    if (sec.stairs) {
      const st = sec.stairs;
      const stairDir = st.direction;
      const align = st.align || 'center';
      const stairW = st.width * S;
      const stairD = (st.numberOfSteps * st.run) * S;

      ctx.fillStyle = '#fafafa';
      ctx.strokeStyle = '#db2777';
      ctx.lineWidth = 1.2;

      let stX, stY;
      if (stairDir === 'n') {
        stY = sy - stairD;
        if (align === 'left') stX = sx;
        else if (align === 'right') stX = sx + sw - stairW;
        else stX = sx + sw / 2 - stairW / 2;
      } else if (stairDir === 's') {
        stY = sy + sd;
        if (align === 'left') stX = sx;
        else if (align === 'right') stX = sx + sw - stairW;
        else stX = sx + sw / 2 - stairW / 2;
      } else if (stairDir === 'e') {
        stX = sx + sw;
        if (align === 'left') stY = sy;
        else if (align === 'right') stY = sy + sd - stairW;
        else stY = sy + sd / 2 - stairW / 2;
      } else {
        stX = sx - stairD;
        if (align === 'left') stY = sy;
        else if (align === 'right') stY = sy + sd - stairW;
        else stY = sy + sd / 2 - stairW / 2;
      }

      const isVert = stairDir === 'n' || stairDir === 's';
      const sW = isVert ? stairW : stairD;
      const sD = isVert ? stairD : stairW;

      ctx.fillRect(stX, stY, sW, sD);
      ctx.strokeRect(stX, stY, sW, sD);

      // Stairs treads lines
      const treadCount = st.numTreads || st.numberOfSteps;
      for (let i = 1; i < treadCount; i++) {
        const frac = i / treadCount;
        ctx.beginPath();
        if (isVert) { ctx.moveTo(stX, stY + sD * frac); ctx.lineTo(stX + sW, stY + sD * frac); }
        else { ctx.moveTo(stX + sW * frac, stY); ctx.lineTo(stX + sW * frac, stY + sD); }
        ctx.stroke();
      }
    }

    // 8. Section label / Badge
    const badgeX = sx + 12;
    const badgeY = sy + 12;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(badgeX + 8, badgeY + 8, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(secIdx + 1), badgeX + 8, badgeY + 8);

    ctx.fillStyle = '#475569';
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${sec.type === 'landing' ? 'Landing' : 'Deck'} H: ${sec.height}"`, badgeX + 22, badgeY + 8);
    ctx.textBaseline = 'alphabetic';

    // 9. Section Outer Dimension Lines
    if (showDimensions) {
      // Top Edge width
      drawDimensionLine(ctx, { x: sx, y: sy }, { x: sx + sw, y: sy }, formatDimension(sec.width), -18, true);
      // Right Edge depth
      drawDimensionLine(ctx, { x: sx + sw, y: sy }, { x: sx + sw, y: sy + sd }, formatDimension(sec.depth), 18, true);
    }

    // 10. Post-to-post dimension spacing
    if (showDimensions && calcs.posts.posts.length > 1) {
      const postsByY = {};
      calcs.posts.posts.forEach((post) => {
        const yKey = Math.round(post.y);
        if (!postsByY[yKey]) postsByY[yKey] = [];
        postsByY[yKey].push(post);
      });

      Object.keys(postsByY).forEach((yKey) => {
        const beamPosts = postsByY[yKey];
        beamPosts.sort((a, b) => a.x - b.x);

        for (let i = 0; i < beamPosts.length - 1; i++) {
          const p1 = beamPosts[i];
          const p2 = beamPosts[i+1];
          const px1 = sx + p1.x * S;
          const py1 = sy + p1.y * S;
          const px2 = sx + p2.x * S;
          const py2 = sy + p2.y * S;
          const dist = p2.x - p1.x;

          // Draw dimension line slightly offset from the beam line
          drawDimensionLine(ctx, { x: px1, y: py1 }, { x: px2, y: py2 }, formatDimension(dist), 14, true);
        }
      });
    }
  });

  // Overall Dimensions (Layout margins)
  if (showDimensions) {
    const leftmostX = minX * S + ox;
    const rightmostX = maxX * S + ox;
    const topY = minY * S + oy;
    const bottomY = maxY * S + oy;

    // Overall Width at top (more offset than section width)
    drawDimensionLine(ctx, { x: leftmostX, y: topY }, { x: rightmostX, y: topY }, `OVERALL WIDTH: ${formatDimension(maxX - minX)}`, -36, true);

    // Overall Depth at left
    drawDimensionLine(ctx, { x: leftmostX, y: topY }, { x: leftmostX, y: bottomY }, `OVERALL DEPTH: ${formatDimension(maxY - minY)}`, -36, true);
  }

  // Draw Title Block
  const tY = height - titleBlockHeight - 15;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(15, tY, width - 30, titleBlockHeight);
  
  // Double top border for title block
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(15, tY); ctx.lineTo(width - 15, tY); strokeCheck(ctx);
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(15, tY + 3); ctx.lineTo(width - 15, tY + 3); strokeCheck(ctx);

  // Divide title block into sections
  const col1 = 15;
  const col2 = 280;
  const col3 = 540;
  const col4 = width - 15 - 180;

  // Grid lines inside title block
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(col2, tY + 3); ctx.lineTo(col2, height - 15);
  ctx.moveTo(col3, tY + 3); ctx.lineTo(col3, height - 15);
  ctx.moveTo(col4, tY + 3); ctx.lineTo(col4, height - 15);
  ctx.stroke();

  // Column 1: App Info
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('DECKFORGE BLUEPRINTS', col1 + 15, tY + 28);
  ctx.fillStyle = '#64748b';
  ctx.font = '500 8px "Inter", sans-serif';
  ctx.fillText('PERMIT-READY CONSTRUCTION SCHEMATIC', col1 + 15, tY + 44);
  ctx.fillText('COMPLIANT WITH IRC SECTION R507', col1 + 15, tY + 54);

  // Column 2: Project Specifications
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 7px "Inter", sans-serif';
  ctx.fillText('PROJECT NAME:', col2 + 15, tY + 18);
  ctx.fillText('LUMBER SPECIES:', col2 + 15, tY + 34);
  ctx.fillText('JOIST CONFIGURATION:', col2 + 15, tY + 50);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10px "Inter", sans-serif';
  ctx.fillText((projectName || 'UNTITLED PROJECT').toUpperCase(), col2 + 15, tY + 28);
  ctx.fillText((materials.species || 'SYP (SOUTHERN YELLOW PINE)').toUpperCase(), col2 + 15, tY + 44);
  ctx.fillText(`${materials.joistSize} @ ${materials.joistSpacing}" O.C.`, col2 + 15, tY + 60);

  // Column 3: Stats
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 7px "Inter", sans-serif';
  ctx.fillText('TOTAL AREA:', col3 + 15, tY + 18);
  ctx.fillText('BEAM CONFIGURATION:', col3 + 15, tY + 34);
  ctx.fillText('POST FOOTINGS:', col3 + 15, tY + 50);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10px "Inter", sans-serif';
  const totalSqft = sections.reduce((sum, s) => sum + (s.width * s.depth / 144), 0);
  ctx.fillText(`${Math.round(totalSqft)} SQ FT`, col3 + 15, tY + 28);
  ctx.fillText(materials.beamConfig || 'DOUBLE 2x10', col3 + 15, tY + 44);
  const footingSize = sectionCalcs[sections[0]?.id]?.footings?.diameter || 12;
  ctx.fillText(`${footingSize}" DIAMETER`, col3 + 15, tY + 60);

  // Column 4: Stamp / Date / Scale
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 7px "Inter", sans-serif';
  ctx.fillText('DATE OF EMISSION:', col4 + 15, tY + 18);
  ctx.fillText('PLAN SCALE:', col4 + 15, tY + 34);
  ctx.fillText('STATUS:', col4 + 15, tY + 50);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 9px "Inter", sans-serif';
  ctx.fillText(new Date().toLocaleDateString().toUpperCase(), col4 + 15, tY + 28);
  ctx.fillText(`AUTO-SCALED FIT (S=${S.toFixed(2)})`, col4 + 15, tY + 44);
  ctx.fillStyle = '#16a34a';
  ctx.fillText('PERMIT ESTIMATE - COMPLIANT', col4 + 15, tY + 60);
}

function strokeCheck(ctx) {
  ctx.stroke();
}
