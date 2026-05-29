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
export function hitTestSection(mx, my, sections, S, panX, panY, cw, ch) {
  const ox = (cw / 2) + panX, oy = (ch / 2) + panY;
  const lx = (mx - ox) / S;
  const ly = (my - oy) / S;
  for (let i = sections.length - 1; i >= 0; i--) {
    const sec = sections[i];
    if (isPointInPolygon(lx, ly, sec.vertices)) return sec.id;
  }
  return null;
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
