import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDeckStore } from '../../store/deckStore';
import { formatDimension } from '../../utils/units';
import { WOOD_COLORS } from '../Materials/materialData';
import './Canvas2D.css';

const SCALE = 3;
const HANDLE_SIZE = 8;
const HANDLES = ['nw','n','ne','e','se','s','sw','w'];

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

function hitTestSection(mx, my, sections, S, panX, panY, cw, ch) {
  const ox = (cw / 2) + panX, oy = (ch / 2) + panY;
  for (let i = sections.length - 1; i >= 0; i--) {
    const sec = sections[i];
    const sx = sec.x * S + ox, sy = sec.y * S + oy;
    const sw = sec.width * S, sd = sec.depth * S;
    if (mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sd) return sec.id;
  }
  return null;
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

  const sections = useDeckStore((s) => s.sections);
  const selectedSectionId = useDeckStore((s) => s.selectedSectionId);
  const sectionCalcs = useDeckStore((s) => s.sectionCalcs);
  const materials = useDeckStore((s) => s.materials);
  const showGrid = useDeckStore((s) => s.showGrid);
  const selectedTool = useDeckStore((s) => s.selectedTool);
  const interaction = useDeckStore((s) => s.interaction);
  const selectSection = useDeckStore((s) => s.selectSection);
  const addSection = useDeckStore((s) => s.addSection);
  const moveSection = useDeckStore((s) => s.moveSection);
  const finishMove = useDeckStore((s) => s.finishMove);
  const resizeSection = useDeckStore((s) => s.resizeSection);
  const setInteraction = useDeckStore((s) => s.setInteraction);
  const toggleRailing = useDeckStore((s) => s.toggleRailing);
  const attachStairs = useDeckStore((s) => s.attachStairs);

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

    if (selectedTool === 'rectangle') {
      setInteraction({ mode: 'placing', dragStart: { x: mx, y: my }, ghostRect: { x: mx, y: my, w: 0, h: 0 } });
      return;
    }

    if (selectedTool === 'select') {
      const sel = sections.find((s) => s.id === selectedSectionId);
      if (sel) {
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
      }
      return;
    }

    if (selectedTool === 'railing' || selectedTool === 'stairs') {
      const hitId = hitTestSection(mx, my, sections, S, panOffset.x, panOffset.y, size.w, size.h);
      if (hitId) {
        const sec = sections.find((s) => s.id === hitId);
        const edge = getNearestEdge(mx, my, sec, S, panOffset.x, panOffset.y, size.w, size.h);
        if (selectedTool === 'railing') toggleRailing(hitId, edge);
        else attachStairs(hitId, edge);
      }
    }
  }, [selectedTool, sections, selectedSectionId, S, panOffset, size, selectSection, setInteraction, toggleRailing, attachStairs]);

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
  }, [isPanning, interaction, selectedSectionId, sections, S, setInteraction, moveSection, resizeSection]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) { setIsPanning(false); return; }
    if (interaction.mode === 'placing' && interaction.ghostRect) {
      const g = interaction.ghostRect;
      const ox = size.w / 2 + panOffset.x, oy = size.h / 2 + panOffset.y;
      const absW = Math.abs(g.w), absH = Math.abs(g.h);
      if (absW > 20 && absH > 20) {
        const rx = (Math.min(g.x, g.x + g.w) - ox) / S;
        const ry = (Math.min(g.y, g.y + g.h) - oy) / S;
        addSection({ x: rx, y: ry, width: absW / S, depth: absH / S });
      }
      setInteraction({ mode: 'idle', dragStart: null, ghostRect: null });
    }
    if (interaction.mode === 'moving') finishMove();
    if (interaction.mode === 'resizing') setInteraction({ mode: 'idle', dragStart: null, resizeHandle: null });
  }, [isPanning, interaction, size, panOffset, S, addSection, finishMove, setInteraction]);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top;
      if (selectedTool === 'rectangle') {
        addSection({ x: (mx - size.w/2 - panOffset.x) / S, y: (my - size.h/2 - panOffset.y) / S, width: 144, depth: 120 });
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

    // Background vignette
    const vg = ctx.createRadialGradient(size.w/2, size.h/2, size.w*0.1, size.w/2, size.h/2, size.w*0.8);
    vg.addColorStop(0, 'rgba(12, 18, 33, 0)');
    vg.addColorStop(1, 'rgba(4, 6, 12, 0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, size.w, size.h);

    // Grid — minor (1ft) + major (4ft)
    if (showGrid) {
      const gs = 12 * S;
      // Minor gridlines (1ft)
      ctx.strokeStyle = 'rgba(30, 50, 90, 0.15)';
      ctx.lineWidth = 0.5;
      for (let x = ox % gs; x < size.w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke(); }
      for (let y = oy % gs; y < size.h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke(); }
      // Major gridlines (4ft)
      const gs4 = 48 * S;
      ctx.strokeStyle = 'rgba(50, 80, 140, 0.25)';
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
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(sx - 20, sy - hh, sw + 40, hh);
        ctx.strokeStyle = '#444466';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - 20, sy - hh, sw + 40, hh);
        ctx.fillStyle = '#888aaa';
        ctx.font = '600 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('HOUSE', sx + sw / 2, sy - hh / 2 + 3);
      }

      // Deck surface
      ctx.fillStyle = woodColor + '25';
      ctx.fillRect(sx, sy, sw, sd);
      ctx.strokeStyle = isSelected ? '#3b82f6' : woodColor + '80';
      ctx.lineWidth = isSelected ? 2.5 : 2;
      ctx.strokeRect(sx, sy, sw, sd);

      // Deck boards
      const bw = 5.5 * S, gap = 0.125 * S;
      ctx.strokeStyle = woodColor + '40';
      ctx.lineWidth = 0.5;
      for (let y = 0; y < sd; y += bw + gap) {
        ctx.beginPath(); ctx.moveTo(sx, sy + y); ctx.lineTo(sx + sw, sy + y); ctx.stroke();
      }

      // Joists
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      calcs.joists.positions.forEach((xIn) => {
        const x = sx + xIn * S;
        if (x > sx + sw + 1) return;
        ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy + sd); ctx.stroke();
      });

      // Beams
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      calcs.beams.positions.forEach((yIn) => {
        const y = sy + yIn * S;
        ctx.beginPath(); ctx.moveTo(sx - 6, y); ctx.lineTo(sx + sw + 6, y); ctx.stroke();
      });

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
        ctx.strokeStyle = '#22c55e';
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
        const stairW = 36 * S;
        const stairD = st.totalRun * S;
        ctx.fillStyle = 'rgba(236, 72, 153, 0.15)';
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 1.5;
        let stX, stY;
        if (sec.stairs === 's') { stX = sx + sw / 2 - stairW / 2; stY = sy + sd; }
        else if (sec.stairs === 'n') { stX = sx + sw / 2 - stairW / 2; stY = sy - stairD; }
        else if (sec.stairs === 'e') { stX = sx + sw; stY = sy + sd / 2 - stairW / 2; }
        else { stX = sx - stairD; stY = sy + sd / 2 - stairW / 2; }
        const isVert = sec.stairs === 'n' || sec.stairs === 's';
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

      // Dimension labels
      ctx.fillStyle = '#e8edf5';
      ctx.font = '600 11px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(formatDimension(sec.width), sx + sw / 2, sy - 8);
      ctx.save();
      ctx.translate(sx + sw + 14, sy + sd / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(formatDimension(sec.depth), 0, 0);
      ctx.restore();

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
    });

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
    const lx = 16, ly = size.h - 106;
    ctx.font = '500 10px Inter';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(8, 14, 28, 0.85)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(lx - 8, ly - 8, 114, 98, 8); ctx.fill(); ctx.strokeStyle = 'rgba(78, 142, 247, 0.12)'; ctx.lineWidth = 1; ctx.stroke(); }
    else { ctx.fillRect(lx - 8, ly - 8, 114, 98); ctx.strokeStyle = 'rgba(78, 142, 247, 0.12)'; ctx.lineWidth = 1; ctx.strokeRect(lx - 8, ly - 8, 114, 98); }
    const legendItems = [
      { color: '#4e8ef7', label: 'Joists' }, { color: '#f5a623', label: 'Beams' },
      { color: '#f87171', label: 'Posts' }, { color: '#34d399', label: 'Railings' },
      { color: '#f472b6', label: 'Stairs' },
    ];
    legendItems.forEach((item, i) => {
      ctx.fillStyle = item.color; ctx.fillRect(lx, ly + i * 17, 14, 3);
      ctx.fillStyle = '#8b9dc3'; ctx.fillText(item.label, lx + 20, ly + i * 17 + 5);
    });

    // Tool hint
    if (selectedTool === 'rectangle') {
      ctx.fillStyle = 'rgba(59,130,246,0.9)'; ctx.font = '500 12px Inter'; ctx.textAlign = 'center';
      ctx.fillText(isMobile ? 'Tap to place a deck section' : 'Click & drag to place a deck section', size.w / 2, 24);
    } else if (selectedTool === 'railing') {
      ctx.fillStyle = 'rgba(34,197,94,0.9)'; ctx.font = '500 12px Inter'; ctx.textAlign = 'center';
      ctx.fillText('Click a deck edge to toggle railing', size.w / 2, 24);
    } else if (selectedTool === 'stairs') {
      ctx.fillStyle = 'rgba(236,72,153,0.9)'; ctx.font = '500 12px Inter'; ctx.textAlign = 'center';
      ctx.fillText('Click a deck edge to attach stairs', size.w / 2, 24);
    }

  }, [sections, sectionCalcs, materials, selectedSectionId, showGrid, selectedTool, interaction, size, panOffset, zoomScale, isMobile, S]);

  const cursor = interaction.mode === 'placing' ? 'crosshair' :
    interaction.mode === 'moving' ? 'grabbing' :
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
