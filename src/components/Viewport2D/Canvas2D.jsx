import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDeckStore } from '../../store/deckStore';
import { formatDimension } from '../../utils/units';
import { WOOD_COLORS } from '../Materials/materialData';
import { drawDimensionLine } from '../../utils/blueprintRenderer';
import './Canvas2D.css';

const SCALE = 3;
const HANDLE_SIZE = 8;
const HANDLES = ['nw','n','ne','e','se','s','sw','w'];

function drawVerticesPath(ctx, vertices, S, ox, oy, offsetPixels = 0) {
  if (!vertices || vertices.length === 0) return;
  ctx.beginPath();
  
  if (vertices.length === 4 && offsetPixels !== 0) {
    const xs = vertices.map(v => v.x * S + ox);
    const ys = vertices.map(v => v.y * S + oy);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    
    ctx.moveTo(minX + offsetPixels, minY + offsetPixels);
    ctx.lineTo(maxX - offsetPixels, minY + offsetPixels);
    ctx.lineTo(maxX - offsetPixels, maxY - offsetPixels);
    ctx.lineTo(minX + offsetPixels, maxY - offsetPixels);
  } else {
    const startX = (vertices[0].x * S) + ox;
    const startY = (vertices[0].y * S) + oy;
    ctx.moveTo(startX, startY);
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo((vertices[i].x * S) + ox, (vertices[i].y * S) + oy);
    }
  }
  ctx.closePath();
}

function getHandlePositions(sec, S) {
  const x = sec.x * S, y = sec.y * S, w = sec.width * S, d = sec.depth * S;
  return {
    nw: { cx: x, cy: y }, n: { cx: x + w/2, cy: y }, ne: { cx: x + w, cy: y },
    e: { cx: x + w, cy: y + d/2 }, se: { cx: x + w, cy: y + d },
    s: { cx: x + w/2, cy: y + d }, sw: { cx: x, cy: y + d }, w: { cx: x, cy: y + d/2 },
  };
}

function hitTestHandles(mx, my, sec, S, panX, panY, cw, ch) {
  const handles = getHandlePositions(sec, S);
  const ox = (cw / 2) + panX, oy = (ch / 2) + panY;
  for (const [key, pos] of Object.entries(handles)) {
    if (Math.abs(mx - (pos.cx + ox)) < HANDLE_SIZE + 2 && Math.abs(my - (pos.cy + oy)) < HANDLE_SIZE + 2) return key;
  }
  return null;
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

export function hitTestVertices(mx, my, vertices, S, panX, panY, cw, ch) {
  if (!vertices) return -1;
  const ox = (cw / 2) + panX, oy = (ch / 2) + panY;
  const handleRadius = 6;
  for (let i = 0; i < vertices.length; i++) {
    const vx = vertices[i].x * S + ox;
    const vy = vertices[i].y * S + oy;
    if (Math.abs(mx - vx) < handleRadius + 3 && Math.abs(my - vy) < handleRadius + 3) {
      return i;
    }
  }
  return -1;
}

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

function getNearestEdge(mx, my, sec, S, panX, panY, cw, ch) {
  const ox = (cw / 2) + panX, oy = (ch / 2) + panY;
  const sx = sec.x * S + ox, sy = sec.y * S + oy;
  const sw = sec.width * S, sd = sec.depth * S;
  const dists = {
    n: Math.abs(my - sy), s: Math.abs(my - (sy + sd)),
    w: Math.abs(mx - sx), e: Math.abs(mx - (sx + sw)),
  };
  return Object.entries(dists).sort((a, b) => a[1] - b[1])[0][0];
}

export default function Canvas2D({ isMobile }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const lastTouchDistRef = useRef(null);
  const [zoomScale, setZoomScale] = useState(1);

  const theme = useDeckStore((s) => s.theme);
  const sections = useDeckStore((s) => s.sections);
  const selectedSectionId = useDeckStore((s) => s.selectedSectionId);
  const attachStairs = useDeckStore((s) => s.attachStairs);
  const attachRamp = useDeckStore((s) => s.attachRamp);
  const removeVertex = useDeckStore((s) => s.removeVertex);
  const showGrid = useDeckStore((s) => s.showGrid);
  const showDimensions = useDeckStore((s) => s.showDimensions);
  const selectedTool = useDeckStore((s) => s.selectedTool);
  const interaction = useDeckStore((s) => s.interaction);
  const selectSection = useDeckStore((s) => s.selectSection);
  const sectionCalcs = useDeckStore((s) => s.sectionCalcs);
  const materials = useDeckStore((s) => s.materials);
  const addSection = useDeckStore((s) => s.addSection);
  const moveSection = useDeckStore((s) => s.moveSection);
  const finishMove = useDeckStore((s) => s.finishMove);
  const resizeSection = useDeckStore((s) => s.resizeSection);
  const setInteraction = useDeckStore((s) => s.setInteraction);
  const toggleRailing = useDeckStore((s) => s.toggleRailing);
  const dragVertex = useDeckStore((s) => s.dragVertex);
  const finishVertexDrag = useDeckStore((s) => s.finishVertexDrag);
  const addVertex = useDeckStore((s) => s.addVertex);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const S = SCALE * zoomScale;

  // --- Mouse handlers ---
  const handleMouseDown = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    if (selectedTool === 'rectangle' || selectedTool === 'landing') {
      setInteraction({ mode: 'placing', dragStart: { x: mx, y: my }, ghostRect: { x: mx, y: my, w: 0, h: 0 } });
      return;
    }

    if (selectedTool === 'select') {
      const sel = sections.find((s) => s.id === selectedSectionId);
      if (sel) {
        // Check vertex handles first
        const vIdx = hitTestVertices(mx, my, sel.vertices, S, panOffset.x, panOffset.y, size.w, size.h);
        if (vIdx !== -1) {
          setInteraction({
            mode: 'dragging_vertex',
            vertexIndex: vIdx,
            dragStart: { x: mx, y: my },
            selectedVertexIndex: vIdx
          });
          return;
        }

        // Check resize handles
        const handle = hitTestHandles(mx, my, sel, S, panOffset.x, panOffset.y, size.w, size.h);
        if (handle) {
          setInteraction({ mode: 'resizing', resizeHandle: handle, dragStart: { x: mx, y: my } });
          return;
        }
      }
      const hitId = hitTestSection(mx, my, sections, S, panOffset.x, panOffset.y, size.w, size.h);
      if (hitId) {
        selectSection(hitId);
        setInteraction({ mode: 'moving', dragStart: { x: mx, y: my } });
      } else {
        selectSection(null);
        setInteraction({ mode: 'idle', dragStart: null, selectedVertexIndex: null });
      }
      return;
    }

    if (selectedTool === 'railing' || selectedTool === 'stairs' || selectedTool === 'ramp') {
      const hitId = hitTestSection(mx, my, sections, S, panOffset.x, panOffset.y, size.w, size.h);
      if (hitId) {
        const sec = sections.find((s) => s.id === hitId);
        const edge = getNearestEdge(mx, my, sec, S, panOffset.x, panOffset.y, size.w, size.h);
        if (selectedTool === 'railing') toggleRailing(hitId, edge);
        else if (selectedTool === 'stairs') attachStairs(hitId, edge);
        else attachRamp(hitId, edge);
      }
    }
  }, [selectedTool, sections, selectedSectionId, S, panOffset, size, selectSection, setInteraction, toggleRailing, attachStairs, attachRamp]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      const dx = e.clientX - lastMouseRef.current.x, dy = e.clientY - lastMouseRef.current.y;
      setPanOffset((p) => ({ x: p.x + dx, y: p.y + dy }));
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (interaction.mode === 'placing' && interaction.dragStart) {
      setInteraction({ ghostRect: { x: interaction.dragStart.x, y: interaction.dragStart.y, w: mx - interaction.dragStart.x, h: my - interaction.dragStart.y } });
    }
    if (interaction.mode === 'dragging_vertex' && selectedSectionId) {
      const ox = size.w / 2 + panOffset.x;
      const oy = size.h / 2 + panOffset.y;
      const newX = (mx - ox) / S;
      const newY = (my - oy) / S;
      dragVertex(selectedSectionId, interaction.vertexIndex, newX, newY);
      return;
    }
    if (interaction.mode === 'moving' && interaction.dragStart && selectedSectionId) {
      const sec = sections.find((s) => s.id === selectedSectionId);
      if (!sec) return;
      const dx = (mx - interaction.dragStart.x) / S, dy = (my - interaction.dragStart.y) / S;
      moveSection(selectedSectionId, sec.x + dx, sec.y + dy);
      setInteraction({ dragStart: { x: mx, y: my } });
    }
    if (interaction.mode === 'resizing' && interaction.dragStart && selectedSectionId) {
      const sec = sections.find((s) => s.id === selectedSectionId);
      if (!sec) return;
      const dx = (mx - interaction.dragStart.x) / S, dy = (my - interaction.dragStart.y) / S;
      const h = interaction.resizeHandle;
      const u = {};
      if (h.includes('e')) u.width = sec.width + dx;
      if (h.includes('w')) { u.x = sec.x + dx; u.width = sec.width - dx; }
      if (h.includes('s')) u.depth = sec.depth + dy;
      if (h.includes('n')) { u.y = sec.y + dy; u.depth = sec.depth - dy; }
      resizeSection(selectedSectionId, u);
    }
  }, [isPanning, interaction, selectedSectionId, sections, S, setInteraction, moveSection, resizeSection, dragVertex, size.w, size.h, panOffset.x, panOffset.y]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) { setIsPanning(false); return; }
    if (interaction.mode === 'placing' && interaction.ghostRect) {
      const g = interaction.ghostRect;
      const ox = size.w / 2 + panOffset.x, oy = size.h / 2 + panOffset.y;
      const absW = Math.abs(g.w), absH = Math.abs(g.h);
      const rx = (Math.min(g.x, g.x + g.w) - ox) / S;
      const ry = (Math.min(g.y, g.y + g.h) - oy) / S;
      const type = selectedTool === 'landing' ? 'landing' : 'deck';
      if (absW > 20 && absH > 20) {
        addSection({ x: rx, y: ry, width: absW / S, depth: absH / S }, type);
      } else {
        const defW = type === 'landing' ? 36 : 144;
        const defD = type === 'landing' ? 36 : 120;
        addSection({ x: rx - defW / 2, y: ry - defD / 2, width: defW, depth: defD }, type);
      }
      setInteraction({ mode: 'idle', dragStart: null, ghostRect: null });
    }
    if (interaction.mode === 'dragging_vertex') finishVertexDrag();
    if (interaction.mode === 'moving') finishMove();
    if (interaction.mode === 'resizing') setInteraction({ mode: 'idle', dragStart: null, resizeHandle: null });
  }, [isPanning, interaction, size, panOffset, S, addSection, finishMove, setInteraction, finishVertexDrag]);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top;
      if (selectedTool === 'rectangle' || selectedTool === 'landing') {
        const type = selectedTool === 'landing' ? 'landing' : 'deck';
        const defW = type === 'landing' ? 36 : 144;
        const defD = type === 'landing' ? 36 : 120;
        addSection({
          x: (mx - size.w/2 - panOffset.x) / S - defW / 2,
          y: (my - size.h/2 - panOffset.y) / S - defD / 2,
          width: defW,
          depth: defD
        }, type);
        return;
      }
      if (selectedTool === 'select') {
        const hitId = hitTestSection(mx, my, sections, S, panOffset.x, panOffset.y, size.w, size.h);
        if (hitId) { selectSection(hitId); setInteraction({ mode: 'moving', dragStart: { x: mx, y: my } }); }
        else { setIsPanning(true); lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
        return;
      }
      setIsPanning(true);
      lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      lastTouchDistRef.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, [selectedTool, sections, S, panOffset, size, selectSection, addSection, setInteraction]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      if (interaction.mode === 'moving' && selectedSectionId) {
        const rect = containerRef.current.getBoundingClientRect();
        const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top;
        const sec = sections.find((s) => s.id === selectedSectionId);
        if (sec) {
          const dx = (mx - interaction.dragStart.x) / S, dy = (my - interaction.dragStart.y) / S;
          moveSection(selectedSectionId, sec.x + dx, sec.y + dy);
          setInteraction({ dragStart: { x: mx, y: my } });
        }
      } else if (isPanning) {
        const dx = e.touches[0].clientX - lastMouseRef.current.x, dy = e.touches[0].clientY - lastMouseRef.current.y;
        setPanOffset((p) => ({ x: p.x + dx, y: p.y + dy }));
        lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    } else if (e.touches.length === 2 && lastTouchDistRef.current) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setZoomScale((p) => Math.min(3, Math.max(0.3, p * (dist / lastTouchDistRef.current))));
      lastTouchDistRef.current = dist;
    }
  }, [isPanning, interaction, selectedSectionId, sections, S, moveSection, setInteraction]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    lastTouchDistRef.current = null;
    if (interaction.mode === 'moving') finishMove();
  }, [interaction, finishMove]);

  // Global keyboard listener to delete active vertex via Backspace/Delete keys
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input, select') && selectedSectionId) {
        const sec = sections.find((s) => s.id === selectedSectionId);
        if (sec && interaction.selectedVertexIndex !== null && interaction.selectedVertexIndex !== undefined) {
          if (sec.vertices.length <= 3) {
            alert("A deck section must have at least 3 vertices to remain a valid polygon.");
            return;
          }
          removeVertex(selectedSectionId, interaction.selectedVertexIndex);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedSectionId, sections, interaction.selectedVertexIndex, removeVertex]);

  // Double-click to split polygon edge
  const handleDoubleClick = useCallback((e) => {
    if (selectedTool !== 'select' || !selectedSectionId) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    const ox = size.w / 2 + panOffset.x;
    const oy = size.h / 2 + panOffset.y;
    const lx = (mx - ox) / S;
    const ly = (my - oy) / S;

    const sec = sections.find((s) => s.id === selectedSectionId);
    if (!sec) return;

    // Use split edge threshold (approx 12 layout inches)
    const thresholdInches = 12 / S;
    const splitIdx = findEdgeSplitIndex(lx, ly, sec.vertices, thresholdInches);

    if (splitIdx !== -1) {
      // Snapped to nearest 12-inch grid point
      const newV = {
        x: Math.round(lx / 12) * 12,
        y: Math.round(ly / 12) * 12
      };
      addVertex(selectedSectionId, splitIdx + 1, newV);
    }
  }, [selectedTool, selectedSectionId, sections, S, size, panOffset, addVertex]);

  // Right-click context menu to delete a vertex
  const handleContextMenu = useCallback((e) => {
    if (selectedTool !== 'select' || !selectedSectionId) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    const sec = sections.find((s) => s.id === selectedSectionId);
    if (!sec) return;

    const vIdx = hitTestVertices(mx, my, sec.vertices, S, panOffset.x, panOffset.y, size.w, size.h);
    if (vIdx !== -1) {
      e.preventDefault(); // Stop standard context menu if clicking handle
      if (sec.vertices.length <= 3) {
        alert("A deck section must have at least 3 vertices to remain a valid polygon.");
        return;
      }
      removeVertex(selectedSectionId, vIdx);
    }
  }, [selectedTool, selectedSectionId, sections, S, panOffset, size, removeVertex]);

  // --- DRAW ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.w, size.h);

    const ox = size.w / 2 + panOffset.x;
    const oy = size.h / 2 + panOffset.y;

    const isLightTheme = theme === 'light';

    // Background vignette
    const vg = ctx.createRadialGradient(size.w/2, size.h/2, size.w*0.1, size.w/2, size.h/2, size.w*0.8);
    if (isLightTheme) {
      vg.addColorStop(0, 'rgba(255, 255, 255, 0)');
      vg.addColorStop(1, 'rgba(148, 163, 184, 0.15)');
    } else {
      vg.addColorStop(0, 'rgba(12, 18, 33, 0)');
      vg.addColorStop(1, 'rgba(4, 6, 12, 0.5)');
    }
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, size.w, size.h);

    // Grid — minor (1ft) + major (4ft)
    if (showGrid) {
      const gs = 12 * S;
      // Minor gridlines (1ft)
      ctx.strokeStyle = isLightTheme ? 'rgba(15, 23, 42, 0.05)' : 'rgba(30, 50, 90, 0.15)';
      ctx.lineWidth = 0.5;
      for (let x = ox % gs; x < size.w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke(); }
      for (let y = oy % gs; y < size.h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke(); }
      // Major gridlines (4ft)
      const gs4 = 48 * S;
      ctx.strokeStyle = isLightTheme ? 'rgba(15, 23, 42, 0.1)' : 'rgba(50, 80, 140, 0.25)';
      ctx.lineWidth = 1;
      for (let x = ox % gs4; x < size.w; x += gs4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke(); }
      for (let y = oy % gs4; y < size.h; y += gs4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke(); }
    }

    // Draw each section
    sections.forEach((sec) => {
      const calcs = sectionCalcs[sec.id];
      if (!calcs) return;
      const sx = sec.x * S + ox, sy = sec.y * S + oy;
      const sw = sec.width * S, sd = sec.depth * S;
      const isSelected = sec.id === selectedSectionId;
      const woodColor = WOOD_COLORS[materials.species] || '#c4a35a';

      // House wall
      if (sec.ledgerAttached) {
        const hh = 30 * zoomScale;
        ctx.fillStyle = isLightTheme ? '#e2e8f0' : '#2a2a3a';
        ctx.fillRect(sx - 20, sy - hh, sw + 40, hh);
        ctx.strokeStyle = isLightTheme ? '#cbd5e1' : '#444466';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - 20, sy - hh, sw + 40, hh);
        ctx.fillStyle = isLightTheme ? '#64748b' : '#888aaa';
        ctx.font = '600 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('HOUSE', sx + sw / 2, sy - hh / 2 + 3);
      }

      if (sec.type === 'landing') {
        // Landing surface
        ctx.fillStyle = isLightTheme ? 'rgba(2, 132, 199, 0.08)' : 'rgba(14, 165, 233, 0.12)';
        drawVerticesPath(ctx, sec.vertices, S, ox, oy);
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#1d4ed8' : (isLightTheme ? '#0284c7' : '#0ea5e9');
        ctx.lineWidth = isSelected ? 2.5 : 2;
        drawVerticesPath(ctx, sec.vertices, S, ox, oy);
        ctx.stroke();

        // Landing double border / pattern
        ctx.strokeStyle = isSelected ? '#3b82f6' : (isLightTheme ? '#0369a1' : '#38bdf8');
        ctx.lineWidth = 1;
        drawVerticesPath(ctx, sec.vertices, S, ox, oy, 4);
        ctx.stroke();

        // Label in the center
        ctx.fillStyle = isLightTheme ? '#0369a1' : '#38bdf8';
        ctx.font = '600 10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LANDING', sx + sw / 2, sy + sd / 2);
        ctx.textBaseline = 'alphabetic';
      } else {
        // Deck surface
        ctx.fillStyle = woodColor + '25';
        drawVerticesPath(ctx, sec.vertices, S, ox, oy);
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#1d4ed8' : (isLightTheme ? woodColor : woodColor + '80');
        ctx.lineWidth = isSelected ? 2.5 : 2;
        drawVerticesPath(ctx, sec.vertices, S, ox, oy);
        ctx.stroke();

        // Deck boards
        ctx.save();
        drawVerticesPath(ctx, sec.vertices, S, ox, oy);
        ctx.clip();

        const ys = sec.vertices.map(v => v.y * S + oy);
        const xs = sec.vertices.map(v => v.x * S + ox);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const minX = Math.min(...xs), maxX = Math.max(...xs);

        const bw = 5.5 * S, gap = 0.125 * S;
        ctx.strokeStyle = isLightTheme ? woodColor + '60' : woodColor + '40';
        ctx.lineWidth = 0.5;

        const deckingOpt = sec.deckingOrientation || 'perpendicular';
        const joistsVertical = (sec.joistOrientation !== 'horizontal');
        
        let drawMode = 'horizontal';
        if (deckingOpt === 'diagonal') {
          drawMode = 'diagonal';
        } else {
          if (joistsVertical) {
            drawMode = (deckingOpt === 'parallel') ? 'vertical' : 'horizontal';
          } else {
            drawMode = (deckingOpt === 'parallel') ? 'horizontal' : 'vertical';
          }
        }

        if (drawMode === 'horizontal') {
          for (let y = minY; y < maxY; y += bw + gap) {
            ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
          }
        } else if (drawMode === 'vertical') {
          for (let x = minX; x < maxX; x += bw + gap) {
            ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
          }
        } else if (drawMode === 'diagonal') {
          const step = (bw + gap) * Math.sqrt(2);
          for (let offset = minX + minY - (maxX - minX); offset < maxX + maxY + (maxX - minX); offset += step) {
            ctx.beginPath();
            ctx.moveTo(minX, offset - minX);
            ctx.lineTo(maxX, offset - maxX);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // House Wall (if ledger attached)
      if (sec.ledgerAttached) {
        ctx.fillStyle = isLightTheme ? '#cbd5e1' : '#334155';
        const wallThickness = 6 * S; // 6 inches thick
        const wallExtend = 24 * S; // extend 24 inches on each side
        ctx.fillRect(sx - wallExtend, sy - wallThickness, sw + wallExtend * 2, wallThickness);
        
        ctx.fillStyle = isLightTheme ? '#475569' : '#94a3b8';
        ctx.font = '600 12px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HOUSE WALL', sx + sw / 2, sy - wallThickness / 2);
        ctx.textBaseline = 'alphabetic';
      }

      const joistsVertical = (sec.joistOrientation !== 'horizontal');

      // Joists
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      if (joistsVertical) {
        calcs.joists.positions.forEach((xIn) => {
          const x = sx + xIn * S;
          if (x > sx + sw + 1) return;
          ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy + sd); ctx.stroke();
        });
      } else {
        calcs.joists.positions.forEach((yIn) => {
          const y = sy + yIn * S;
          if (y > sy + sd + 1) return;
          ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + sw, y); ctx.stroke();
        });
      }

      // Beams
      ctx.strokeStyle = isLightTheme ? '#d97706' : '#f59e0b';
      ctx.lineWidth = 3;
      if (joistsVertical) {
        calcs.beams.positions.forEach((yIn) => {
          const y = sy + yIn * S;
          ctx.beginPath(); ctx.moveTo(sx - 6, y); ctx.lineTo(sx + sw + 6, y); ctx.stroke();
        });
      } else {
        calcs.beams.positions.forEach((xIn) => {
          const x = sx + xIn * S;
          ctx.beginPath(); ctx.moveTo(x, sy - 6); ctx.lineTo(x, sy + sd + 6); ctx.stroke();
        });
      }

      // Posts
      calcs.posts.posts.forEach((post) => {
        const px = sx + post.x * S, py = sy + post.y * S;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(px - 3.5, py - 3.5, 7, 7);
      });

      // Railings
      Object.entries(sec.railings).forEach(([edge, on]) => {
        if (!on) return;
        ctx.strokeStyle = isLightTheme ? '#16a34a' : '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (edge === 'n') { ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); }
        if (edge === 's') { ctx.moveTo(sx, sy + sd); ctx.lineTo(sx + sw, sy + sd); }
        if (edge === 'w') { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sd); }
        if (edge === 'e') { ctx.moveTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + sd); }
        ctx.stroke();
      });

      // Stairs
      if (sec.stairs && calcs.stairs) {
        const st = calcs.stairs;
        const stairDir = typeof sec.stairs === 'string' ? sec.stairs : (sec.stairs.direction || 's');
        const stairW = st.width * S;
        const stairD = st.totalRun * S;
        ctx.fillStyle = isLightTheme ? 'rgba(219, 39, 119, 0.1)' : 'rgba(236, 72, 153, 0.15)';
        ctx.strokeStyle = isLightTheme ? '#db2777' : '#ec4899';
        ctx.lineWidth = 1.5;
        let stX, stY;
        const align = (typeof sec.stairs === 'object' && sec.stairs?.align) || 'center';
        if (stairDir === 's') {
          if (align === 'left') stX = sx;
          else if (align === 'right') stX = sx + sw - stairW;
          else stX = sx + sw / 2 - stairW / 2;
          stY = sy + sd;
        } else if (stairDir === 'n') {
          if (align === 'left') stX = sx;
          else if (align === 'right') stX = sx + sw - stairW;
          else stX = sx + sw / 2 - stairW / 2;
          stY = sy - stairD;
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
        // Treads
        const treadCount = st.numTreads;
        for (let i = 1; i < treadCount; i++) {
          const frac = i / treadCount;
          ctx.beginPath();
          if (isVert) { ctx.moveTo(stX, stY + sD * frac); ctx.lineTo(stX + sW, stY + sD * frac); }
          else { ctx.moveTo(stX + sW * frac, stY); ctx.lineTo(stX + sW * frac, stY + sD); }
          ctx.stroke();
        }
      }

      // Ramps
      if (sec.ramp && calcs.ramp) {
        const rm = calcs.ramp;
        const rampDir = typeof sec.ramp === 'string' ? sec.ramp : (sec.ramp.direction || 's');
        const rampW = rm.width * S;
        const rampD = rm.run * S;
        ctx.fillStyle = isLightTheme ? 'rgba(124, 58, 237, 0.1)' : 'rgba(139, 92, 246, 0.15)';
        ctx.strokeStyle = isLightTheme ? '#7c3aed' : '#a78bfa';
        ctx.lineWidth = 1.5;
        let rmX, rmY;
        const align = (typeof sec.ramp === 'object' && sec.ramp?.align) || 'center';
        if (rampDir === 's') {
          if (align === 'left') rmX = sx;
          else if (align === 'right') rmX = sx + sw - rampW;
          else rmX = sx + sw / 2 - rampW / 2;
          rmY = sy + sd;
        } else if (rampDir === 'n') {
          if (align === 'left') rmX = sx;
          else if (align === 'right') rmX = sx + sw - rampW;
          else rmX = sx + sw / 2 - rampW / 2;
          rmY = sy - rampD;
        } else if (rampDir === 'e') {
          rmX = sx + sw;
          if (align === 'left') rmY = sy;
          else if (align === 'right') rmY = sy + sd - rampW;
          else rmY = sy + sd / 2 - rampW / 2;
        } else {
          rmX = sx - rampD;
          if (align === 'left') rmY = sy;
          else if (align === 'right') rmY = sy + sd - rampW;
          else rmY = sy + sd / 2 - rampW / 2;
        }
        const isVert = rampDir === 'n' || rampDir === 's';
        const rW = isVert ? rampW : rampD;
        const rD = isVert ? rampD : rampW;
        ctx.fillRect(rmX, rmY, rW, rD);
        ctx.strokeRect(rmX, rmY, rW, rD);
        
        // Draw directional arrows or sloped lines inside the ramp
        ctx.beginPath();
        if (isVert) {
          const startY = rampDir === 's' ? rmY : rmY + rD;
          const endY = rampDir === 's' ? rmY + rD : rmY;
          const arrowX = rmX + rW / 2;
          ctx.moveTo(arrowX, startY);
          ctx.lineTo(arrowX, endY);
          const dy = rampDir === 's' ? -8 : 8;
          ctx.moveTo(arrowX - 6, endY + dy);
          ctx.lineTo(arrowX, endY);
          ctx.lineTo(arrowX + 6, endY + dy);
        } else {
          const startX = rampDir === 'e' ? rmX : rmX + rW;
          const endX = rampDir === 'e' ? rmX + rW : rmX;
          const arrowY = rmY + rD / 2;
          ctx.moveTo(startX, arrowY);
          ctx.lineTo(endX, arrowY);
          const dx = rampDir === 'e' ? -8 : 8;
          ctx.moveTo(endX + dx, arrowY - 6);
          ctx.lineTo(endX, arrowY);
          ctx.lineTo(endX + dx, arrowY + 6);
        }
        ctx.stroke();
      }

      // Dimension labels
      if (showDimensions) {
        // Draw top edge dimension line
        drawDimensionLine(
          ctx,
          { x: sx, y: sy },
          { x: sx + sw, y: sy },
          formatDimension(sec.width),
          -18, // offset above
          isLightTheme
        );
        // Draw right edge dimension line
        drawDimensionLine(
          ctx,
          { x: sx + sw, y: sy },
          { x: sx + sw, y: sy + sd },
          formatDimension(sec.depth),
          18, // offset to the right
          isLightTheme
        );

        // Draw post-to-post dimension spacing along beams
        if (calcs.posts.posts.length > 1) {
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
              const distance = p2.x - p1.x;

              drawDimensionLine(
                ctx,
                { x: px1, y: py1 },
                { x: px2, y: py2 },
                formatDimension(distance),
                14, // offset below posts
                isLightTheme
              );
            }
          });
        }
      } else {
        // Fallback to simple labels if dimensions are hidden
        ctx.fillStyle = isLightTheme ? '#0f172a' : '#e8edf5';
        ctx.font = '600 11px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(formatDimension(sec.width), sx + sw / 2, sy - 8);
        ctx.save();
        ctx.translate(sx + sw + 14, sy + sd / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(formatDimension(sec.depth), 0, 0);
        ctx.restore();
      }

      // Section number badge
      const secIdx = sections.indexOf(sec);
      const badgeX = sx + 10, badgeY = sy + 10;
      ctx.fillStyle = isSelected ? '#4e8ef7' : 'rgba(78, 142, 247, 0.6)';
      ctx.beginPath(); ctx.arc(badgeX + 10, badgeY + 10, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(secIdx + 1), badgeX + 10, badgeY + 10);
      ctx.textBaseline = 'alphabetic';

      // Section height label
      ctx.fillStyle = isLightTheme ? 'rgba(15, 23, 42, 0.65)' : 'rgba(232, 237, 245, 0.65)';
      ctx.font = '600 11px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (sec.type === 'landing') {
        ctx.fillText(`H: ${sec.height}"`, sx + sw / 2, sy + sd / 2 + 14);
      } else {
        ctx.fillText(`H: ${sec.height}"`, sx + sw / 2, sy + sd / 2);
      }
      ctx.textBaseline = 'alphabetic';

      // Resize handles (selected only)
      if (isSelected && selectedTool === 'select') {
        const handles = getHandlePositions(sec, S);
        Object.values(handles).forEach((pos) => {
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(pos.cx + ox - HANDLE_SIZE/2, pos.cy + oy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.strokeRect(pos.cx + ox - HANDLE_SIZE/2, pos.cy + oy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
        });
      }

      // Vertex handles (selected only)
      if (isSelected && selectedTool === 'select' && sec.vertices) {
        sec.vertices.forEach((v, idx) => {
          const vx = v.x * S + ox;
          const vy = v.y * S + oy;
          const isVertexSelected = interaction.selectedVertexIndex === idx;

          ctx.fillStyle = isVertexSelected ? '#ef4444' : '#10b981'; // Red if active, Emerald otherwise
          ctx.beginPath();
          ctx.arc(vx, vy, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(vx, vy, 6, 0, Math.PI * 2);
          ctx.stroke();
        });
      }
    });

    // Overall Footprint Dimensions
    if (showDimensions && sections.length > 0) {
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

      const overallW = maxX - minX;
      const overallD = maxY - minY;

      const leftmostX = minX * S + ox;
      const rightmostX = maxX * S + ox;
      const topY = minY * S + oy;
      const bottomY = maxY * S + oy;

      // Draw overall width line at the top (offset above topmost section)
      drawDimensionLine(
        ctx,
        { x: leftmostX, y: topY },
        { x: rightmostX, y: topY },
        `OVERALL WIDTH: ${formatDimension(overallW)}`,
        -36, // offset above
        isLightTheme
      );

      // Draw overall depth line at the left (offset to the left of leftmost section)
      drawDimensionLine(
        ctx,
        { x: leftmostX, y: topY },
        { x: leftmostX, y: bottomY },
        `OVERALL DEPTH: ${formatDimension(overallD)}`,
        -36, // offset to the left
        isLightTheme
      );
    }

    // Ghost rectangle while placing
    if (interaction.mode === 'placing' && interaction.ghostRect) {
      const g = interaction.ghostRect;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(g.x, g.y, g.w, g.h);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.setLineDash([]);
      // Show dimensions
      const pw = Math.abs(g.w) / S, pd = Math.abs(g.h) / S;
      if (pw > 12 && pd > 12) {
        ctx.fillStyle = '#3b82f6';
        ctx.font = '600 12px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(`${formatDimension(pw)} × ${formatDimension(pd)}`, g.x + g.w / 2, g.y + g.h / 2 + 4);
      }
    }

    // Legend (with roundRect polyfill)
    const lx = 16, ly = size.h - 123;
    ctx.font = '500 10px Inter';
    ctx.textAlign = 'left';
    ctx.fillStyle = isLightTheme ? 'rgba(255, 255, 255, 0.9)' : 'rgba(8, 14, 28, 0.85)';
    const legendBorder = isLightTheme ? 'rgba(15, 23, 42, 0.08)' : 'rgba(78, 142, 247, 0.12)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(lx - 8, ly - 8, 114, 115, 8); ctx.fill(); ctx.strokeStyle = legendBorder; ctx.lineWidth = 1; ctx.stroke(); }
    else { ctx.fillRect(lx - 8, ly - 8, 114, 115); ctx.strokeStyle = legendBorder; ctx.lineWidth = 1; ctx.strokeRect(lx - 8, ly - 8, 114, 115); }
    const legendItems = [
      { color: isLightTheme ? '#0284c7' : '#4e8ef7', label: 'Joists' },
      { color: isLightTheme ? '#d97706' : '#f5a623', label: 'Beams' },
      { color: '#f87171', label: 'Posts' },
      { color: isLightTheme ? '#16a34a' : '#34d399', label: 'Railings' },
      { color: isLightTheme ? '#db2777' : '#f472b6', label: 'Stairs' },
      { color: isLightTheme ? '#7c3aed' : '#a78bfa', label: 'Ramps' },
    ];
    legendItems.forEach((item, i) => {
      ctx.fillStyle = item.color; ctx.fillRect(lx, ly + i * 17, 14, 3);
      ctx.fillStyle = isLightTheme ? '#334155' : '#8b9dc3'; ctx.fillText(item.label, lx + 20, ly + i * 17 + 5);
    });

    // Tool hint
    if (selectedTool === 'rectangle') {
      ctx.fillStyle = isLightTheme ? 'rgba(37,99,235,0.95)' : 'rgba(59,130,246,0.9)'; ctx.font = '500 12px Inter'; ctx.textAlign = 'center';
      ctx.fillText(isMobile ? 'Tap to place a deck section' : 'Click & drag to place a deck section', size.w / 2, 24);
    } else if (selectedTool === 'railing') {
      ctx.fillStyle = isLightTheme ? 'rgba(22,163,74,0.95)' : 'rgba(34,197,94,0.9)'; ctx.font = '500 12px Inter'; ctx.textAlign = 'center';
      ctx.fillText('Click a deck edge to toggle railing', size.w / 2, 24);
    } else if (selectedTool === 'stairs') {
      ctx.fillStyle = isLightTheme ? 'rgba(219,39,119,0.95)' : 'rgba(236,72,153,0.9)'; ctx.font = '500 12px Inter'; ctx.textAlign = 'center';
      ctx.fillText('Click a deck edge to attach stairs', size.w / 2, 24);
    } else if (selectedTool === 'ramp') {
      ctx.fillStyle = isLightTheme ? 'rgba(124,58,237,0.95)' : 'rgba(139,92,246,0.9)'; ctx.font = '500 12px Inter'; ctx.textAlign = 'center';
      ctx.fillText('Click a deck edge to attach ramp', size.w / 2, 24);
    } else if (selectedTool === 'landing') {
      ctx.fillStyle = isLightTheme ? 'rgba(2,132,199,0.95)' : 'rgba(14,165,233,0.9)'; ctx.font = '500 12px Inter'; ctx.textAlign = 'center';
      ctx.fillText(isMobile ? 'Tap to place a landing' : 'Click & drag or click to place a landing', size.w / 2, 24);
    }

  }, [sections, sectionCalcs, materials, selectedSectionId, showGrid, showDimensions, selectedTool, interaction, size, panOffset, zoomScale, isMobile, S]);

  const cursor = interaction.mode === 'placing' ? 'crosshair' :
    interaction.mode === 'moving' || interaction.mode === 'dragging_vertex' ? 'grabbing' :
    interaction.mode === 'resizing' ? 'nwse-resize' :
    selectedTool === 'rectangle' ? 'crosshair' : 'default';

  const zoomIn = useCallback(() => setZoomScale((z) => Math.min(4, z * 1.25)), []);
  const zoomOut = useCallback(() => setZoomScale((z) => Math.max(0.2, z / 1.25)), []);
  const zoomReset = useCallback(() => { setZoomScale(1); setPanOffset({ x: 0, y: 0 }); }, []);

  // Scroll wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoomScale((z) => Math.min(4, Math.max(0.2, z * (e.deltaY > 0 ? 0.92 : 1.08))));
  }, []);

  return (
    <div ref={containerRef} className="canvas-2d"
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick} onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      style={{ cursor, touchAction: 'none' }}>
      <canvas ref={canvasRef} className="canvas-2d__canvas" />
      {/* Zoom Controls */}
      {!isMobile && (
        <div className="zoom-controls" id="zoom-controls">
          <button className="zoom-controls__btn" onClick={zoomOut} aria-label="Zoom out" data-tooltip="Zoom Out">−</button>
          <div className="zoom-controls__divider" />
          <span className="zoom-controls__pct" onClick={zoomReset} title="Reset zoom">{Math.round(zoomScale * 100)}%</span>
          <div className="zoom-controls__divider" />
          <button className="zoom-controls__btn" onClick={zoomIn} aria-label="Zoom in" data-tooltip="Zoom In">+</button>
        </div>
      )}
    </div>
  );
}
