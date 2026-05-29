import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDeckStore } from '../../store/deckStore';
import { formatDimension } from '../../utils/units';
import { WOOD_COLORS, DECK_MATERIAL_COLORS, DECK_COLOR_OPTIONS } from '../Materials/materialData.js';
import { drawDimensionLine } from '../../utils/blueprintRenderer.js';
import {
  isPointInPolygon,
  hitTestSection,
  getDistanceToSegment,
  findEdgeSplitIndex,
  hitTestSubObject,
  getSubObjectOffset
} from '../../utils/polygonUtils.js';
import './Canvas2D.css';

function HardenedNumberInput({ value, onChange, min, max, step = 1, className = "settings-input", id, style, disabled, readOnly, integer = false }) {
  const [localVal, setLocalVal] = useState(value !== undefined && value !== null ? value.toString() : "");

  useEffect(() => {
    if (value !== undefined && value !== null) {
      setLocalVal(value.toString());
    }
  }, [value]);

  const commitValue = () => {
    let num = Number(localVal);
    if (isNaN(num) || localVal.trim() === "") {
      setLocalVal(value !== undefined && value !== null ? value.toString() : "");
      return;
    }
    if (integer) {
      num = Math.round(num);
    }
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    onChange(num);
    setLocalVal(num.toString());
  };

  return (
    <input
      id={id}
      className={className}
      type="number"
      min={min}
      max={max}
      step={step}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={commitValue}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commitValue();
          e.currentTarget.blur();
        }
      }}
      style={style}
      disabled={disabled}
      readOnly={readOnly}
    />
  );
}

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

function getStairHandlePositions(sec, S, ox, oy, sectionCalcs) {
  const calcs = sectionCalcs ? sectionCalcs[sec.id] : null;
  if (!sec.stairs || !calcs || !calcs.stairs) return null;
  const st = calcs.stairs;
  const stairDir = typeof sec.stairs === 'string' ? sec.stairs : (sec.stairs.direction || 's');
  const stairW = st.width * S;
  const stairD = st.totalRun * S;
  const sx = sec.x * S + ox, sy = sec.y * S + oy;
  const sw = sec.width * S, sd = sec.depth * S;
  const offset = getSubObjectOffset(sec, 'stairs');

  let stX, stY;
  if (stairDir === 's') {
    stX = sx + offset * S;
    stY = sy + sd;
  } else if (stairDir === 'n') {
    stX = sx + offset * S;
    stY = sy - stairD;
  } else if (stairDir === 'e') {
    stX = sx + sw;
    stY = sy + offset * S;
  } else { // 'w'
    stX = sx - stairD;
    stY = sy + offset * S;
  }

  if (stairDir === 's') {
    return {
      depth: { x: stX + stairW / 2, y: stY + stairD },
      side1: { x: stX, y: stY + stairD / 2 },
      side2: { x: stX + stairW, y: stY + stairD / 2 }
    };
  } else if (stairDir === 'n') {
    return {
      depth: { x: stX + stairW / 2, y: stY },
      side1: { x: stX, y: stY + stairD / 2 },
      side2: { x: stX + stairW, y: stY + stairD / 2 }
    };
  } else if (stairDir === 'e') {
    return {
      depth: { x: stX + stairD, y: stY + stairW / 2 },
      side1: { x: stX + stairD / 2, y: stY },
      side2: { x: stX + stairD / 2, y: stY + stairW }
    };
  } else { // 'w'
    return {
      depth: { x: stX, y: stY + stairW / 2 },
      side1: { x: stX + stairD / 2, y: stY },
      side2: { x: stX + stairD / 2, y: stY + stairW }
    };
  }
}

function getRampHandlePositions(sec, S, ox, oy, sectionCalcs) {
  const calcs = sectionCalcs ? sectionCalcs[sec.id] : null;
  if (!sec.ramp || !calcs || !calcs.ramp) return null;
  const rm = calcs.ramp;
  const rampDir = typeof sec.ramp === 'string' ? sec.ramp : (sec.ramp.direction || 's');
  const rampW = rm.width * S;
  const footprintRun = rm.run + 60 * (rm.intermediateLandings || 0);
  const rampD = footprintRun * S;
  const sx = sec.x * S + ox, sy = sec.y * S + oy;
  const sw = sec.width * S, sd = sec.depth * S;
  const offset = getSubObjectOffset(sec, 'ramp');

  let rmX, rmY;
  if (rampDir === 's') {
    rmX = sx + offset * S;
    rmY = sy + sd;
  } else if (rampDir === 'n') {
    rmX = sx + offset * S;
    rmY = sy - rampD;
  } else if (rampDir === 'e') {
    rmX = sx + sw;
    rmY = sy + offset * S;
  } else { // 'w'
    rmX = sx - rampD;
    rmY = sy + offset * S;
  }

  if (rampDir === 's') {
    return {
      depth: { x: rmX + rampW / 2, y: rmY + rampD },
      side1: { x: rmX, y: rmY + rampD / 2 },
      side2: { x: rmX + rampW, y: rmY + rampD / 2 }
    };
  } else if (rampDir === 'n') {
    return {
      depth: { x: rmX + rampW / 2, y: rmY },
      side1: { x: rmX, y: rmY + rampD / 2 },
      side2: { x: rmX + rampW, y: rmY + rampD / 2 }
    };
  } else if (rampDir === 'e') {
    return {
      depth: { x: rmX + rampD, y: rmY + rampW / 2 },
      side1: { x: rmX + rampD / 2, y: rmY },
      side2: { x: rmX + rampD / 2, y: rmY + rampW }
    };
  } else { // 'w'
    return {
      depth: { x: rmX, y: rmY + rampW / 2 },
      side1: { x: rmX + rampD / 2, y: rmY },
      side2: { x: rmX + rampD / 2, y: rmY + rampW }
    };
  }
}

function hitTestSubObjectHandles(mx, my, sec, S, ox, oy, sectionCalcs, type) {
  const handles = type === 'stairs' 
    ? getStairHandlePositions(sec, S, ox, oy, sectionCalcs)
    : getRampHandlePositions(sec, S, ox, oy, sectionCalcs);
  if (!handles) return null;
  for (const [key, pos] of Object.entries(handles)) {
    if (Math.abs(mx - pos.x) < HANDLE_SIZE + 2 && Math.abs(my - pos.y) < HANDLE_SIZE + 2) return key;
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

  const [actionPopup, setActionPopup] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('beams');
  const [isAddingVertex, setIsAddingVertex] = useState(false);
  const [hoverPos, setHoverPos] = useState(null);

  const theme = useDeckStore((s) => s.theme);
  const sections = useDeckStore((s) => s.sections);
  const selectedSectionId = useDeckStore((s) => s.selectedSectionId);
  const selectedSubObjectType = useDeckStore((s) => s.selectedSubObjectType);
  const attachStairs = useDeckStore((s) => s.attachStairs);
  const updateStairs = useDeckStore((s) => s.updateStairs);
  const attachRamp = useDeckStore((s) => s.attachRamp);
  const updateRamp = useDeckStore((s) => s.updateRamp);
  const removeVertex = useDeckStore((s) => s.removeVertex);
  const showGrid = useDeckStore((s) => s.showGrid);
  const showDimensions = useDeckStore((s) => s.showDimensions);
  const visibleLayers = useDeckStore((s) => s.visibleLayers2d || { decking: true, framing: true, foundation: true, accessories: true });

  useEffect(() => {
    if (!selectedSectionId) {
      setActionPopup(null);
      setShowSettingsModal(false);
    }
  }, [selectedSectionId]);
  const selectedTool = useDeckStore((s) => s.selectedTool);
  const interaction = useDeckStore((s) => s.interaction);
  const selectSection = useDeckStore((s) => s.selectSection);
  const sectionCalcs = useDeckStore((s) => s.sectionCalcs);
  const materials = useDeckStore((s) => s.materials);
  const addSection = useDeckStore((s) => s.addSection);
  const moveSection = useDeckStore((s) => s.moveSection);
  const finishMove = useDeckStore((s) => s.finishMove);
  const resizeSection = useDeckStore((s) => s.resizeSection);
  const legendColors = useDeckStore((s) => s.legendColors);
  const setLegendColor = useDeckStore((s) => s.setLegendColor);
  const setInteraction = useDeckStore((s) => s.setInteraction);
  const toggleRailing = useDeckStore((s) => s.toggleRailing);
  const dragVertex = useDeckStore((s) => s.dragVertex);
  const finishVertexDrag = useDeckStore((s) => s.finishVertexDrag);
  const addVertex = useDeckStore((s) => s.addVertex);
  const removeSection = useDeckStore((s) => s.removeSection);
  const setSelectedTool = useDeckStore((s) => s.setSelectedTool);
  const placementDeck = useDeckStore((s) => s.placementDeck);
  const placementLanding = useDeckStore((s) => s.placementLanding);
  const updateDeck = useDeckStore((s) => s.updateDeck);
  const toggleLayer = useDeckStore((s) => s.toggleLayer);
  const showToast = useDeckStore((s) => s.showToast);

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

    if (e.detail === 3) {
      // Triple click - delete the clicked object (stairs, ramp, or section)
      const hit = hitTestSubObject(mx, my, sections, S, panOffset.x, panOffset.y, size.w, size.h, sectionCalcs);
      if (hit) {
        const sec = sections.find((s) => s.id === hit.id);
        if (sec) {
          if (hit.type === 'stairs' && sec.stairs) {
            attachStairs(hit.id, sec.stairs.direction || sec.stairs);
            if (selectedSectionId === hit.id && selectedSubObjectType === 'stairs') {
              selectSection(selectedSectionId, null);
            }
          } else if (hit.type === 'ramp' && sec.ramp) {
            attachRamp(hit.id, sec.ramp.direction || sec.ramp);
            if (selectedSectionId === hit.id && selectedSubObjectType === 'ramp') {
              selectSection(selectedSectionId, null);
            }
          } else {
            // Entire deck section
            if (window.confirm("Are you sure you want to delete this deck section?")) {
              removeSection(hit.id);
            }
          }
        }
      }
      e.preventDefault();
      return;
    }

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
      
      // Check stairs/ramp handles first if selected
      if (sel && (selectedSubObjectType === 'stairs' || selectedSubObjectType === 'ramp')) {
        const handleKey = hitTestSubObjectHandles(mx, my, sel, S, panOffset.x, panOffset.y, sectionCalcs, selectedSubObjectType);
        if (handleKey) {
          const obj = selectedSubObjectType === 'stairs' ? sel.stairs : sel.ramp;
          setInteraction({
            mode: 'resizing_subobject',
            subType: selectedSubObjectType,
            sectionId: sel.id,
            handle: handleKey,
            dragStart: { x: mx, y: my },
            initialWidth: obj.width || 36,
            initialNumberOfSteps: selectedSubObjectType === 'stairs' ? (obj.numberOfSteps !== undefined ? obj.numberOfSteps : 5) : null,
            initialRampRun: selectedSubObjectType === 'ramp' ? (obj.run || 120) : null,
            initialOffset: obj.offset || 0,
            initialTotalRun: selectedSubObjectType === 'stairs' ? (sectionCalcs && sectionCalcs[sel.id]?.stairs?.totalRun || 50) : null
          });
          return;
        }
      }

      const ox = size.w / 2 + panOffset.x;
      const oy = size.h / 2 + panOffset.y;
      const lx = (mx - ox) / S;
      const ly = (my - oy) / S;

      if (isAddingVertex && selectedSectionId) {
        const sec = sections.find((s) => s.id === selectedSectionId);
        if (sec) {
          const thresholdInches = 24 / S;
          const splitIdx = findEdgeSplitIndex(lx, ly, sec.vertices, thresholdInches);
          if (splitIdx !== -1) {
            const newV = {
              x: Math.round(lx / 12) * 12,
              y: Math.round(ly / 12) * 12
            };
            addVertex(selectedSectionId, splitIdx + 1, newV);
            showToast("Corner point added!", "success");
            setIsAddingVertex(false);
            setHoverPos(null);
          } else {
            showToast("Click directly on an edge of the deck boundary.", "warning");
          }
        }
        return;
      }

      if (sel && (!selectedSubObjectType || selectedSubObjectType === 'deck')) {
        // Check vertex handles first
        const vIdx = hitTestVertices(mx, my, sel.vertices, S, panOffset.x, panOffset.y, size.w, size.h);
        if (vIdx !== -1) {
          setActionPopup({ x: mx, y: my, id: sel.id, type: 'vertex', vertexIndex: vIdx });
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
          setActionPopup(null);
          setInteraction({ mode: 'resizing', resizeHandle: handle, dragStart: { x: mx, y: my } });
          return;
        }
      }
      
      const hit = hitTestSubObject(mx, my, sections, S, panOffset.x, panOffset.y, size.w, size.h, sectionCalcs);
      if (hit) {
        selectSection(hit.id, (hit.type !== 'deck' && hit.type !== 'post' && hit.type !== 'beam' && hit.type !== 'joist' && !hit.type.startsWith('railing')) ? hit.type : null);
        setActionPopup({ x: mx, y: my, id: hit.id, type: hit.type });
        if (hit.type === 'stairs' || hit.type === 'ramp') {
          const sec = sections.find((s) => s.id === hit.id);
          const initialOffset = getSubObjectOffset(sec, hit.type);
          setInteraction({
            mode: 'dragging_subval',
            subType: hit.type,
            sectionId: hit.id,
            dragStart: { x: mx, y: my },
            initialOffset
          });
        } else {
          setInteraction({ mode: 'moving', dragStart: { x: mx, y: my } });
        }
      } else {
        selectSection(null);
        setActionPopup(null);
        setInteraction({ mode: 'idle', dragStart: null, selectedVertexIndex: null });
      }
      return;
    }

    if (selectedTool === 'railing' || selectedTool === 'stairs' || selectedTool === 'ramp') {
      const hitId = hitTestSection(mx, my, sections, S, panOffset.x, panOffset.y, size.w, size.h, sectionCalcs);
      if (hitId) {
        const sec = sections.find((s) => s.id === hitId);
        const edge = getNearestEdge(mx, my, sec, S, panOffset.x, panOffset.y, size.w, size.h);
        if (selectedTool === 'railing') toggleRailing(hitId, edge);
        else if (selectedTool === 'stairs') attachStairs(hitId, edge);
        else attachRamp(hitId, edge);
      }
    }
  }, [selectedTool, sections, selectedSectionId, selectedSubObjectType, S, panOffset, size, selectSection, setInteraction, toggleRailing, attachStairs, attachRamp, updateStairs, updateRamp, sectionCalcs, removeSection, isAddingVertex, addVertex, showToast]);

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

    if (isAddingVertex) {
      setHoverPos({ x: mx, y: my });
    } else {
      if (hoverPos !== null) setHoverPos(null);
    }

    if (interaction.mode !== 'idle') {
      setActionPopup(null);
    }

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
    if (interaction.mode === 'resizing_subobject' && selectedSectionId) {
      const sec = sections.find((s) => s.id === selectedSectionId);
      if (sec) {
        const type = interaction.subType;
        const h = interaction.handle;
        const dx = (mx - interaction.dragStart.x) / S;
        const dy = (my - interaction.dragStart.y) / S;
        const obj = type === 'stairs' ? sec.stairs : sec.ramp;
        if (obj) {
          const dir = typeof obj === 'string' ? obj : (obj.direction || 's');
          const isVert = dir === 'n' || dir === 's';
          
          if (h === 'depth') {
            if (type === 'stairs') {
              const treadDepth = obj.run || 10;
              let deltaRun = 0;
              if (dir === 's') deltaRun = dy;
              else if (dir === 'n') deltaRun = -dy;
              else if (dir === 'e') deltaRun = dx;
              else if (dir === 'w') deltaRun = -dx;
              
              const newTotalRun = Math.max(10, interaction.initialTotalRun + deltaRun);
              const newSteps = Math.round(newTotalRun / treadDepth);
              updateStairs(selectedSectionId, { numberOfSteps: Math.max(1, newSteps) });
            } else if (type === 'ramp') {
              let deltaRun = 0;
              if (dir === 's') deltaRun = dy;
              else if (dir === 'n') deltaRun = -dy;
              else if (dir === 'e') deltaRun = dx;
              else if (dir === 'w') deltaRun = -dx;
              
              const newRun = Math.max(12, interaction.initialRampRun + deltaRun);
              updateRamp(selectedSectionId, { run: newRun });
            }
          } else {
            const edgeLength = isVert ? sec.width : sec.depth;
            let newWidth = interaction.initialWidth;
            let newOffset = interaction.initialOffset;
            
            if (isVert) {
              if (h === 'side1') {
                newOffset = interaction.initialOffset + dx;
                newWidth = interaction.initialWidth - dx;
              } else if (h === 'side2') {
                newWidth = interaction.initialWidth + dx;
              }
            } else {
              if (h === 'side1') {
                newOffset = interaction.initialOffset + dy;
                newWidth = interaction.initialWidth - dy;
              } else if (h === 'side2') {
                newWidth = interaction.initialWidth + dy;
              }
            }
            
            newWidth = Math.max(24, Math.min(edgeLength, newWidth));
            newOffset = Math.max(0, Math.min(edgeLength - newWidth, newOffset));
            
            if (type === 'stairs') {
              updateStairs(selectedSectionId, { width: newWidth, offset: newOffset, align: 'custom' });
            } else if (type === 'ramp') {
              updateRamp(selectedSectionId, { width: newWidth, offset: newOffset, align: 'custom' });
            }
          }
        }
      }
    }
    if (interaction.mode === 'dragging_subval' && selectedSectionId) {
      const sec = sections.find((s) => s.id === selectedSectionId);
      if (sec) {
        const type = interaction.subType;
        const dx = (mx - interaction.dragStart.x) / S;
        const dy = (my - interaction.dragStart.y) / S;
        const st = type === 'stairs' ? sec.stairs : sec.ramp;
        if (st) {
          const dir = typeof st === 'string' ? st : (st.direction || 's');
          const isVert = dir === 'n' || dir === 's';
          const delta = isVert ? dx : dy;
          const newOffset = Math.max(0, interaction.initialOffset + delta);
          
          const width = typeof st === 'object' ? (st.width || 36) : 36;
          const totalLength = isVert ? sec.width : sec.depth;
          const cappedOffset = Math.min(totalLength - width, newOffset);
          
          if (type === 'stairs') {
            updateStairs(selectedSectionId, { offset: cappedOffset, align: 'custom' });
          } else if (type === 'ramp') {
            updateRamp(selectedSectionId, { offset: cappedOffset, align: 'custom' });
          }
        }
      }
    }
  }, [isPanning, interaction, selectedSectionId, sections, S, setInteraction, moveSection, resizeSection, dragVertex, updateStairs, updateRamp, size.w, size.h, panOffset.x, panOffset.y, isAddingVertex, hoverPos]);

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
        const defW = type === 'landing' ? placementLanding.width : placementDeck.width;
        const defD = type === 'landing' ? placementLanding.depth : placementDeck.depth;
        const defH = type === 'landing' ? placementLanding.height : placementDeck.height;
        addSection({ x: rx - defW / 2, y: ry - defD / 2, width: defW, depth: defD, height: defH }, type);
      }
      setInteraction({ mode: 'idle', dragStart: null, ghostRect: null });
    }
    if (interaction.mode === 'dragging_vertex') finishVertexDrag();
    if (interaction.mode === 'moving') finishMove();
    if (interaction.mode === 'resizing') setInteraction({ mode: 'idle', dragStart: null, resizeHandle: null });
    if (interaction.mode === 'dragging_subval' || interaction.mode === 'resizing_subobject') setInteraction({ mode: 'idle', dragStart: null });
  }, [isPanning, interaction, size, panOffset, S, addSection, finishMove, setInteraction, finishVertexDrag, placementDeck, placementLanding, selectedTool]);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top;
      if (selectedTool === 'rectangle' || selectedTool === 'landing') {
        const type = selectedTool === 'landing' ? 'landing' : 'deck';
        const defW = type === 'landing' ? placementLanding.width : placementDeck.width;
        const defD = type === 'landing' ? placementLanding.depth : placementDeck.depth;
        const defH = type === 'landing' ? placementLanding.height : placementDeck.height;
        addSection({
          x: (mx - size.w/2 - panOffset.x) / S - defW / 2,
          y: (my - size.h/2 - panOffset.y) / S - defD / 2,
          width: defW,
          depth: defD,
          height: defH
        }, type);
        return;
      }
      if (selectedTool === 'select') {
        const hit = hitTestSubObject(mx, my, sections, S, panOffset.x, panOffset.y, size.w, size.h, sectionCalcs);
        if (hit) {
          selectSection(hit.id, hit.type !== 'deck' ? hit.type : null);
          if (hit.type === 'stairs' || hit.type === 'ramp') {
            const sec = sections.find((s) => s.id === hit.id);
            const initialOffset = getSubObjectOffset(sec, hit.type);
            setInteraction({
              mode: 'dragging_subval',
              subType: hit.type,
              sectionId: hit.id,
              dragStart: { x: mx, y: my },
              initialOffset
            });
          } else {
            setInteraction({ mode: 'moving', dragStart: { x: mx, y: my } });
          }
        } else {
          selectSection(null);
          setIsPanning(true);
          lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return;
      }
      setIsPanning(true);
      lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      lastTouchDistRef.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, [selectedTool, sections, S, panOffset, size, selectSection, addSection, setInteraction, updateStairs, updateRamp, sectionCalcs, placementDeck, placementLanding]);

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
      } else if (interaction.mode === 'resizing_subobject' && selectedSectionId) {
        const rect = containerRef.current.getBoundingClientRect();
        const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top;
        const sec = sections.find((s) => s.id === selectedSectionId);
        if (sec) {
          const type = interaction.subType;
          const h = interaction.handle;
          const dx = (mx - interaction.dragStart.x) / S;
          const dy = (my - interaction.dragStart.y) / S;
          const obj = type === 'stairs' ? sec.stairs : sec.ramp;
          if (obj) {
            const dir = typeof obj === 'string' ? obj : (obj.direction || 's');
            const isVert = dir === 'n' || dir === 's';
            
            if (h === 'depth') {
              if (type === 'stairs') {
                const treadDepth = obj.run || 10;
                let deltaRun = 0;
                if (dir === 's') deltaRun = dy;
                else if (dir === 'n') deltaRun = -dy;
                else if (dir === 'e') deltaRun = dx;
                else if (dir === 'w') deltaRun = -dx;
                
                const newTotalRun = Math.max(10, interaction.initialTotalRun + deltaRun);
                const newSteps = Math.round(newTotalRun / treadDepth);
                updateStairs(selectedSectionId, { numberOfSteps: Math.max(1, newSteps) });
              } else if (type === 'ramp') {
                let deltaRun = 0;
                if (dir === 's') deltaRun = dy;
                else if (dir === 'n') deltaRun = -dy;
                else if (dir === 'e') deltaRun = dx;
                else if (dir === 'w') deltaRun = -dx;
                
                const newRun = Math.max(12, interaction.initialRampRun + deltaRun);
                updateRamp(selectedSectionId, { run: newRun });
              }
            } else {
              const edgeLength = isVert ? sec.width : sec.depth;
              let newWidth = interaction.initialWidth;
              let newOffset = interaction.initialOffset;
              
              if (isVert) {
                if (h === 'side1') {
                  newOffset = interaction.initialOffset + dx;
                  newWidth = interaction.initialWidth - dx;
                } else if (h === 'side2') {
                  newWidth = interaction.initialWidth + dx;
                }
              } else {
                if (h === 'side1') {
                  newOffset = interaction.initialOffset + dy;
                  newWidth = interaction.initialWidth - dy;
                } else if (h === 'side2') {
                  newWidth = interaction.initialWidth + dy;
                }
              }
              
              newWidth = Math.max(24, Math.min(edgeLength, newWidth));
              newOffset = Math.max(0, Math.min(edgeLength - newWidth, newOffset));
              
              if (type === 'stairs') {
                updateStairs(selectedSectionId, { width: newWidth, offset: newOffset, align: 'custom' });
              } else if (type === 'ramp') {
                updateRamp(selectedSectionId, { width: newWidth, offset: newOffset, align: 'custom' });
              }
            }
          }
        }
      } else if (interaction.mode === 'dragging_subval' && selectedSectionId) {
        const rect = containerRef.current.getBoundingClientRect();
        const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top;
        const sec = sections.find((s) => s.id === selectedSectionId);
        if (sec) {
          const type = interaction.subType;
          const dx = (mx - interaction.dragStart.x) / S;
          const dy = (my - interaction.dragStart.y) / S;
          const st = type === 'stairs' ? sec.stairs : sec.ramp;
          if (st) {
            const dir = typeof st === 'string' ? st : (st.direction || 's');
            const isVert = dir === 'n' || dir === 's';
            const delta = isVert ? dx : dy;
            const newOffset = Math.max(0, interaction.initialOffset + delta);
            
            const width = typeof st === 'object' ? (st.width || 36) : 36;
            const totalLength = isVert ? sec.width : sec.depth;
            const cappedOffset = Math.min(totalLength - width, newOffset);
            
            if (type === 'stairs') {
              updateStairs(selectedSectionId, { offset: cappedOffset, align: 'custom' });
            } else if (type === 'ramp') {
              updateRamp(selectedSectionId, { offset: cappedOffset, align: 'custom' });
            }
          }
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
  }, [isPanning, interaction, selectedSectionId, sections, S, moveSection, setInteraction, updateStairs, updateRamp]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    lastTouchDistRef.current = null;
    if (interaction.mode === 'moving') finishMove();
    if (interaction.mode === 'dragging_subval' || interaction.mode === 'resizing_subobject') setInteraction({ mode: 'idle', dragStart: null });
  }, [interaction, finishMove, setInteraction]);

  // Global keyboard listener to delete active vertex/sub-object/section via Backspace/Delete keys, or confirm tool selection via Enter key
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.target.closest('input, select, textarea')) return;

      // 1. Enter key: save/confirm placing or active tool by switching back to select tool
      if (e.key === 'Enter') {
        if (selectedTool !== 'select') {
          setSelectedTool('select');
          e.preventDefault();
        }
        return;
      }

      // 2. Backspace/Delete key: remove active vertex, sub-object (stairs/ramp), or entire section
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSectionId) {
        const sec = sections.find((s) => s.id === selectedSectionId);
        if (!sec) return;

        // A. Vertex is selected
        if (interaction.selectedVertexIndex !== null && interaction.selectedVertexIndex !== undefined) {
          if (sec.vertices.length <= 3) {
            alert("A deck section must have at least 3 vertices to remain a valid polygon.");
            return;
          }
          removeVertex(selectedSectionId, interaction.selectedVertexIndex);
          e.preventDefault();
        }
        // B. Stairs are selected
        else if (selectedSubObjectType === 'stairs' && sec.stairs) {
          attachStairs(selectedSectionId, sec.stairs.direction || sec.stairs);
          selectSection(selectedSectionId, null);
          e.preventDefault();
        }
        // C. Ramp is selected
        else if (selectedSubObjectType === 'ramp' && sec.ramp) {
          attachRamp(selectedSectionId, sec.ramp.direction || sec.ramp);
          selectSection(selectedSectionId, null);
          e.preventDefault();
        }
        // D. Deck section is selected
        else if (!selectedSubObjectType || selectedSubObjectType === 'deck') {
          if (window.confirm("Are you sure you want to delete this deck section?")) {
            removeSection(selectedSectionId);
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    selectedSectionId,
    sections,
    interaction.selectedVertexIndex,
    selectedSubObjectType,
    selectedTool,
    removeVertex,
    attachStairs,
    attachRamp,
    selectSection,
    removeSection,
    setSelectedTool
  ]);

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
      const getBoardColor = () => {
        const mat = materials.deckMaterial;
        const col = materials.deckColor;
        const opts = DECK_COLOR_OPTIONS[mat] || [];
        const opt = opts.find(o => o.value === col);
        return opt ? opt.color : (DECK_MATERIAL_COLORS[mat] || WOOD_COLORS[materials.species] || '#c4a35a');
      };
      const woodColor = getBoardColor();

      // House wall
      if (sec.ledgerAttached && (visibleLayers.decking || visibleLayers.framing || visibleLayers.foundation || visibleLayers.accessories)) {
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

      // Selection outline fallback if decking is toggled off
      if (!visibleLayers.decking) {
        ctx.strokeStyle = isSelected ? '#1d4ed8' : (isLightTheme ? 'rgba(15, 23, 42, 0.2)' : 'rgba(232, 237, 245, 0.2)');
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash([4, 4]);
        drawVerticesPath(ctx, sec.vertices, S, ox, oy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (visibleLayers.decking) {
        if (sec.type === 'landing') {
          // Landing surface
          ctx.fillStyle = legendColors.joists + '1f'; // ~12% alpha
          drawVerticesPath(ctx, sec.vertices, S, ox, oy);
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#1d4ed8' : legendColors.joists;
          ctx.lineWidth = isSelected ? 2.5 : 2;
          drawVerticesPath(ctx, sec.vertices, S, ox, oy);
          ctx.stroke();

          // Landing double border / pattern
          ctx.strokeStyle = isSelected ? '#3b82f6' : legendColors.joists;
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
          const pictureFrame = sec.pictureFrame || 0;
          const isFlipped = sec.deckingFlipped === true || deckingOpt === 'diagonal-down';
          
          let drawMode = 'horizontal';
          if (deckingOpt === 'diagonal' || deckingOpt === 'diagonal-up' || deckingOpt === 'diagonal-down') {
            drawMode = 'diagonal';
          } else {
            if (joistsVertical) {
              drawMode = (deckingOpt === 'parallel') ? 'vertical' : 'horizontal';
            } else {
              drawMode = (deckingOpt === 'parallel') ? 'horizontal' : 'vertical';
            }
          }
          if (isFlipped && drawMode !== 'diagonal') {
            if (drawMode === 'horizontal') drawMode = 'vertical';
            else if (drawMode === 'vertical') drawMode = 'horizontal';
          }

          // 1. Draw Picture Frame Borders
          const frameWidth = pictureFrame * (bw + gap);
          if (pictureFrame > 0) {
            ctx.save();
            ctx.lineWidth = 0.75;
            for (let k = 0; k < pictureFrame; k++) {
              const offset = k * (bw + gap);
              ctx.beginPath();
              ctx.rect(minX + offset, minY + offset, (maxX - minX) - 2 * offset, (maxY - minY) - 2 * offset);
              ctx.stroke();
            }
            ctx.restore();
          }

          // Define inner field bounds
          const fMinX = minX + frameWidth;
          const fMaxX = maxX - frameWidth;
          const fMinY = minY + frameWidth;
          const fMaxY = maxY - frameWidth;
          const fieldW = fMaxX - fMinX;
          const fieldD = fMaxY - fMinY;

          // Decide if divider is present
          const span = drawMode === 'vertical' ? fieldD : fieldW;
          const spanIn = span / S;
          
          let divCountVal = sec.dividerCount;
          let hasDivider = false;
          let dividerCountNum = 0;
          if (divCountVal === 'auto' || divCountVal === undefined) {
            if (spanIn > 240) {
              hasDivider = true;
              dividerCountNum = 1;
            }
          } else {
            const num = Number(divCountVal);
            if (num > 0) {
              hasDivider = true;
              dividerCountNum = num;
            }
          }

          const boardsPerDiv = sec.boardsPerDivider || 1;
          const divWidth = boardsPerDiv * bw + (boardsPerDiv > 1 ? gap : 0);

          // 2. Draw Divider lines
          if (hasDivider) {
            ctx.save();
            ctx.lineWidth = 0.75;
            for (let k = 0; k < dividerCountNum; k++) {
              const divCenter = (drawMode === 'horizontal')
                ? fMinX + (fieldW / (dividerCountNum + 1)) * (k + 1)
                : fMinY + (fieldD / (dividerCountNum + 1)) * (k + 1);

              const divMin = divCenter - divWidth / 2;
              const divMax = divCenter + divWidth / 2;

              if (drawMode === 'horizontal') {
                // Divider is vertical (runs N-S)
                ctx.beginPath();
                ctx.moveTo(divMin, fMinY); ctx.lineTo(divMin, fMaxY);
                ctx.moveTo(divMax, fMinY); ctx.lineTo(divMax, fMaxY);
                if (boardsPerDiv === 2) {
                  ctx.moveTo(divCenter, fMinY); ctx.lineTo(divCenter, fMaxY);
                }
                ctx.stroke();
              } else if (drawMode === 'vertical') {
                // Divider is horizontal (runs E-W)
                ctx.beginPath();
                ctx.moveTo(fMinX, divMin); ctx.lineTo(fMaxX, divMin);
                ctx.moveTo(fMinX, divMax); ctx.lineTo(fMaxX, divMax);
                if (boardsPerDiv === 2) {
                  ctx.moveTo(fMinX, divCenter); ctx.lineTo(fMaxX, divCenter);
                }
                ctx.stroke();
              }
            }
            ctx.restore();
          }

          // 3. Draw Field Decking Lines
          if (drawMode === 'horizontal') {
            for (let y = fMinY + bw + gap; y < fMaxY - 1; y += bw + gap) {
              ctx.beginPath();
              if (hasDivider) {
                // Split by multiple dividers
                let segments = [{ start: fMinX, end: fMaxX }];
                for (let k = 0; k < dividerCountNum; k++) {
                  const divCenter = fMinX + (fieldW / (dividerCountNum + 1)) * (k + 1);
                  const divMin = divCenter - divWidth / 2;
                  const divMax = divCenter + divWidth / 2;

                  const nextSegments = [];
                  segments.forEach((seg) => {
                    if (seg.end <= divMin) {
                      nextSegments.push(seg);
                    } else if (seg.start >= divMax) {
                      nextSegments.push(seg);
                    } else {
                      if (divMin - seg.start > 0.5) nextSegments.push({ start: seg.start, end: divMin });
                      if (seg.end - divMax > 0.5) nextSegments.push({ start: divMax, end: seg.end });
                    }
                  });
                  segments = nextSegments;
                }
                segments.forEach((seg) => {
                  ctx.moveTo(seg.start, y);
                  ctx.lineTo(seg.end, y);
                });
              } else {
                ctx.moveTo(fMinX, y);
                ctx.lineTo(fMaxX, y);
              }
              ctx.stroke();
            }
          } else if (drawMode === 'vertical') {
            for (let x = fMinX + bw + gap; x < fMaxX - 1; x += bw + gap) {
              ctx.beginPath();
              if (hasDivider) {
                // Split by multiple dividers
                let segments = [{ start: fMinY, end: fMaxY }];
                for (let k = 0; k < dividerCountNum; k++) {
                  const divCenter = fMinY + (fieldD / (dividerCountNum + 1)) * (k + 1);
                  const divMin = divCenter - divWidth / 2;
                  const divMax = divCenter + divWidth / 2;

                  const nextSegments = [];
                  segments.forEach((seg) => {
                    if (seg.end <= divMin) {
                      nextSegments.push(seg);
                    } else if (seg.start >= divMax) {
                      nextSegments.push(seg);
                    } else {
                      if (divMin - seg.start > 0.5) nextSegments.push({ start: seg.start, end: divMin });
                      if (seg.end - divMax > 0.5) nextSegments.push({ start: divMax, end: seg.end });
                    }
                  });
                  segments = nextSegments;
                }
                segments.forEach((seg) => {
                  ctx.moveTo(x, seg.start);
                  ctx.lineTo(x, seg.end);
                });
              } else {
                ctx.moveTo(x, fMinY);
                ctx.lineTo(x, fMaxY);
              }
              ctx.stroke();
            }
          } else if (drawMode === 'diagonal') {
            const step = (bw + gap) * Math.sqrt(2);
            ctx.save();
            ctx.beginPath();
            ctx.rect(fMinX, fMinY, fMaxX - fMinX, fMaxY - fMinY);
            ctx.clip();
            
            for (let offset = fMinX + fMinY - (fMaxX - fMinX); offset < fMaxX + fMaxY + (fMaxX - fMinX); offset += step) {
              ctx.beginPath();
              if (isFlipped) {
                ctx.moveTo(fMinX, offset - (fMaxX - fMinX));
                ctx.lineTo(fMaxX, offset - (fMinX - fMinX)); 
              } else {
                ctx.moveTo(fMinX, offset - fMinX);
                ctx.lineTo(fMaxX, offset - fMaxX);
              }
              ctx.stroke();
            }
            ctx.restore();
          }
          ctx.restore();
        }
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
      if (visibleLayers.framing) {
        ctx.strokeStyle = legendColors.joists;
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

        // Blocking
        if (calcs.joists.blocking && calcs.joists.blocking.enabled && calcs.joists.blocking.segments) {
          ctx.strokeStyle = legendColors.joists;
          ctx.lineWidth = 1.5;
          calcs.joists.blocking.segments.forEach((seg) => {
            ctx.beginPath();
            ctx.moveTo(sx + seg.x1 * S, sy + seg.y1 * S);
            ctx.lineTo(sx + seg.x2 * S, sy + seg.y2 * S);
            ctx.stroke();
          });
        }

        // Beams
        ctx.strokeStyle = legendColors.beams;
        ctx.lineWidth = 3;
        if (joistsVertical) {
          calcs.beams.positions.forEach((yIn) => {
            const y = sy + yIn * S;
            ctx.beginPath(); ctx.moveTo(sx - 6, y); ctx.lineTo(sx + sw + 6, y); ctx.stroke();
          });
        } else {
          calcs.beams.positions.forEach((xIn) => {
            const x = sx + xIn * S;
            ctx.beginPath(); ctx.moveTo(x, sy - 6); ctx.lineTo(x, sy + sd - 6); ctx.stroke();
          });
        }
      }

      // Posts
      if (visibleLayers.foundation) {
        calcs.posts.posts.forEach((post) => {
          const px = sx + post.x * S, py = sy + post.y * S;
          ctx.fillStyle = legendColors.posts + '33'; // ~20% alpha
          ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = legendColors.posts;
          ctx.fillRect(px - 3.5, py - 3.5, 7, 7);
        });
      }

      // Railings
      if (visibleLayers.accessories) {
        Object.entries(sec.railings).forEach(([edge, on]) => {
          if (!on) return;
          ctx.strokeStyle = legendColors.railings;
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (edge === 'n') { ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); }
          if (edge === 's') { ctx.moveTo(sx, sy + sd); ctx.lineTo(sx + sw, sy + sd); }
          if (edge === 'w') { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sd); }
          if (edge === 'e') { ctx.moveTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + sd); }
          ctx.stroke();
        });
      }

      // Stairs
      if (sec.stairs && calcs.stairs && visibleLayers.accessories) {
        const st = calcs.stairs;
        const stairDir = typeof sec.stairs === 'string' ? sec.stairs : (sec.stairs.direction || 's');
        const stairW = st.width * S;
        const stairD = st.totalRun * S;
        
        const isStairsSelected = isSelected && selectedSubObjectType === 'stairs';
        ctx.fillStyle = isStairsSelected 
          ? (isLightTheme ? 'rgba(29, 78, 216, 0.1)' : 'rgba(59, 130, 246, 0.15)')
          : legendColors.stairs + '26'; // ~15% alpha
        ctx.strokeStyle = isStairsSelected 
          ? '#1d4ed8' 
          : legendColors.stairs;
        ctx.lineWidth = isStairsSelected ? 3.0 : 1.5;
        
        let stX, stY;
        const offset = getSubObjectOffset(sec, 'stairs');
        if (stairDir === 's') {
          stX = sx + offset * S;
          stY = sy + sd;
        } else if (stairDir === 'n') {
          stX = sx + offset * S;
          stY = sy - stairD;
        } else if (stairDir === 'e') {
          stX = sx + sw;
          stY = sy + offset * S;
        } else {
          stX = sx - stairD;
          stY = sy + offset * S;
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
        const footprintRun = rm.run + 60 * (rm.intermediateLandings || 0);
        const rampD = footprintRun * S;
        
        const isRampSelected = isSelected && selectedSubObjectType === 'ramp';
        const rampStrokeStyle = isRampSelected 
          ? '#1d4ed8' 
          : null; // fallback to specific segment color if not selected
        const rampLineWidth = isRampSelected ? 3.0 : 1.5;
        
        let rmX, rmY;
        const offset = getSubObjectOffset(sec, 'ramp');
        if (rampDir === 's') {
          rmX = sx + offset * S;
          rmY = sy + sd;
        } else if (rampDir === 'n') {
          rmX = sx + offset * S;
          rmY = sy - rampD;
        } else if (rampDir === 'e') {
          rmX = sx + sw;
          rmY = sy + offset * S;
        } else {
          rmX = sx - rampD;
          rmY = sy + offset * S;
        }
        
        const isVert = rampDir === 'n' || rampDir === 's';
        const rW = isVert ? rampW : rampD;
        const rD = isVert ? rampD : rampW;

        const landingsCount = typeof rm.intermediateLandings === 'number' && !isNaN(rm.intermediateLandings) && rm.intermediateLandings > 0
          ? Math.floor(rm.intermediateLandings)
          : 0;
        const numSegments = landingsCount + 1;
        const safeRun = Math.max(12, typeof rm.run === 'number' && !isNaN(rm.run) ? rm.run : 12);
        const segRun = safeRun / numSegments;
        const landingRun = 60;
        const rampW_in = Math.max(12, typeof rm.width === 'number' && !isNaN(rm.width) ? rm.width : 36);
        const landingW_in = Math.max(60, rampW_in);
        
        let t = 0;
        for (let j = 0; j < 2 * numSegments - 1; j++) {
          const isLanding = j % 2 === 1;
          const length_in = isLanding ? landingRun : segRun;
          const width_in = isLanding ? landingW_in : rampW_in;
          
          const tStart = t;
          const tEnd = t + length_in;
          t = tEnd;
          
          let segX, segY, segW, segH;
          
          if (rampDir === 's') {
            segX = rmX + rampW / 2 - (width_in * S) / 2;
            segY = rmY + tStart * S;
            segW = width_in * S;
            segH = length_in * S;
          } else if (rampDir === 'n') {
            segX = rmX + rampW / 2 - (width_in * S) / 2;
            segY = (rmY + rD) - tEnd * S;
            segW = width_in * S;
            segH = length_in * S;
          } else if (rampDir === 'e') {
            segX = rmX + tStart * S;
            segY = rmY + rampW / 2 - (width_in * S) / 2;
            segW = length_in * S;
            segH = width_in * S;
          } else { // 'w'
            segX = (rmX + rW) - tEnd * S;
            segY = rmY + rampW / 2 - (width_in * S) / 2;
            segW = length_in * S;
            segH = width_in * S;
          }
          
          ctx.fillStyle = isRampSelected
            ? (isLightTheme ? 'rgba(29, 78, 216, 0.1)' : 'rgba(59, 130, 246, 0.15)')
            : (isLanding 
              ? (isLightTheme ? 'rgba(16, 185, 129, 0.15)' : 'rgba(52, 211, 153, 0.2)')
              : legendColors.ramps + '26');
              
          ctx.strokeStyle = rampStrokeStyle || (isLanding
            ? (isLightTheme ? '#10b981' : '#34d399')
            : legendColors.ramps);
            
          ctx.lineWidth = rampLineWidth;
          ctx.fillRect(segX, segY, segW, segH);
          ctx.strokeRect(segX, segY, segW, segH);
          
          if (isLanding) {
            ctx.beginPath();
            ctx.moveTo(segX, segY);
            ctx.lineTo(segX + segW, segY + segH);
            ctx.moveTo(segX + segW, segY);
            ctx.lineTo(segX, segY + segH);
            ctx.strokeStyle = isRampSelected 
              ? 'rgba(29, 78, 216, 0.3)' 
              : (isLightTheme ? 'rgba(16, 185, 129, 0.3)' : 'rgba(52, 211, 153, 0.4)');
            ctx.stroke();
          }
        }
        
        // Draw directional arrows or sloped lines inside the ramp
        ctx.strokeStyle = isRampSelected 
          ? '#1d4ed8' 
          : legendColors.ramps;
        ctx.lineWidth = rampLineWidth;
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

      // Resize handles (selected only, when no sub-object is selected)
      if (isSelected && selectedTool === 'select' && (!selectedSubObjectType || selectedSubObjectType === 'deck')) {
        const handles = getHandlePositions(sec, S);
        Object.values(handles).forEach((pos) => {
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(pos.cx + ox - HANDLE_SIZE/2, pos.cy + oy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.strokeRect(pos.cx + ox - HANDLE_SIZE/2, pos.cy + oy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
        });
      }

      // Vertex handles (selected only, when no sub-object is selected)
      if (isSelected && selectedTool === 'select' && sec.vertices && (!selectedSubObjectType || selectedSubObjectType === 'deck')) {
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

      // Sub-object handles (stairs / ramp selected)
      if (isSelected && selectedTool === 'select' && (selectedSubObjectType === 'stairs' || selectedSubObjectType === 'ramp')) {
        const handles = selectedSubObjectType === 'stairs'
          ? getStairHandlePositions(sec, S, ox, oy, sectionCalcs)
          : getRampHandlePositions(sec, S, ox, oy, sectionCalcs);
        if (handles) {
          Object.values(handles).forEach((pos) => {
            ctx.fillStyle = '#db2777'; // magenta/pink for accessories
            ctx.fillRect(pos.x - HANDLE_SIZE/2, pos.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x - HANDLE_SIZE/2, pos.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
          });
        }
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

    // Native canvas Legend removed - replaced by HTML interactive overlay below

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
    } else if (isAddingVertex) {
      ctx.fillStyle = '#ff9f43'; ctx.font = '500 12px Inter'; ctx.textAlign = 'center';
      ctx.fillText('Click anywhere on a deck edge to insert a new corner', size.w / 2, 24);
    }

    // Draw preview vertex point if adding vertex
    if (isAddingVertex && hoverPos && selectedSectionId) {
      const sec = sections.find((s) => s.id === selectedSectionId);
      if (sec) {
        const hlx = (hoverPos.x - ox) / S;
        const hly = (hoverPos.y - oy) / S;
        const splitIdx = findEdgeSplitIndex(hlx, hly, sec.vertices, 24 / S);
        if (splitIdx !== -1) {
          const snapX = Math.round(hlx / 12) * 12;
          const snapY = Math.round(hly / 12) * 12;
          const px = ox + snapX * S;
          const py = oy + snapY * S;
          
          ctx.strokeStyle = '#ff9f43';
          ctx.fillStyle = '#ff9f43';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px - 3, py);
          ctx.lineTo(px + 3, py);
          ctx.moveTo(px, py - 3);
          ctx.lineTo(px, py + 3);
          ctx.stroke();
        }
      }
    }

  }, [sections, sectionCalcs, materials, selectedSectionId, showGrid, showDimensions, selectedTool, interaction, size, panOffset, zoomScale, isMobile, S, legendColors, isAddingVertex, hoverPos]);

  const cursor = interaction.mode === 'placing' ? 'crosshair' :
    interaction.mode === 'moving' || interaction.mode === 'dragging_vertex' ? 'grabbing' :
    interaction.mode === 'resizing' ? 'nwse-resize' :
    selectedTool === 'rectangle' ? 'crosshair' : 'default';

  const zoomIn = useCallback(() => setZoomScale((z) => Math.min(4, z * 1.25)), []);
  const zoomOut = useCallback(() => setZoomScale((z) => Math.max(0.2, z / 1.25)), []);
  const zoomReset = useCallback(() => { setZoomScale(1); setPanOffset({ x: 0, y: 0 }); }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoomScale((z) => Math.min(4, Math.max(0.2, z * (e.deltaY > 0 ? 0.92 : 1.08))));
  }, []);

  const handleDeletePopupObject = useCallback(() => {
    if (!actionPopup) return;
    const { id, type } = actionPopup;
    const sec = sections.find((s) => s.id === id);
    if (!sec) return;

    if (type === 'stairs' && sec.stairs) {
      attachStairs(id, sec.stairs.direction || sec.stairs);
      selectSection(id, null);
    } else if (type === 'ramp' && sec.ramp) {
      attachRamp(id, sec.ramp.direction || sec.ramp);
      selectSection(id, null);
    } else if (type === 'vertex') {
      const vIdx = actionPopup.vertexIndex;
      if (sec.vertices.length <= 3) {
        showToast("Cannot remove corner: A deck must have at least 3 corners.", "error");
      } else {
        removeVertex(id, vIdx);
        showToast("Corner removed successfully", "success");
      }
      selectSection(id, null);
    } else if (type.startsWith('railing-')) {
      const edge = type.split('-')[1];
      toggleRailing(id, edge);
      showToast("Railing removed", "success");
      selectSection(id, null);
    } else {
      if (window.confirm("Are you sure you want to delete this deck section?")) {
        removeSection(id);
        selectSection(null);
      }
    }
    setActionPopup(null);
    setShowSettingsModal(false);
  }, [actionPopup, sections, attachStairs, attachRamp, removeSection, selectSection, removeVertex, toggleRailing, showToast]);

  const renderStairsSettings = (selectedSec) => {
    const stairObj = selectedSec.stairs;
    if (!stairObj) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="settings-field">
          <label className="settings-label" htmlFor="popup-stair-width">Stair Width (in)</label>
          <HardenedNumberInput
            id="popup-stair-width"
            className="settings-input"
            min={36}
            max={96}
            value={stairObj.width || 36}
            onChange={(val) => updateStairs(selectedSec.id, { width: val })}
            integer={true}
          />
        </div>
        <div className="settings-field">
          <label className="settings-label" htmlFor="popup-stair-steps">Number of Steps</label>
          <HardenedNumberInput
            id="popup-stair-steps"
            className="settings-input"
            min={1}
            max={20}
            value={stairObj.numberOfSteps || 5}
            onChange={(val) => updateStairs(selectedSec.id, { numberOfSteps: val })}
            integer={true}
          />
        </div>
        <div className="settings-field">
          <label className="settings-label" htmlFor="popup-stair-rise">Rise per Step (in)</label>
          <HardenedNumberInput
            id="popup-stair-rise"
            className="settings-input"
            step={0.25}
            min={4}
            max={9}
            value={stairObj.rise || 7.25}
            onChange={(val) => updateStairs(selectedSec.id, { rise: val })}
          />
        </div>
        <div className="settings-field">
          <label className="settings-label" htmlFor="popup-stair-run">Run per Step (in)</label>
          <HardenedNumberInput
            id="popup-stair-run"
            className="settings-input"
            step={0.25}
            min={8}
            max={14}
            value={stairObj.run || 10}
            onChange={(val) => updateStairs(selectedSec.id, { run: val })}
          />
        </div>
      </div>
    );
  };

  const renderRampSettings = (selectedSec) => {
    const rampObj = selectedSec.ramp;
    if (!rampObj) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="settings-field">
          <label className="settings-label" htmlFor="popup-ramp-mode">Ramp Mode</label>
          <select
            id="popup-ramp-mode"
            className="settings-select"
            value={rampObj.mode || 'ada'}
            onChange={(e) => {
              const v = e.target.value;
              const nextRun = v === 'ada' ? selectedSec.height * 12 : selectedSec.height * 8;
              updateRamp(selectedSec.id, { mode: v, run: nextRun });
            }}
          >
            <option value="ada">ADA Compliance (1:12)</option>
            <option value="utility">Utility Mode</option>
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-label" htmlFor="popup-ramp-width">Ramp Width (in)</label>
          <HardenedNumberInput
            id="popup-ramp-width"
            className="settings-input"
            min={36}
            max={96}
            value={rampObj.width || 36}
            onChange={(val) => updateRamp(selectedSec.id, { width: val })}
            integer={true}
          />
        </div>
        <div className="settings-field">
          <label className="settings-label" htmlFor="popup-ramp-run">Ramp Run (in)</label>
          <HardenedNumberInput
            id="popup-ramp-run"
            className="settings-input"
            min={12}
            max={1000}
            value={rampObj.mode === 'ada' ? (selectedSec.height * 12) : (rampObj.run || selectedSec.height * 8)}
            readOnly={rampObj.mode === 'ada'}
            disabled={rampObj.mode === 'ada'}
            style={rampObj.mode === 'ada' ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            onChange={(val) => updateRamp(selectedSec.id, { run: val })}
            integer={true}
          />
        </div>
      </div>
    );
  };

  const renderJoistsTab = (selectedSec) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="settings-field">
          <label className="settings-label">Lumber Species</label>
          <select 
            value={materials.species} 
            onChange={(e) => updateDeck({ species: e.target.value })}
            className="settings-select"
          >
            {SPECIES_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-label">Joist Size</label>
          <select 
            value={materials.joistSize} 
            onChange={(e) => updateDeck({ joistSize: e.target.value })}
            className="settings-select"
          >
            {JOIST_SIZES.map(sz => (
              <option key={sz} value={sz}>{sz}</option>
            ))}
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-label">Joist Spacing</label>
          <select 
            value={materials.joistSpacing} 
            onChange={(e) => updateDeck({ joistSpacing: Number(e.target.value) })}
            className="settings-select"
          >
            {JOIST_SPACINGS.map(sp => (
              <option key={sp} value={sp}>{sp}" o.c.</option>
            ))}
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-label">Joist Direction</label>
          <select 
            value={selectedSec.joistOrientation || 'vertical'} 
            onChange={(e) => updateDeck({ joistOrientation: e.target.value })}
            className="settings-select"
          >
            <option value="vertical">Vertical (N-S)</option>
            <option value="horizontal">Horizontal (E-W)</option>
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-label">Blocking</label>
          <select 
            value={selectedSec.blocking !== false ? 'enabled' : 'disabled'} 
            onChange={(e) => updateDeck({ blocking: e.target.value === 'enabled' })}
            className="settings-select"
          >
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        {selectedSec.blocking !== false && (
          <div className="settings-field">
            <label className="settings-label">Blocking Spacing</label>
            <select 
              value={selectedSec.blockingSpacing !== undefined ? selectedSec.blockingSpacing : 72} 
              onChange={(e) => updateDeck({ blockingSpacing: Number(e.target.value) })}
              className="settings-select"
            >
              <option value={48}>4 ft</option>
              <option value={72}>6 ft (Default)</option>
              <option value={96}>8 ft</option>
            </select>
          </div>
        )}
      </div>
    );
  };

  const renderPostsTab = (selectedSec) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="settings-field">
          <label className="settings-label">Post Size</label>
          <select 
            value={materials.postSize} 
            onChange={(e) => updateDeck({ postSize: e.target.value })}
            className="settings-select"
          >
            {POST_SIZE_OPTIONS.map(sz => (
              <option key={sz} value={sz}>{sz}</option>
            ))}
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-label">Soil Capacity</label>
          <select 
            value={materials.soilCapacity} 
            onChange={(e) => updateDeck({ soilCapacity: Number(e.target.value) })}
            className="settings-select"
          >
            {SOIL_CAPACITIES.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="settings-field" style={{ marginTop: '4px' }}>
          <button
            className={`btn btn--ghost prop-toggle ${selectedSec.ledgerAttached ? 'prop-toggle--on' : ''}`}
            onClick={() => updateDeck({ ledgerAttached: !selectedSec.ledgerAttached })}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {selectedSec.ledgerAttached ? '✓ Attached to house' : '✗ Freestanding deck'}
          </button>
        </div>
      </div>
    );
  };

  const renderBeamsTab = (selectedSec) => {
    const handleViewBeamLayout = () => {
      if (!visibleLayers.framing) {
        toggleLayer('framing', '2d');
      }
      useDeckStore.getState().showToast("Framing layout is visible", "info");
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="settings-field-row">
          <label className="settings-label">Beam Material Species</label>
          <select 
            value={selectedSec.beamSpecies || 'SYP'} 
            onChange={(e) => updateDeck({ beamSpecies: e.target.value })}
            className="settings-select"
            style={{ width: '160px' }}
          >
            {SPECIES_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label.split(' (')[0]}</option>
            ))}
          </select>
        </div>
        
        <div className="settings-field-row">
          <label className="settings-label">Beam Material Grade</label>
          <select 
            value={selectedSec.beamGrade || 'Grade #2'} 
            onChange={(e) => updateDeck({ beamGrade: e.target.value })}
            className="settings-select"
            style={{ width: '160px' }}
          >
            <option value="Grade #1">Grade #1</option>
            <option value="Grade #2">Grade #2</option>
            <option value="Select Structural">Select Structural</option>
          </select>
        </div>

        <div className="settings-field-row">
          <label className="settings-label">Material Size</label>
          <select 
            value={selectedSec.beamSize || '2x10'} 
            onChange={(e) => updateDeck({ beamSize: e.target.value })}
            className="settings-select"
            style={{ width: '160px' }}
          >
            <option value="2x6">2x6</option>
            <option value="2x8">2x8</option>
            <option value="2x10">2x10</option>
            <option value="2x12">2x12</option>
          </select>
        </div>

        <div className="settings-field-row">
          <label className="settings-label">Preferred Beam Plies</label>
          <div className="ply-counter-row">
            <div className="counter-btn-group">
              <button className="counter-btn" onClick={() => updateDeck({ beamPlies: Math.min(4, (selectedSec.beamPlies || 2) + 1) })}>+</button>
              <button className="counter-btn" onClick={() => updateDeck({ beamPlies: Math.max(1, (selectedSec.beamPlies || 2) - 1) })}>−</button>
            </div>
            <span className="counter-val">{selectedSec.beamPlies || 2}</span>
          </div>
        </div>

        <div className="settings-field-row">
          <label className="settings-label">Post Offset From Ends</label>
          <div className="post-offset-input-wrap">
            <HardenedNumberInput
              min={0}
              max={Math.max(0, Math.floor((selectedSec.width - 12) / 2))}
              value={selectedSec.postOffset !== undefined ? selectedSec.postOffset : 6}
              onChange={(val) => updateDeck({ postOffset: val })}
              className="settings-input"
              integer={true}
            />
            <span className="unit-label">" in</span>
          </div>
        </div>

        <div className="settings-field-row">
          <label className="settings-label">Footer Width</label>
          <select 
            value={selectedSec.footerWidth || 12} 
            onChange={(e) => updateDeck({ footerWidth: Number(e.target.value) })}
            className="settings-select"
            style={{ width: '160px' }}
          >
            <option value={12}>12"</option>
            <option value={15}>15"</option>
            <option value={18}>18"</option>
            <option value={24}>24"</option>
          </select>
        </div>

        <button 
          className="settings-action-btn"
          onClick={() => updateDeck({ beamCount: 'auto' })}
        >
          Auto Generate Beams
        </button>

        <button 
          className="settings-action-btn"
          style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-primary)', border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: 'none' }}
          onClick={handleViewBeamLayout}
        >
          View Beam Layout
        </button>
      </div>
    );
  };

  const renderLayoutTab = (selectedSec) => {
    const deckingOpt = selectedSec.deckingOrientation || 'perpendicular';
    const isFlipped = selectedSec.deckingFlipped === true || deckingOpt === 'diagonal-down';

    // Resolve Layout Mode (handle legacy values gracefully)
    const layout = selectedSec.deckingLayout || (
      (deckingOpt === 'diagonal' || deckingOpt === 'diagonal-up' || deckingOpt === 'diagonal-down')
        ? (isFlipped ? 'diagonal-down' : 'diagonal-up')
        : 'straight'
    );
    
    // Stepper help values
    const pictureFrameValue = selectedSec.pictureFrame || 0;
    
    // Resolve divider auto details
    const joistsVertical = (selectedSec.joistOrientation !== 'horizontal');
    let runsVertical = joistsVertical ? (deckingOpt === 'parallel') : (deckingOpt !== 'parallel');
    if (isFlipped) runsVertical = !runsVertical;
    const gap = selectedSec.deckBoardGap !== undefined ? selectedSec.deckBoardGap : 0.125;
    const frameWidth = pictureFrameValue * (5.5 + gap);
    const span = runsVertical ? (selectedSec.depth - 2 * frameWidth) : (selectedSec.width - 2 * frameWidth);
    const spanIn = span;
    
    let isDivAuto = selectedSec.dividerCount === 'auto' || selectedSec.dividerCount === undefined;
    let resolvedDivCount = 0;
    if (isDivAuto) {
      resolvedDivCount = spanIn > 240 ? 1 : 0;
    } else {
      resolvedDivCount = Number(selectedSec.dividerCount);
    }
    
    const boardsPerDiv = selectedSec.boardsPerDivider || 1;
    const showToast = useDeckStore.getState().showToast;
    
    return (
      <div className="layout-tab-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Section 1: Deck Board Layout */}
        <div className="settings-section">
          <div className="settings-section-title" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Deck Board Layout</div>
          <div className="layout-cards" style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
            {/* Straight Card */}
            <div 
              className={`layout-card ${layout === 'straight' ? 'layout-card--active' : ''}`}
              onClick={() => updateDeck({ 
                deckingLayout: 'straight', 
                deckingOrientation: 'perpendicular', 
                deckingFlipped: false 
              })}
            >
              {layout === 'straight' && <div className="layout-card__check-badge">✓</div>}
              <div className="layout-card__preview">
                <svg width="50" height="50" viewBox="0 0 60 60">
                  <rect width="60" height="60" rx="6" fill="#f5d793" stroke="#e0b863" strokeWidth="1" />
                  <line x1="10" y1="0" x2="10" y2="60" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="20" y1="0" x2="20" y2="60" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="30" y1="0" x2="30" y2="60" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="40" y1="0" x2="40" y2="60" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="50" y1="0" x2="50" y2="60" stroke="#8c6c39" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="layout-card__label">Straight</div>
            </div>

            {/* Diagonal Up Card */}
            <div 
              className={`layout-card ${layout === 'diagonal-up' ? 'layout-card--active' : ''}`}
              onClick={() => updateDeck({ 
                deckingLayout: 'diagonal-up', 
                deckingOrientation: 'diagonal-up', 
                deckingFlipped: false 
              })}
            >
              {layout === 'diagonal-up' && <div className="layout-card__check-badge">✓</div>}
              <div className="layout-card__preview">
                <svg width="50" height="50" viewBox="0 0 60 60">
                  <rect width="60" height="60" rx="6" fill="#f5d793" stroke="#e0b863" strokeWidth="1" />
                  <line x1="-20" y1="40" x2="40" y2="-20" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="-10" y1="50" x2="50" y2="-10" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="0" y1="60" x2="60" y2="0" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="10" y1="70" x2="70" y2="10" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="20" y1="80" x2="80" y2="20" stroke="#8c6c39" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="layout-card__label">Diagonal Up</div>
            </div>

            {/* Diagonal Down Card */}
            <div 
              className={`layout-card ${layout === 'diagonal-down' ? 'layout-card--active' : ''}`}
              onClick={() => updateDeck({ 
                deckingLayout: 'diagonal-down', 
                deckingOrientation: 'diagonal-down', 
                deckingFlipped: true 
              })}
            >
              {layout === 'diagonal-down' && <div className="layout-card__check-badge">✓</div>}
              <div className="layout-card__preview">
                <svg width="50" height="50" viewBox="0 0 60 60">
                  <rect width="60" height="60" rx="6" fill="#f5d793" stroke="#e0b863" strokeWidth="1" />
                  <line x1="-20" y1="20" x2="40" y2="80" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="-10" y1="10" x2="50" y2="70" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="0" y1="0" x2="60" y2="60" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="10" y1="-10" x2="70" y2="50" stroke="#8c6c39" strokeWidth="1.5" />
                  <line x1="20" y1="-20" x2="80" y2="40" stroke="#8c6c39" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="layout-card__label">Diagonal Down</div>
            </div>
          </div>
        </div>

        {/* Section 2: Perimeter Boards */}
        <div className="settings-section">
          <div className="settings-row-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="settings-row-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="help-icon" data-tooltip="Number of border boards running parallel to the deck perimeter.">?</div>
              <span className="settings-label">Number Of Perimeter Boards</span>
            </div>
            <div className="stepper-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="stepper-buttons" style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255, 255, 255, 0.08)' }}>
                <button 
                  className="stepper-btn" 
                  onClick={() => updateDeck({ pictureFrame: Math.min(2, pictureFrameValue + 1) })}
                  disabled={pictureFrameValue >= 2}
                  style={{ width: '28px', height: '24px', background: '#ff9f43', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >+</button>
                <div className="stepper-divider" style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
                <button 
                  className="stepper-btn" 
                  onClick={() => updateDeck({ pictureFrame: Math.max(0, pictureFrameValue - 1) })}
                  disabled={pictureFrameValue <= 0}
                  style={{ width: '28px', height: '24px', background: '#ff9f43', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >−</button>
              </div>
              <span className="stepper-value" style={{ minWidth: '16px', textAlign: 'center', fontWeight: '600', color: '#3498db', fontSize: '14px' }}>{pictureFrameValue}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Divider Boards */}
        <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="settings-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="settings-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Divider Boards</span>
            <div className="settings-section-actions" style={{ display: 'flex', gap: '6px' }}>
              <button 
                className="btn-sec-action btn-sec-action--edit" 
                onClick={() => showToast("Divider placement mode enabled (mocked action).")}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '2px' }}>
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                edit
              </button>
              <button 
                className="btn-sec-action btn-sec-action--reset" 
                onClick={() => {
                  updateDeck({ dividerCount: 'auto', boardsPerDivider: 1 });
                  showToast("Divider board settings reset to Auto.");
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '2px' }}>
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                reset
              </button>
            </div>
          </div>

          {/* Dividers Count Stepper */}
          <div className="settings-row-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="settings-row-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="help-icon" data-tooltip="Number of perpendicular boards crossing the deck span to divide boards.">?</div>
              <span className="settings-label">Dividers Count</span>
              {isDivAuto && <span className="auto-badge" style={{ fontSize: '9px', background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', padding: '1px 4px', borderRadius: '3px', marginLeft: '4px' }}>Auto</span>}
            </div>
            <div className="stepper-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="stepper-buttons" style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255, 255, 255, 0.08)' }}>
                <button 
                  className="stepper-btn" 
                  onClick={() => updateDeck({ dividerCount: Math.min(5, resolvedDivCount + 1) })}
                  disabled={resolvedDivCount >= 5}
                  style={{ width: '28px', height: '24px', background: '#ff9f43', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >+</button>
                <div className="stepper-divider" style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
                <button 
                  className="stepper-btn" 
                  onClick={() => updateDeck({ dividerCount: Math.max(0, resolvedDivCount - 1) })}
                  disabled={resolvedDivCount <= 0}
                  style={{ width: '28px', height: '24px', background: '#ff9f43', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >−</button>
              </div>
              <span className="stepper-value" style={{ minWidth: '16px', textAlign: 'center', fontWeight: '600', color: '#3498db', fontSize: '14px' }}>{resolvedDivCount}</span>
            </div>
          </div>

          {/* Boards Per Divider Stepper */}
          <div className="settings-row-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="settings-row-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="help-icon" data-tooltip="Number of boards comprising each perpendicular divider (single or double).">?</div>
              <span className="settings-label">Boards Per Divider</span>
            </div>
            <div className="stepper-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="stepper-buttons" style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255, 255, 255, 0.08)' }}>
                <button 
                  className="stepper-btn" 
                  onClick={() => updateDeck({ boardsPerDivider: 2 })}
                  disabled={boardsPerDiv >= 2}
                  style={{ width: '28px', height: '24px', background: '#ff9f43', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >+</button>
                <div className="stepper-divider" style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
                <button 
                  className="stepper-btn" 
                  onClick={() => updateDeck({ boardsPerDivider: 1 })}
                  disabled={boardsPerDiv <= 1}
                  style={{ width: '28px', height: '24px', background: '#ff9f43', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >−</button>
              </div>
              <span className="stepper-value" style={{ minWidth: '16px', textAlign: 'center', fontWeight: '600', color: '#3498db', fontSize: '14px' }}>{boardsPerDiv}</span>
            </div>
          </div>
        </div>

        {/* Section 4: Other Settings */}
        <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="settings-section-title" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Other Settings</div>

          {/* Deck Board Overhang Select */}
          <div className="settings-row-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="settings-row-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="help-icon" data-tooltip="The distance deck boards extend past the outer rim joist framing.">?</div>
              <span className="settings-label">Deck Board Overhang</span>
            </div>
            <select 
              value={selectedSec.deckBoardOverhang !== undefined ? selectedSec.deckBoardOverhang : 1}
              onChange={(e) => updateDeck({ deckBoardOverhang: Number(e.target.value) })}
              className="blue-text-select"
            >
              <option value={0}>0" in</option>
              <option value={0.5}>0 1/2" in</option>
              <option value={1}>1" in</option>
              <option value={1.5}>1 1/2" in</option>
              <option value={2}>2" in</option>
            </select>
          </div>

          {/* Space Between Boards Select */}
          <div className="settings-row-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="settings-row-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="help-icon" data-tooltip="The physical spacing/gap left between adjacent field deck boards.">?</div>
              <span className="settings-label">Space Between Boards</span>
            </div>
            <select 
              value={selectedSec.deckBoardGap !== undefined ? selectedSec.deckBoardGap : 0.125}
              onChange={(e) => updateDeck({ deckBoardGap: Number(e.target.value) })}
              className="blue-text-select"
            >
              <option value={0}>0" in</option>
              <option value={0.125}>0 1/8" in</option>
              <option value={0.25}>0 1/4" in</option>
              <option value={0.375}>0 3/8" in</option>
              <option value={0.5}>0 1/2" in</option>
            </select>
          </div>
        </div>

        {/* Section 5: Section Dimensions */}
        <div className="settings-section" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px', marginTop: '4px' }}>
          <div className="settings-section-title" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>Section Dimensions</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
            <div className="settings-field">
              <label className="settings-label">Width (in)</label>
              <HardenedNumberInput
                className="settings-input"
                min={36}
                max={480}
                value={selectedSec.width}
                onChange={(val) => updateDeck({ width: val })}
                integer={true}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Depth (in)</label>
              <HardenedNumberInput
                className="settings-input"
                min={36}
                max={480}
                value={selectedSec.depth}
                onChange={(val) => updateDeck({ depth: val })}
                integer={true}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <div className="settings-field">
              <label className="settings-label">Height (in)</label>
              <HardenedNumberInput
                className="settings-input"
                min={12}
                max={168}
                value={selectedSec.height}
                onChange={(val) => updateDeck({ height: val })}
                integer={true}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Type</label>
              <select
                value={selectedSec.type || 'deck'}
                onChange={(e) => updateDeck({ type: e.target.value, ledgerAttached: e.target.value === 'landing' ? false : true })}
                className="settings-select"
              >
                <option value="deck">Deck</option>
                <option value="landing">Landing</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section-divider" style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
        
        <div className="settings-field">
          <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Deck Shape & Corners
          </label>
          <div className="vertex-editor-actions" style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button 
              className={`settings-action-btn ${isAddingVertex ? 'settings-action-btn--active' : ''}`}
              onClick={() => {
                setIsAddingVertex((prev) => {
                  const next = !prev;
                  if (next) {
                    showToast("Click on any deck edge to add a corner point.", "info");
                  }
                  return next;
                });
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: isAddingVertex ? '#ff9f43' : 'rgba(255, 159, 67, 0.12)',
                color: isAddingVertex ? '#fff' : '#ff9f43',
                border: '1px solid rgba(255, 159, 67, 0.4)',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '12px',
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {isAddingVertex ? 'Click Deck Edge...' : 'Add Corner (Vertex)'}
            </button>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block', lineHeight: '1.4' }}>
            {isAddingVertex 
              ? 'Click anywhere on the deck boundary edge to insert a new corner point.' 
              : 'Click "Add Corner" then click any deck boundary edge on the canvas to insert a new corner point.'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="canvas-2d"
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick} onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      style={{ cursor, touchAction: 'none' }}>
      <canvas ref={canvasRef} className="canvas-2d__canvas" />
      
      {/* Interactive Legend Overlay */}
      <div className="canvas-2d__legend" id="canvas-2d-legend">
        {Object.entries(legendColors).map(([key, color]) => (
          <div key={key} className="canvas-2d__legend-item">
            <label className="canvas-2d__legend-swatch" style={{ backgroundColor: color }} title={`Change ${key} color`}>
              <input 
                type="color" 
                value={color} 
                onChange={(e) => setLegendColor(key, e.target.value)} 
                className="canvas-2d__legend-color-input"
              />
            </label>
            <span className="canvas-2d__legend-label">
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          </div>
        ))}
      </div>

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

      {/* Action Popup */}
      {actionPopup && selectedSectionId && (
        <div 
          className="canvas-action-popup animate-fade-in" 
          style={{ 
            position: 'absolute', 
            left: `${actionPopup.x}px`, 
            top: `${actionPopup.y - 55}px`, 
            transform: 'translateX(-50%)',
            zIndex: 110
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="canvas-action-popup__title" style={{ fontSize: '10px', color: '#ff9f43', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '3px' }}>
            {(() => {
              const t = actionPopup.type;
              if (t === 'beam') return 'Beam Selected';
              if (t === 'post') return 'Post Selected';
              if (t === 'joist') return 'Joist Selected';
              if (t === 'vertex') return 'Corner Selected';
              if (t === 'stairs') return 'Stairs Selected';
              if (t === 'ramp') return 'Ramp Selected';
              if (t.startsWith('railing')) {
                const edge = t.split('-')[1]?.toUpperCase() || '';
                return `Railing Selected (${edge})`;
              }
              return 'Deck Selected';
            })()}
          </div>
          <div className="canvas-action-popup__actions" style={{ display: 'flex', gap: '2px' }}>
            <button className="popup-btn popup-btn--settings" onClick={() => {
              const t = actionPopup.type;
              if (t === 'beam') setActiveTab('beams');
              else if (t === 'post') setActiveTab('posts');
              else if (t === 'joist') setActiveTab('joists');
              else if (t === 'deck') setActiveTab('layout');
              else if (t.startsWith('railing')) setActiveTab('layout');
              setShowSettingsModal(true);
              setActionPopup(null);
            }} title="Settings">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>
            <button className="popup-btn popup-btn--delete" onClick={handleDeletePopupObject} title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal Overlay */}
      {showSettingsModal && selectedSectionId && (
        <div className="settings-overlay-modal glass-panel animate-slide-right" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const selectedSec = sections.find((x) => x.id === selectedSectionId) || sections[0];
            const isStairs = selectedSubObjectType === 'stairs';
            const isRamp = selectedSubObjectType === 'ramp';
            const isLanding = selectedSec.type === 'landing';
            
            if (isStairs) {
              return (
                <>
                  <div className="settings-overlay-header">
                    <div className="settings-overlay-tabs">
                      <button className="settings-overlay-tab settings-overlay-tab--active">Stairs</button>
                    </div>
                    <button className="settings-overlay-close" onClick={() => setShowSettingsModal(false)}>✕</button>
                  </div>
                  <div className="settings-overlay-content">
                    {renderStairsSettings(selectedSec)}
                  </div>
                </>
              );
            }

            if (isRamp) {
              return (
                <>
                  <div className="settings-overlay-header">
                    <div className="settings-overlay-tabs">
                      <button className="settings-overlay-tab settings-overlay-tab--active">Ramp</button>
                    </div>
                    <button className="settings-overlay-close" onClick={() => setShowSettingsModal(false)}>✕</button>
                  </div>
                  <div className="settings-overlay-content">
                    {renderRampSettings(selectedSec)}
                  </div>
                </>
              );
            }

            return (
              <>
                <div className="settings-overlay-header">
                  <div className="settings-overlay-tabs">
                    {isLanding ? (
                      <button className="settings-overlay-tab settings-overlay-tab--active">Layout</button>
                    ) : (
                      ['joists', 'posts', 'beams', 'layout'].map((tab) => (
                        <button
                          key={tab}
                          className={`settings-overlay-tab ${activeTab === tab ? 'settings-overlay-tab--active' : ''}`}
                          onClick={() => setActiveTab(tab)}
                        >
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))
                    )}
                  </div>
                  <button className="settings-overlay-close" onClick={() => setShowSettingsModal(false)}>✕</button>
                </div>
                <div className="settings-overlay-content">
                  {isLanding ? (
                    renderLayoutTab(selectedSec)
                  ) : (
                    <>
                      {activeTab === 'joists' && renderJoistsTab(selectedSec)}
                      {activeTab === 'posts' && renderPostsTab(selectedSec)}
                      {activeTab === 'beams' && renderBeamsTab(selectedSec)}
                      {activeTab === 'layout' && renderLayoutTab(selectedSec)}
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
