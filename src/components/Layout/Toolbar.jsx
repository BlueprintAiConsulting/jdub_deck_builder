import React, { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDeckStore } from '../../store/deckStore';
import { useShallow } from 'zustand/react/shallow';
import { formatDimension } from '../../utils/units';
import {
  downloadProjectFile,
  saveProjectToLocalStorage,
  loadProjectFromLocalStorage,
  deleteProjectFromLocalStorage,
  listRecentProjects,
  parseDeckFile
} from '../../lib/projectIO';
import './Toolbar.css';

function exportPDF() {
  import('jspdf').then(({ jsPDF }) => {
    const state = useDeckStore.getState();
    const sec = state.sections.find((s) => s.id === state.selectedSectionId) || state.sections[0];
    const deck = { ...state.materials, ...sec };
    const calcs = state.sectionCalcs[sec.id];
    const { bom, sqft } = state;
    const doc = new jsPDF('p', 'mm', 'letter');

    doc.setFillColor(6, 10, 20);
    doc.rect(0, 0, 216, 30, 'F');
    doc.setTextColor(78, 142, 247);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DeckForge', 14, 18);
    doc.setTextColor(139, 157, 195);
    doc.setFontSize(10);
    doc.text('Deck Design & Material Report', 14, 25);
    doc.setTextColor(245, 166, 35);
    doc.text(`${formatDimension(deck.width)} × ${formatDimension(deck.depth)}  •  ${sqft} sq ft`, 160, 18);

    let y = 40;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Deck Specifications', 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const specs = [
      ['Width', formatDimension(deck.width)],
      ['Depth', formatDimension(deck.depth)],
      ['Height', formatDimension(deck.height)],
      ['Square Footage', `${sqft} sq ft`],
      ['Lumber Species', deck.species],
      ['Joist Size', deck.joistSize],
      ['Joist Spacing', `${deck.joistSpacing}" o.c.`],
      ['Beam Config', deck.beamConfig],
      ['Post Size', deck.postSize],
      ['Deck Board', deck.deckBoardSize || '5/4x6'],
      ['Ledger', deck.ledgerAttached ? 'Attached' : 'Freestanding'],
      ['Soil Capacity', `${deck.soilCapacity} psf`],
    ];
    specs.forEach(([label, value]) => {
      doc.setTextColor(100, 116, 139);
      doc.text(label, 14, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(value, 80, y);
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    });

    y += 6;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Structural Summary', 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const structural = [
      ['Max Joist Span', formatDimension(calcs.joists.maxSpan)],
      ['Joist Count', String(calcs.joists.count)],
      ['Beam Count', String(calcs.beams.count)],
      ['Post Count', String(calcs.posts.posts.length)],
      ['Footing Diameter', `${calcs.footings.diameter}"`],
      ['Tributary Area', `${calcs.footings.tributaryArea} sq ft`],
    ];
    structural.forEach(([label, value]) => {
      doc.setTextColor(100, 116, 139);
      doc.text(label, 14, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(value, 80, y);
      doc.setFont('helvetica', 'normal');
      y += 5.5;
    });

    y += 6;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Bill of Materials', 14, y);
    y += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Description', 14, y);
    doc.text('Size', 100, y);
    doc.text('Length', 120, y);
    doc.text('Qty', 145, y);
    doc.text('Unit', 160, y);
    doc.text('Material', 175, y);
    y += 2;
    doc.setDrawColor(200, 210, 220);
    doc.line(14, y, 200, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    bom.forEach((item) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.text(item.description, 14, y);
      doc.text(item.size, 100, y);
      doc.text(item.length ? `${item.length}'` : '—', 120, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(245, 166, 35);
      doc.text(String(item.quantity), 145, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(item.unit, 160, y);
      doc.text(item.material, 175, y);
      y += 5;
    });

    y += 3;
    doc.setDrawColor(200, 210, 220);
    doc.line(14, y, 200, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Parts:', 100, y);
    doc.setTextColor(245, 166, 35);
    const totalParts = bom.reduce((sum, item) => sum + item.quantity, 0);
    doc.text(totalParts.toLocaleString(), 145, y);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(139, 157, 195);
      doc.text('Generated by DeckForge  •  IRC R507 Compliant  •  For estimation purposes only', 14, 272);
      doc.text(`Page ${i} of ${pageCount}`, 190, 272);
    }

    doc.save(`DeckForge_${deck.width / 12}x${deck.depth / 12}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }).catch((err) => {
    console.error('Failed to load jsPDF:', err);
    alert('PDF export requires an internet connection for the first use.');
  });
}

export default function Toolbar({ isMobile }) {
  const viewMode = useDeckStore((s) => s.viewMode);
  const setViewMode = useDeckStore((s) => s.setViewMode);
  const undo = useDeckStore((s) => s.undo);
  const redo = useDeckStore((s) => s.redo);
  const historyIndex = useDeckStore((s) => s.historyIndex);
  const historyLength = useDeckStore((s) => s.history.length);
  const deck = useDeckStore(useShallow((s) => {
    const sec = s.sections.find((x) => x.id === s.selectedSectionId) || s.sections[0];
    return { ...s.materials, ...sec };
  }));
  const sqft = useDeckStore((s) => s.sqft);
  const sectionCount = useDeckStore((s) => s.sections.length);
  const calcs = useDeckStore(useShallow((s) => {
    const c = s.sectionCalcs[s.selectedSectionId];
    if (!c) return { joists: 0, beams: 0, posts: 0 };
    return { joists: c.joists.count, beams: c.beams.count, posts: c.posts.posts.length };
  }));

  // Project save/load states
  const [currentProjectName, setCurrentProjectName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [tempProjectName, setTempProjectName] = useState('');
  const [recentProjects, setRecentProjects] = useState([]);
  const fileInputRef = useRef(null);

  const sections = useDeckStore((s) => s.sections);
  const materials = useDeckStore((s) => s.materials);
  const loadProject = useDeckStore((s) => s.loadProject);
  const theme = useDeckStore((s) => s.theme);
  const toggleTheme = useDeckStore((s) => s.toggleTheme);

  const confirmSaveAs = () => {
    const trimmed = tempProjectName.trim();
    if (!trimmed) return;
    
    setCurrentProjectName(trimmed);
    setShowSaveModal(false);
    
    // Save to local file & localStorage
    downloadProjectFile(trimmed, sections, materials);
    saveProjectToLocalStorage(trimmed, sections, materials);
  };

  const handleSaveAsClick = useCallback(() => {
    setTempProjectName(currentProjectName || 'My Deck Project');
    setShowSaveModal(true);
  }, [currentProjectName]);

  const handleSaveClick = useCallback(() => {
    if (!currentProjectName) {
      handleSaveAsClick();
    } else {
      downloadProjectFile(currentProjectName, sections, materials);
      saveProjectToLocalStorage(currentProjectName, sections, materials);
    }
  }, [currentProjectName, sections, materials, handleSaveAsClick]);

  const handleOpenClick = () => {
    setRecentProjects(listRecentProjects());
    setShowOpenModal(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await parseDeckFile(file);
      loadProject(data.sections, data.materials);
      setCurrentProjectName(data.projectName || file.name.replace(/\.deck$/, ''));
      setShowOpenModal(false);
    } catch (err) {
      alert(err.message || 'Error loading project file.');
    }
    e.target.value = '';
  };

  const handleLoadRecent = (name) => {
    try {
      const data = loadProjectFromLocalStorage(name);
      loadProject(data.sections, data.materials);
      setCurrentProjectName(name);
      setShowOpenModal(false);
    } catch (err) {
      alert(err.message || 'Error loading project.');
    }
  };

  const handleDeleteRecent = (e, name) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteProjectFromLocalStorage(name);
      setRecentProjects(listRecentProjects());
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if (isMeta && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
    if (isMeta && e.key === 'y') { e.preventDefault(); redo(); }
    if (isMeta && e.key === 's') { e.preventDefault(); handleSaveClick(); }
    if (e.key === '2' && !e.metaKey && !e.ctrlKey && !e.target.closest('input, select')) setViewMode('2d');
    if (e.key === '3' && !e.metaKey && !e.ctrlKey && !e.target.closest('input, select')) setViewMode('3d');
    if (e.key === '4' && !e.metaKey && !e.ctrlKey && !e.target.closest('input, select')) setViewMode('split');
  }, [undo, redo, setViewMode, handleSaveClick]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderModals = () => {
    return createPortal(
      <>
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".deck"
          style={{ display: 'none' }}
        />

        {/* Save Modal */}
        {showSaveModal && (
          <div className="toolbar-modal__backdrop" onClick={() => setShowSaveModal(false)}>
            <div className="toolbar-modal__card" onClick={(e) => e.stopPropagation()}>
              <h3 className="toolbar-modal__title">Save Project As</h3>
              <div className="toolbar-modal__body">
                <label htmlFor="modalProjectName" className="label">Project Name</label>
                <input
                  id="modalProjectName"
                  className="input"
                  type="text"
                  value={tempProjectName}
                  onChange={(e) => setTempProjectName(e.target.value)}
                  placeholder="Enter project name..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmSaveAs();
                    }
                  }}
                />
              </div>
              <div className="toolbar-modal__actions">
                <button className="btn btn--ghost" onClick={() => setShowSaveModal(false)}>Cancel</button>
                <button className="btn btn--primary" onClick={confirmSaveAs} disabled={!tempProjectName.trim()}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Open Modal */}
        {showOpenModal && (
          <div className="toolbar-modal__backdrop" onClick={() => setShowOpenModal(false)}>
            <div className="toolbar-modal__card" onClick={(e) => e.stopPropagation()}>
              <h3 className="toolbar-modal__title">Open Project</h3>
              <div className="toolbar-modal__body">
                <button className="btn btn--primary btn--full" onClick={() => fileInputRef.current?.click()} style={{ marginBottom: '16px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload .deck File
                </button>

                <h4 className="toolbar-modal__subtitle">Recent Projects</h4>
                {recentProjects.length === 0 ? (
                  <p className="toolbar-modal__empty">No recent projects found on this device.</p>
                ) : (
                  <div className="toolbar-modal__recents-list">
                    {recentProjects.map((name) => (
                      <div key={name} className="toolbar-modal__recent-item" onClick={() => handleLoadRecent(name)}>
                        <span className="toolbar-modal__recent-name">{name}</span>
                        <button
                          className="btn btn--ghost btn--sm btn--icon toolbar-modal__delete-btn"
                          onClick={(e) => handleDeleteRecent(e, name)}
                          aria-label={`Delete ${name}`}
                          title="Delete project"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="toolbar-modal__actions">
                <button className="btn btn--ghost" onClick={() => setShowOpenModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </>,
      document.body
    );
  };

  if (isMobile) {
    return (
      <header className="toolbar toolbar--mobile" id="main-toolbar">
        <div className="toolbar__brand toolbar__brand--mobile">
          <span className="toolbar__title toolbar__title--mobile">
            DeckForge
            {currentProjectName && <span className="toolbar__project-name-mobile"> | {currentProjectName}</span>}
          </span>
        </div>

        <div className="toolbar__view-toggle toolbar__view-toggle--mobile">
          <button
            className={`btn btn--ghost toolbar__view-btn ${viewMode === '2d' ? 'btn--active' : ''}`}
            onClick={() => setViewMode('2d')}
            id="btn-view-2d"
          >2D</button>
          <button
            className={`btn btn--ghost toolbar__view-btn ${viewMode === '3d' ? 'btn--active' : ''}`}
            onClick={() => setViewMode('3d')}
            id="btn-view-3d"
          >3D</button>
        </div>

        <div className="toolbar__mobile-dims">
          {formatDimension(deck.width)} × {formatDimension(deck.depth)}
        </div>

        <div style={{ flex: 1 }} />

        {/* Undo/Redo */}
        <button className="btn btn--ghost btn--icon" onClick={undo} disabled={historyIndex <= 0} aria-label="Undo" id="btn-undo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </button>
        <button className="btn btn--ghost btn--icon" onClick={redo} disabled={historyIndex >= historyLength - 1} aria-label="Redo" id="btn-redo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
          </svg>
        </button>

        {/* Mobile Open & Save */}
        <button className="btn btn--ghost btn--icon" onClick={handleOpenClick} aria-label="Open Project" id="btn-open-mobile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button className="btn btn--ghost btn--icon" onClick={handleSaveClick} aria-label="Save Project" id="btn-save-mobile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          </svg>
        </button>

        <button
          className="btn btn--ghost btn--icon"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          id="btn-theme-toggle-mobile"
        >
          {theme === 'light' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          )}
        </button>

        <button className="btn btn--primary btn--icon toolbar__export-mobile" onClick={exportPDF} aria-label="Export PDF" id="btn-export">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        {renderModals()}
      </header>
    );
  }

  // Desktop toolbar
  return (
    <header className="toolbar" id="main-toolbar" role="toolbar" aria-label="Main toolbar">
      <div className="toolbar__brand">
        <div className="toolbar__logo">
          <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient id="tg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4e8ef7"/>
                <stop offset="100%" stopColor="#9b6dff"/>
              </linearGradient>
            </defs>
            <rect x="4" y="28" width="56" height="6" rx="2" fill="url(#tg)"/>
            <rect x="8" y="36" width="4" height="20" rx="1" fill="#4e8ef7" opacity="0.8"/>
            <rect x="26" y="36" width="4" height="24" rx="1" fill="#4e8ef7" opacity="0.8"/>
            <rect x="52" y="36" width="4" height="20" rx="1" fill="#4e8ef7" opacity="0.8"/>
            <rect x="6" y="22" width="52" height="4" rx="1" fill="#f5a623" opacity="0.9"/>
            <rect x="6" y="16" width="52" height="4" rx="1" fill="#f5a623" opacity="0.7"/>
            <rect x="6" y="10" width="52" height="4" rx="1" fill="#f5a623" opacity="0.5"/>
          </svg>
        </div>
        <span className="toolbar__title">
          DeckForge
          {currentProjectName && <span className="toolbar__project-name"> | {currentProjectName}</span>}
        </span>
      </div>

      <div className="toolbar__group">
        <div className="toolbar__view-toggle" role="radiogroup" aria-label="Viewport mode">
          <button className={`btn btn--ghost toolbar__view-btn ${viewMode === '2d' ? 'btn--active' : ''}`} onClick={() => setViewMode('2d')} id="btn-view-2d" role="radio" aria-checked={viewMode === '2d'} data-tooltip="Blueprint View [2]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            2D
          </button>
          <button className={`btn btn--ghost toolbar__view-btn ${viewMode === '3d' ? 'btn--active' : ''}`} onClick={() => setViewMode('3d')} id="btn-view-3d" role="radio" aria-checked={viewMode === '3d'} data-tooltip="3D Preview [3]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            3D
          </button>
          <button className={`btn btn--ghost toolbar__view-btn ${viewMode === 'split' ? 'btn--active' : ''}`} onClick={() => setViewMode('split')} id="btn-view-split" role="radio" aria-checked={viewMode === 'split'} data-tooltip="Split View [4]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
            Split
          </button>
        </div>
      </div>

      {/* Dimension chip */}
      <div className="toolbar__group toolbar__dims">
        <span className="toolbar__dim-label">{formatDimension(deck.width)} × {formatDimension(deck.depth)}</span>
        <span className="badge badge--warm">{sqft} sq ft</span>
        {sectionCount > 1 && (
          <span className="badge">{sectionCount} sections</span>
        )}
      </div>

      {/* Calc summary */}
      <div className="toolbar__calc-summary">
        <span className="toolbar__calc-chip" style={{ color: 'var(--accent-primary)' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="4" x2="4" y2="20"/></svg>
          {calcs.joists}
        </span>
        <span className="toolbar__calc-chip" style={{ color: 'var(--accent-warm)' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="12" x2="20" y2="12"/></svg>
          {calcs.beams}
        </span>
        <span className="toolbar__calc-chip" style={{ color: 'var(--accent-red)' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="6" y="6" width="12" height="12"/></svg>
          {calcs.posts}
        </span>
      </div>

      <div className="toolbar__group">
        <button className="btn btn--ghost btn--icon" onClick={undo} disabled={historyIndex <= 0} aria-label="Undo (Ctrl+Z)" data-tooltip="Undo [⌘Z]" id="btn-undo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </button>
        <button className="btn btn--ghost btn--icon" onClick={redo} disabled={historyIndex >= historyLength - 1} aria-label="Redo (Ctrl+Shift+Z)" data-tooltip="Redo [⌘⇧Z]" id="btn-redo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
        </button>
      </div>

      <div style={{ flex: 1 }} />

      <div className="toolbar__group">
        {/* Save & Load controls */}
        <button className="btn btn--secondary btn--icon" onClick={handleOpenClick} aria-label="Open design" data-tooltip="Open Design" id="btn-open">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Open
        </button>
        <button className="btn btn--secondary btn--icon" onClick={handleSaveClick} aria-label="Save design" data-tooltip="Save Design" id="btn-save">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Save
        </button>
        <button className="btn btn--secondary btn--icon" onClick={handleSaveAsClick} aria-label="Save design as" data-tooltip="Save Design As" id="btn-save-as">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Save As
        </button>

        <button
          className="btn btn--ghost btn--icon"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          data-tooltip={theme === 'light' ? 'Dark Theme' : 'Light Theme'}
          id="btn-theme-toggle"
        >
          {theme === 'light' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          )}
        </button>
        
        <button className="btn btn--primary" id="btn-export" onClick={exportPDF} aria-label="Export PDF report" data-tooltip="Export PDF Report">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export PDF
        </button>
      </div>
      {renderModals()}
    </header>
  );
}
