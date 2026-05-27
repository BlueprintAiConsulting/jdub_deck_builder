/**
 * Geometric validation utilities for Canvas 2D/3D Deck Builder.
 * Validates self-intersections and polygon overlaps.
 */

export function orientation(p, q, r) {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0; // collinear
  return (val > 0) ? 1 : 2; // clock or counterclock
}

export function onSegment(p, q, r) {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
         q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

export function segmentsIntersect(p1, q1, p2, q2) {
  const sharesP1P2 = (p1.x === p2.x && p1.y === p2.y);
  const sharesP1Q2 = (p1.x === q2.x && p1.y === q2.y);
  const sharesQ1P2 = (q1.x === p2.x && q1.y === p2.y);
  const sharesQ1Q2 = (q1.x === q2.x && q1.y === q2.y);

  const numShared = (sharesP1P2 ? 1 : 0) + (sharesP1Q2 ? 1 : 0) + (sharesQ1P2 ? 1 : 0) + (sharesQ1Q2 ? 1 : 0);

  if (numShared === 2) return true; // Same segment

  if (numShared === 1) {
    let shared, other1, other2;
    if (sharesP1P2) { shared = p1; other1 = q1; other2 = q2; }
    else if (sharesP1Q2) { shared = p1; other1 = q1; other2 = p2; }
    else if (sharesQ1P2) { shared = q1; other1 = p1; other2 = q2; }
    else { shared = q1; other1 = p1; other2 = p2; }

    if (orientation(shared, other1, other2) === 0) {
      if (onSegment(shared, other1, other2) || onSegment(shared, other2, other1)) {
        return true;
      }
    }
    return false;
  }

  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

export function isPolygonSelfIntersecting(vertices) {
  if (!vertices || vertices.length < 4) return false;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const q1 = vertices[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if ((j + 1) % n === i || (i + 1) % n === j) continue;
      const p2 = vertices[j];
      const q2 = vertices[(j + 1) % n];
      if (segmentsIntersect(p1, q1, p2, q2)) {
        return true;
      }
    }
  }
  return false;
}

export function hasDuplicateVertices(vertices) {
  if (!vertices) return false;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (vertices[i].x === vertices[j].x && vertices[i].y === vertices[j].y) {
        return true;
      }
    }
  }
  return false;
}

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

export function isPointOnPolygonBoundary(p, vertices) {
  if (!vertices) return false;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];
    if (orientation(v1, p, v2) === 0 && onSegment(v1, p, v2)) {
      return true;
    }
  }
  return false;
}

export function isPointStrictlyInside(p, vertices) {
  if (isPointOnPolygonBoundary(p, vertices)) return false;
  return isPointInPolygon(p.x, p.y, vertices);
}

export function arePolygonsIdentical(polyA, polyB) {
  if (!polyA || !polyB || polyA.length !== polyB.length) return false;
  const n = polyA.length;
  for (let i = 0; i < n; i++) {
    let matchForward = true;
    for (let j = 0; j < n; j++) {
      const a = polyA[j];
      const b = polyB[(i + j) % n];
      if (a.x !== b.x || a.y !== b.y) {
        matchForward = false;
        break;
      }
    }
    if (matchForward) return true;

    let matchBackward = true;
    for (let j = 0; j < n; j++) {
      const a = polyA[j];
      const b = polyB[(i - j + n) % n];
      if (a.x !== b.x || a.y !== b.y) {
        matchBackward = false;
        break;
      }
    }
    if (matchBackward) return true;
  }
  return false;
}

export function doEdgesCross(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  return (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4);
}

export function doPolygonsOverlap(polyA, polyB) {
  if (arePolygonsIdentical(polyA, polyB)) return true;

  for (const p of polyA) {
    if (isPointStrictlyInside(p, polyB)) return true;
  }
  for (const p of polyB) {
    if (isPointStrictlyInside(p, polyA)) return true;
  }

  const nA = polyA.length;
  const nB = polyB.length;
  for (let i = 0; i < nA; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % nA];
    for (let j = 0; j < nB; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % nB];
      if (doEdgesCross(a1, a2, b1, b2)) return true;
    }
  }

  for (let i = 0; i < nA; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % nA];
    const mid = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2 };
    if (isPointStrictlyInside(mid, polyB)) return true;
  }

  for (let i = 0; i < nB; i++) {
    const b1 = polyB[i];
    const b2 = polyB[(i + 1) % nB];
    const mid = { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2 };
    if (isPointStrictlyInside(mid, polyA)) return true;
  }

  return false;
}

export function validateSectionsState(sections) {
  if (!sections) return true;
  for (const sec of sections) {
    if (hasDuplicateVertices(sec.vertices)) return false;
    if (isPolygonSelfIntersecting(sec.vertices)) return false;
  }

  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      if (doPolygonsOverlap(sections[i].vertices, sections[j].vertices)) {
        return false;
      }
    }
  }

  return true;
}
