/**
 * Polygon and Geometry Utilities for DeckForge
 * Standard 2D calculations for hit-testing and edge splitting.
 */

/**
 * Validates whether a point (px, py) lies inside a polygon defined by an array of vertices.
 * Uses the ray-casting algorithm (Jordan curve theorem).
 */
export function isPointInPolygon(px, py, vertices) {
  if (!vertices || vertices.length < 3) return false;
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;

    const intersect = ((yi > py) !== (yj > py))
        && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Hit-test to find which section was clicked under point (mx, my) in canvas coordinates.
 */
export function hitTestSection(mx, my, sections, S, panX, panY, cw, ch, sectionCalcs = {}) {
  const ox = (cw / 2) + panX, oy = (ch / 2) + panY;
  const lx = (mx - ox) / S;
  const ly = (my - oy) / S;
  for (let i = sections.length - 1; i >= 0; i--) {
    const sec = sections[i];
    // 1. Check main boundary
    if (isPointInPolygon(lx, ly, sec.vertices)) return sec.id;
    
    // 2. Check attached stairs bounding box
    const calcs = sectionCalcs[sec.id];
    if (sec.stairs && calcs && calcs.stairs) {
      const st = calcs.stairs;
      const stairDir = typeof sec.stairs === 'string' ? sec.stairs : (sec.stairs.direction || 's');
      const stairW = st.width;
      const stairD = st.totalRun;
      let stX, stY;
      const align = (typeof sec.stairs === 'object' && sec.stairs?.align) || 'center';
      const offset = (typeof sec.stairs === 'object' && typeof sec.stairs.offset === 'number') ? sec.stairs.offset : null;
      
      if (stairDir === 's') {
        if (offset !== null) stX = sec.x + offset;
        else if (align === 'left') stX = sec.x;
        else if (align === 'right') stX = sec.x + sec.width - stairW;
        else stX = sec.x + sec.width / 2 - stairW / 2;
        stY = sec.y + sec.depth;
      } else if (stairDir === 'n') {
        if (offset !== null) stX = sec.x + offset;
        else if (align === 'left') stX = sec.x;
        else if (align === 'right') stX = sec.x + sec.width - stairW;
        else stX = sec.x + sec.width / 2 - stairW / 2;
        stY = sec.y - stairD;
      } else if (stairDir === 'e') {
        stX = sec.x + sec.width;
        if (offset !== null) stY = sec.y + offset;
        else if (align === 'left') stY = sec.y;
        else if (align === 'right') stY = sec.y + sec.depth - stairW;
        else stY = sec.y + sec.depth / 2 - stairW / 2;
      } else {
        stX = sec.x - stairD;
        if (offset !== null) stY = sec.y + offset;
        else if (align === 'left') stY = sec.y;
        else if (align === 'right') stY = sec.y + sec.depth - stairW;
        else stY = sec.y + sec.depth / 2 - stairW / 2;
      }
      
      const isVert = stairDir === 'n' || stairDir === 's';
      const sW = isVert ? stairW : stairD;
      const sD = isVert ? stairD : stairW;
      
      if (lx >= stX && lx <= stX + sW && ly >= stY && ly <= stY + sD) {
        return sec.id;
      }
    }
    
    // 3. Check attached ramp bounding box
    if (sec.ramp && calcs && calcs.ramp) {
      const rm = calcs.ramp;
      const rampDir = typeof sec.ramp === 'string' ? sec.ramp : (sec.ramp.direction || 's');
      const rampW = rm.width;
      const footprintRun = rm.run + 60 * (rm.intermediateLandings || 0);
      const rampD = footprintRun;
      let rmX, rmY;
      const align = (typeof sec.ramp === 'object' && sec.ramp?.align) || 'center';
      const offset = (typeof sec.ramp === 'object' && typeof sec.ramp.offset === 'number') ? sec.ramp.offset : null;
      
      if (rampDir === 's') {
        if (offset !== null) rmX = sec.x + offset;
        else if (align === 'left') rmX = sec.x;
        else if (align === 'right') rmX = sec.x + sec.width - rampW;
        else rmX = sec.x + sec.width / 2 - rampW / 2;
        rmY = sec.y + sec.depth;
      } else if (rampDir === 'n') {
        if (offset !== null) rmX = sec.x + offset;
        else if (align === 'left') rmX = sec.x;
        else if (align === 'right') rmX = sec.x + sec.width - rampW;
        else rmX = sec.x + sec.width / 2 - rampW / 2;
        rmY = sec.y - rampD;
      } else if (rampDir === 'e') {
        rmX = sec.x + sec.width;
        if (offset !== null) rmY = sec.y + offset;
        else if (align === 'left') rmY = sec.y;
        else if (align === 'right') rmY = sec.y + sec.depth - rampW;
        else rmY = sec.y + sec.depth / 2 - rampW / 2;
      } else {
        rmX = sec.x - rampD;
        if (offset !== null) rmY = sec.y + offset;
        else if (align === 'left') rmY = sec.y;
        else if (align === 'right') rmY = sec.y + sec.depth - rampW;
        else rmY = sec.y + sec.depth / 2 - rampW / 2;
      }
      
      const isVert = rampDir === 'n' || rampDir === 's';
      const rW = isVert ? rampW : rampD;
      const rD = isVert ? rampD : rampW;
      
      if (lx >= rmX && lx <= rmX + rW && ly >= rmY && ly <= rmY + rD) {
        return sec.id;
      }
    }
  }
  return null;
}

/**
 * Hit-test to find specifically which sub-object (deck section body, stairs, ramp) was clicked.
 * Returns { id: sectionId, type: 'deck' | 'stairs' | 'ramp' } or null.
 */
export function hitTestSubObject(mx, my, sections, S, panX, panY, cw, ch, sectionCalcs = {}) {
  const ox = (cw / 2) + panX, oy = (ch / 2) + panY;
  const lx = (mx - ox) / S;
  const ly = (my - oy) / S;
  for (let i = sections.length - 1; i >= 0; i--) {
    const sec = sections[i];
    const calcs = sectionCalcs[sec.id];
    
    // Check attached stairs first
    if (sec.stairs && calcs && calcs.stairs) {
      const st = calcs.stairs;
      const stairDir = typeof sec.stairs === 'string' ? sec.stairs : (sec.stairs.direction || 's');
      const stairW = st.width;
      const stairD = st.totalRun;
      let stX, stY;
      const align = (typeof sec.stairs === 'object' && sec.stairs?.align) || 'center';
      const offset = (typeof sec.stairs === 'object' && typeof sec.stairs.offset === 'number') ? sec.stairs.offset : null;
      
      if (stairDir === 's') {
        if (offset !== null) stX = sec.x + offset;
        else if (align === 'left') stX = sec.x;
        else if (align === 'right') stX = sec.x + sec.width - stairW;
        else stX = sec.x + sec.width / 2 - stairW / 2;
        stY = sec.y + sec.depth;
      } else if (stairDir === 'n') {
        if (offset !== null) stX = sec.x + offset;
        else if (align === 'left') stX = sec.x;
        else if (align === 'right') stX = sec.x + sec.width - stairW;
        else stX = sec.x + sec.width / 2 - stairW / 2;
        stY = sec.y - stairD;
      } else if (stairDir === 'e') {
        stX = sec.x + sec.width;
        if (offset !== null) stY = sec.y + offset;
        else if (align === 'left') stY = sec.y;
        else if (align === 'right') stY = sec.y + sec.depth - stairW;
        else stY = sec.y + sec.depth / 2 - stairW / 2;
      } else {
        stX = sec.x - stairD;
        if (offset !== null) stY = sec.y + offset;
        else if (align === 'left') stY = sec.y;
        else if (align === 'right') stY = sec.y + sec.depth - stairW;
        else stY = sec.y + sec.depth / 2 - stairW / 2;
      }
      
      const isVert = stairDir === 'n' || stairDir === 's';
      const sW = isVert ? stairW : stairD;
      const sD = isVert ? stairD : stairW;
      
      if (lx >= stX && lx <= stX + sW && ly >= stY && ly <= stY + sD) {
        return { id: sec.id, type: 'stairs' };
      }
    }
    
    // Check attached ramp next
    if (sec.ramp && calcs && calcs.ramp) {
      const rm = calcs.ramp;
      const rampDir = typeof sec.ramp === 'string' ? sec.ramp : (sec.ramp.direction || 's');
      const rampW = rm.width;
      const footprintRun = rm.run + 60 * (rm.intermediateLandings || 0);
      const rampD = footprintRun;
      let rmX, rmY;
      const align = (typeof sec.ramp === 'object' && sec.ramp?.align) || 'center';
      const offset = (typeof sec.ramp === 'object' && typeof sec.ramp.offset === 'number') ? sec.ramp.offset : null;
      
      if (rampDir === 's') {
        if (offset !== null) rmX = sec.x + offset;
        else if (align === 'left') rmX = sec.x;
        else if (align === 'right') rmX = sec.x + sec.width - rampW;
        else rmX = sec.x + sec.width / 2 - rampW / 2;
        rmY = sec.y + sec.depth;
      } else if (rampDir === 'n') {
        if (offset !== null) rmX = sec.x + offset;
        else if (align === 'left') rmX = sec.x;
        else if (align === 'right') rmX = sec.x + sec.width - rampW;
        else rmX = sec.x + sec.width / 2 - rampW / 2;
        rmY = sec.y - rampD;
      } else if (rampDir === 'e') {
        rmX = sec.x + sec.width;
        if (offset !== null) rmY = sec.y + offset;
        else if (align === 'left') rmY = sec.y;
        else if (align === 'right') rmY = sec.y + sec.depth - rampW;
        else rmY = sec.y + sec.depth / 2 - rampW / 2;
      } else {
        rmX = sec.x - rampD;
        if (offset !== null) rmY = sec.y + offset;
        else if (align === 'left') rmY = sec.y;
        else if (align === 'right') rmY = sec.y + sec.depth - rampW;
        else rmY = sec.y + sec.depth / 2 - rampW / 2;
      }
      
      const isVert = rampDir === 'n' || rampDir === 's';
      const rW = isVert ? rampW : rampD;
      const rD = isVert ? rampD : rampW;
      
      if (lx >= rmX && lx <= rmX + rW && ly >= rmY && ly <= rmY + rD) {
        return { id: sec.id, type: 'ramp' };
      }
    }
    
    // Check main deck body last
    if (isPointInPolygon(lx, ly, sec.vertices)) {
      // Check posts
      if (calcs && calcs.posts && calcs.posts.posts) {
        for (const post of calcs.posts.posts) {
          const px = sec.x + post.x;
          const py = sec.y + post.y;
          const dist = Math.sqrt((lx - px) ** 2 + (ly - py) ** 2);
          if (dist < 10) {
            return { id: sec.id, type: 'post' };
          }
        }
      }

      // Check beams
      if (calcs && calcs.beams && calcs.beams.positions) {
        const joistsVertical = (sec.joistOrientation !== 'horizontal');
        if (joistsVertical) {
          for (const yIn of calcs.beams.positions) {
            const by = sec.y + yIn;
            if (lx >= sec.x && lx <= sec.x + sec.width && Math.abs(ly - by) < 6) {
              return { id: sec.id, type: 'beam' };
            }
          }
        } else {
          for (const xIn of calcs.beams.positions) {
            const bx = sec.x + xIn;
            if (ly >= sec.y && ly <= sec.y + sec.depth && Math.abs(lx - bx) < 6) {
              return { id: sec.id, type: 'beam' };
            }
          }
        }
      }

      // Check railings
      if (sec.railings) {
        if (sec.railings.n && lx >= sec.x && lx <= sec.x + sec.width && Math.abs(ly - sec.y) < 8) {
          return { id: sec.id, type: 'railing-n' };
        }
        if (sec.railings.s && lx >= sec.x && lx <= sec.x + sec.width && Math.abs(ly - (sec.y + sec.depth)) < 8) {
          return { id: sec.id, type: 'railing-s' };
        }
        if (sec.railings.e && ly >= sec.y && ly <= sec.y + sec.depth && Math.abs(lx - (sec.x + sec.width)) < 8) {
          return { id: sec.id, type: 'railing-e' };
        }
        if (sec.railings.w && ly >= sec.y && ly <= sec.y + sec.depth && Math.abs(lx - sec.x) < 8) {
          return { id: sec.id, type: 'railing-w' };
        }
      }

      // Check joists
      if (calcs && calcs.joists && calcs.joists.positions) {
        const joistsVertical = (sec.joistOrientation !== 'horizontal');
        if (joistsVertical) {
          for (const xIn of calcs.joists.positions) {
            const jx = sec.x + xIn;
            if (ly >= sec.y && ly <= sec.y + sec.depth && Math.abs(lx - jx) < 4) {
              return { id: sec.id, type: 'joist' };
            }
          }
        } else {
          for (const yIn of calcs.joists.positions) {
            const jy = sec.y + yIn;
            if (lx >= sec.x && lx <= sec.x + sec.width && Math.abs(ly - jy) < 4) {
              return { id: sec.id, type: 'joist' };
            }
          }
        }
      }

      return { id: sec.id, type: 'deck' };
    }
  }
  return null;
}

/**
 * Gets the offset of a stair or ramp sub-object along its edge axis in inches.
 */
export function getSubObjectOffset(sec, type) {
  if (type === 'stairs') {
    const st = sec.stairs;
    if (!st) return 0;
    if (typeof st === 'object' && typeof st.offset === 'number') {
      return st.offset;
    }
    const stairDir = typeof st === 'string' ? st : (st.direction || 's');
    const align = (typeof st === 'object' && st.align) || 'center';
    const stairW = (typeof st === 'object' && st.width) || 36;
    const isVert = stairDir === 'n' || stairDir === 's';
    const totalLength = isVert ? sec.width : sec.depth;
    if (align === 'left') return 0;
    if (align === 'right') return totalLength - stairW;
    return totalLength / 2 - stairW / 2;
  } else if (type === 'ramp') {
    const rm = sec.ramp;
    if (!rm) return 0;
    if (typeof rm === 'object' && typeof rm.offset === 'number') {
      return rm.offset;
    }
    const rampDir = typeof rm === 'string' ? rm : (rm.direction || 's');
    const align = (typeof rm === 'object' && rm.align) || 'center';
    const rampW = (typeof rm === 'object' && rm.width) || 36;
    const isVert = rampDir === 'n' || rampDir === 's';
    const totalLength = isVert ? sec.width : sec.depth;
    if (align === 'left') return 0;
    if (align === 'right') return totalLength - rampW;
    return totalLength / 2 - rampW / 2;
  }
  return 0;
}

/**
 * Calculates the shortest distance from point (px, py) to line segment (ax, ay) -> (bx, by).
 */
export function getDistanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Finds the index of the edge nearest to (lx, ly).
 * Returns the index of the start vertex of the closest edge segment, or -1.
 */
export function findEdgeSplitIndex(lx, ly, vertices, thresholdInches) {
  if (!vertices || vertices.length < 3) return -1;
  let bestIndex = -1;
  let minDistance = thresholdInches;
  
  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];
    const dist = getDistanceToSegment(lx, ly, v1.x, v1.y, v2.x, v2.y);
    if (dist < minDistance) {
      minDistance = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}
