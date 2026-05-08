import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDeckStore } from '../../store/deckStore';
import { formatDimension } from '../../utils/units';
import { WOOD_COLORS } from '../Materials/materialData';
import './Canvas2D.css';

const SCALE = 3; // pixels per inch

export default function Canvas2D({ isMobile }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const lastTouchDistRef = useRef(null);
  const [zoomScale, setZoomScale] = useState(1);

  const deck = useDeckStore((s) => s.deck);
  const calcs = useDeckStore((s) => s.calcs);
  const showGrid = useDeckStore((s) => s.showGrid);

  // Resize observer
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Mouse panning handlers
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      setIsPanning(true);
      lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistRef.current = dist;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning) {
      const dx = e.touches[0].clientX - lastMouseRef.current.x;
      const dy = e.touches[0].clientY - lastMouseRef.current.y;
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleDelta = dist / lastTouchDistRef.current;
      setZoomScale((prev) => Math.min(3, Math.max(0.3, prev * scaleDelta)));
      lastTouchDistRef.current = dist;
    }
  }, [isPanning]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    lastTouchDistRef.current = null;
  }, []);

  // Draw everything
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.w, size.h);

    const S = SCALE * zoomScale;
    const deckW = deck.width * S;
    const deckD = deck.depth * S;
    const houseHeight = deck.ledgerAttached ? 30 * zoomScale : 0;
    const dimOffset = deck.ledgerAttached ? 55 * zoomScale : 25 * zoomScale;
    const originX = (size.w - deckW) / 2 + panOffset.x;
    const originY = (size.h - deckD) / 2 + panOffset.y + (houseHeight / 2);

    // --- Grid ---
    if (showGrid) {
      ctx.strokeStyle = 'rgba(30, 42, 74, 0.4)';
      ctx.lineWidth = 0.5;
      const gridSpacing = 12 * S; // 1 ft grid
      for (let x = originX % gridSpacing; x < size.w; x += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke();
      }
      for (let y = originY % gridSpacing; y < size.h; y += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke();
      }
    }

    // --- House Wall (if ledger attached) ---
    if (deck.ledgerAttached) {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(originX - 20, originY - houseHeight, deckW + 40, houseHeight);
      ctx.strokeStyle = '#444466';
      ctx.lineWidth = 1;
      ctx.strokeRect(originX - 20, originY - houseHeight, deckW + 40, houseHeight);
      // Hatch pattern for house wall
      ctx.save();
      ctx.beginPath();
      ctx.rect(originX - 20, originY - houseHeight, deckW + 40, houseHeight);
      ctx.clip();
      ctx.strokeStyle = 'rgba(100,100,140,0.25)';
      ctx.lineWidth = 0.5;
      for (let i = -50; i < deckW + 80; i += 8) {
        ctx.beginPath();
        ctx.moveTo(originX - 20 + i, originY - houseHeight);
        ctx.lineTo(originX - 20 + i + houseHeight, originY);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#888aaa';
      ctx.font = '600 10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('HOUSE', originX + deckW / 2, originY - houseHeight / 2 + 3);
    }

    // --- Deck Surface ---
    const woodColor = WOOD_COLORS[deck.species] || '#c4a35a';
    ctx.fillStyle = woodColor + '25';
    ctx.fillRect(originX, originY, deckW, deckD);
    ctx.strokeStyle = woodColor + '80';
    ctx.lineWidth = 2;
    ctx.strokeRect(originX, originY, deckW, deckD);

    // --- Deck Boards ---
    const boardWidth = 5.5 * S;
    const gap = 0.125 * S;
    ctx.strokeStyle = woodColor + '40';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < deckD; y += boardWidth + gap) {
      const yPos = originY + y;
      if (yPos > originY + deckD) break;
      ctx.beginPath();
      ctx.moveTo(originX, yPos);
      ctx.lineTo(originX + deckW, yPos);
      ctx.stroke();
    }

    // --- Joists ---
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    calcs.joists.positions.forEach((xIn) => {
      const x = originX + xIn * S;
      if (x > originX + deckW + 1) return;
      ctx.beginPath();
      ctx.moveTo(x, originY);
      ctx.lineTo(x, originY + deckD);
      ctx.stroke();
    });

    // --- Beams ---
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    calcs.beams.positions.forEach((yIn) => {
      const y = originY + yIn * S;
      ctx.beginPath();
      ctx.moveTo(originX - 6, y);
      ctx.lineTo(originX + deckW + 6, y);
      ctx.stroke();
    });

    // --- Posts ---
    calcs.posts.posts.forEach((post) => {
      const px = originX + post.x * S;
      const py = originY + post.y * S;
      const pSize = 7;
      // Shadow
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.beginPath();
      ctx.arc(px, py, pSize + 3, 0, Math.PI * 2);
      ctx.fill();
      // Post square
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.rect(px - pSize / 2, py - pSize / 2, pSize, pSize);
      ctx.fill();
      ctx.strokeStyle = '#ff8888';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // --- Dimension Labels ---
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '600 12px "JetBrains Mono"';
    ctx.textAlign = 'center';

    // Width (top) — offset above house wall
    const widthLabel = formatDimension(deck.width);
    const dimY = originY - dimOffset;
    ctx.fillText(widthLabel, originX + deckW / 2, dimY - 6);
    // Dimension line
    ctx.strokeStyle = '#94a3b8';
    ctx.fillStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(originX, dimY);
    ctx.lineTo(originX + deckW, dimY);
    ctx.stroke();
    // Extension lines
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(originX, dimY + 4); ctx.lineTo(originX, originY);
    ctx.moveTo(originX + deckW, dimY + 4); ctx.lineTo(originX + deckW, originY);
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrowhead(ctx, originX, dimY, 'left');
    drawArrowhead(ctx, originX + deckW, dimY, 'right');

    // Depth (right)
    const depthLabel = formatDimension(deck.depth);
    const dimX = originX + deckW + 30;
    ctx.fillStyle = '#f1f5f9';
    ctx.save();
    ctx.translate(dimX + 8, originY + deckD / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(depthLabel, 0, 0);
    ctx.restore();
    ctx.strokeStyle = '#94a3b8';
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(dimX, originY);
    ctx.lineTo(dimX, originY + deckD);
    ctx.stroke();
    // Extension lines
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(dimX - 4, originY); ctx.lineTo(originX + deckW, originY);
    ctx.moveTo(dimX - 4, originY + deckD); ctx.lineTo(originX + deckW, originY + deckD);
    ctx.stroke();
    ctx.setLineDash([]);
    drawArrowhead(ctx, dimX, originY, 'up');
    drawArrowhead(ctx, dimX, originY + deckD, 'down');

    // --- Legend ---
    const legendX = 16;
    const legendY = size.h - 84;
    ctx.font = '500 10px Inter';
    ctx.textAlign = 'left';
    // Legend background
    ctx.fillStyle = 'rgba(10, 22, 40, 0.75)';
    ctx.beginPath();
    ctx.roundRect(legendX - 8, legendY - 8, 110, 76, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 42, 74, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const legendItems = [
      { color: '#3b82f6', label: 'Joists' },
      { color: '#f59e0b', label: 'Beams' },
      { color: '#ef4444', label: 'Posts' },
      { color: woodColor + '80', label: 'Deck boards' },
    ];
    legendItems.forEach((item, i) => {
      const ly = legendY + i * 16;
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX, ly, 12, 3);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(item.label, legendX + 18, ly + 5);
    });

  }, [deck, calcs, showGrid, size, panOffset, zoomScale]);

  return (
    <div
      ref={containerRef}
      className="canvas-2d"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isPanning ? 'grabbing' : 'default', touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="canvas-2d__canvas" />
      {!isMobile && <div className="canvas-2d__hint">Alt + drag to pan</div>}
    </div>
  );
}

function drawArrowhead(ctx, x, y, direction) {
  const s = 5;
  ctx.beginPath();
  switch (direction) {
    case 'left':
      ctx.moveTo(x, y); ctx.lineTo(x + s, y - s / 2); ctx.lineTo(x + s, y + s / 2); break;
    case 'right':
      ctx.moveTo(x, y); ctx.lineTo(x - s, y - s / 2); ctx.lineTo(x - s, y + s / 2); break;
    case 'up':
      ctx.moveTo(x, y); ctx.lineTo(x - s / 2, y + s); ctx.lineTo(x + s / 2, y + s); break;
    case 'down':
      ctx.moveTo(x, y); ctx.lineTo(x - s / 2, y - s); ctx.lineTo(x + s / 2, y - s); break;
  }
  ctx.closePath();
  ctx.fill();
}
