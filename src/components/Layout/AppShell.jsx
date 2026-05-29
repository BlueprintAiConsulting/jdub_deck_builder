import React, { Suspense, useState, useCallback, useEffect } from 'react';
import Toolbar from './Toolbar';
import ToolPanel from './ToolPanel';
import PropertiesPanel from './PropertiesPanel';
import BomBar from './BomBar';
import Canvas2D from '../Viewport2D/Canvas2D';
import Scene3D from '../Viewport3D/Scene3D';
import { useDeckStore } from '../../store/deckStore';
import { listRecentProjects, loadProjectFromLocalStorage } from '../../lib/projectIO';
import './AppShell.css';

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function AppShell() {
  const viewMode = useDeckStore((s) => s.viewMode);
  const isMobile = useIsMobile();
  const loadProject = useDeckStore((s) => s.loadProject);
  const setCurrentProjectName = useDeckStore((s) => s.setCurrentProjectName);
  const toast = useDeckStore((s) => s.toast);
  const hideToast = useDeckStore((s) => s.hideToast);
  const showToast = useDeckStore((s) => s.showToast);
  const isDirty = useDeckStore((s) => s.isDirty);
  const setDirty = useDeckStore((s) => s.setDirty);
  const sections = useDeckStore((s) => s.sections);
  const materials = useDeckStore((s) => s.materials);
  const currentProjectName = useDeckStore((s) => s.currentProjectName);
  const legendColors = useDeckStore((s) => s.legendColors);

  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftData, setDraftData] = useState(null);

  // Auto-restore last saved project on mount, and check for autosave draft
  useEffect(() => {
    let maxManualTimestamp = 0;
    try {
      const recents = listRecentProjects();
      if (recents && recents.length > 0) {
        const mostRecent = recents[0];
        const data = loadProjectFromLocalStorage(mostRecent);
        if (data && data.sections && data.materials) {
          loadProject(data.sections, data.materials, data.legendColors);
          setCurrentProjectName(mostRecent);
        }
      }

      // Find the maximum timestamp among all manually saved projects
      recents.forEach(name => {
        try {
          const projectData = loadProjectFromLocalStorage(name);
          if (projectData && projectData.timestamp) {
            const t = new Date(projectData.timestamp).getTime();
            if (t > maxManualTimestamp) {
              maxManualTimestamp = t;
            }
          }
        } catch (e) {}
      });
    } catch (err) {
      console.error('Failed to auto-restore last saved project:', err);
    }

    try {
      const rawDraft = localStorage.getItem('deckforge_autosave_draft');
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        if (draft && draft.sections && draft.materials && draft.timestamp) {
          const draftTime = new Date(draft.timestamp).getTime();
          // Trigger the banner if the draft's timestamp is strictly greater than the last saved manual project's timestamp by 2 seconds
          if (draftTime > maxManualTimestamp + 2000) {
            setDraftData(draft);
            setShowDraftBanner(true);
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse autosave draft:', err);
    }
  }, [loadProject, setCurrentProjectName]);

  // Page exit warning when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Debounced background autosave (1.5s delay)
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      try {
        const draft = {
          projectName: currentProjectName,
          sections,
          materials,
          legendColors,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('deckforge_autosave_draft', JSON.stringify(draft));
      } catch (err) {
        console.error('Autosave failed:', err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isDirty, sections, materials, legendColors, currentProjectName]);

  const handleRestoreDraft = useCallback(() => {
    if (draftData && draftData.sections && draftData.materials) {
      loadProject(draftData.sections, draftData.materials, draftData.legendColors);
      if (draftData.projectName) {
        setCurrentProjectName(draftData.projectName);
      }
      setDirty(true);
      showToast('Draft restored successfully!', 'success');
    }
    setShowDraftBanner(false);
  }, [draftData, loadProject, setCurrentProjectName, setDirty, showToast]);

  const handleDiscardDraft = useCallback(() => {
    localStorage.removeItem('deckforge_autosave_draft');
    setShowDraftBanner(false);
    showToast('Draft discarded.', 'info');
  }, [showToast]);

  // Mobile panel state: 'none' | 'tools' | 'properties' | 'bom'
  const [mobilePanel, setMobilePanel] = useState('none');

  const togglePanel = useCallback((panel) => {
    setMobilePanel((prev) => prev === panel ? 'none' : panel);
  }, []);

  const closePanel = useCallback(() => {
    setMobilePanel('none');
  }, []);

  if (isMobile) {
    return (
      <div className="app-shell app-shell--mobile">
        <Toolbar isMobile onToggleTools={() => togglePanel('tools')} onToggleProperties={() => togglePanel('properties')} />
        
        {/* Viewport fills entire mobile screen */}
        <main className="viewport-container viewport-container--mobile" onClick={closePanel}>
          {viewMode === '2d' ? (
            <Canvas2D isMobile />
          ) : (
            <Suspense fallback={<ViewportLoader />}>
              <Scene3D />
            </Suspense>
          )}
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav
          activePanel={mobilePanel}
          onToggle={togglePanel}
        />

        {/* Slide-up panels */}
        {mobilePanel === 'tools' && (
          <MobileSheet title="Tools" onClose={closePanel}>
            <ToolPanel isMobile onClose={closePanel} />
          </MobileSheet>
        )}
        {mobilePanel === 'properties' && (
          <MobileSheet title="Properties" onClose={closePanel}>
            <PropertiesPanel isMobile />
          </MobileSheet>
        )}
        {mobilePanel === 'bom' && (
          <MobileSheet title="Bill of Materials" onClose={closePanel} tall>
            <BomBar isMobile expanded />
          </MobileSheet>
        )}

        {toast && (
          <div className="toast-container">
            <div className={`toast toast--${toast.type || 'success'}`} role="alert">
              <div className="toast__icon">
                {toast.type === 'error' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                ) : toast.type === 'info' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                )}
              </div>
              <div className="toast__message">{toast.message}</div>
              <button className="toast__close" onClick={hideToast} aria-label="Close notification">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {showDraftBanner && (
          <div className="draft-banner" role="alert">
            <div className="draft-banner__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-warm)" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="draft-banner__content">
              <span className="draft-banner__message">
                We found unsaved changes from your last session.
              </span>
            </div>
            <div className="draft-banner__actions">
              <button className="btn btn--primary btn--sm" onClick={handleRestoreDraft}>Restore Draft</button>
              <button className="btn btn--ghost btn--sm" onClick={handleDiscardDraft}>Discard</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="app-shell">
      <Toolbar />
      <div className="app-body">
        <ToolPanel />
        <main className={`viewport-container ${viewMode === 'split' ? 'viewport-container--split' : ''}`}>
          {viewMode === 'split' ? (
            <div className="split-view">
              <div className="split-view__pane split-view__pane--2d">
                <Canvas2D />
              </div>
              <div className="split-view__divider" />
              <div className="split-view__pane split-view__pane--3d">
                <Suspense fallback={<ViewportLoader />}>
                  <Scene3D />
                </Suspense>
              </div>
            </div>
          ) : viewMode === '2d' ? (
            <Canvas2D />
          ) : (
            <Suspense fallback={<ViewportLoader />}>
              <Scene3D />
            </Suspense>
          )}
        </main>
        <PropertiesPanel />
      </div>
      <BomBar />

      {toast && (
        <div className="toast-container">
          <div className={`toast toast--${toast.type || 'success'}`} role="alert">
            <div className="toast__icon">
              {toast.type === 'error' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              ) : toast.type === 'info' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              )}
            </div>
            <div className="toast__message">{toast.message}</div>
            <button className="toast__close" onClick={hideToast} aria-label="Close notification">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {showDraftBanner && (
        <div className="draft-banner" role="alert">
          <div className="draft-banner__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-warm)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="draft-banner__content">
            <span className="draft-banner__message">
              We found unsaved changes from your last session.
            </span>
          </div>
          <div className="draft-banner__actions">
            <button className="btn btn--primary btn--sm" onClick={handleRestoreDraft}>Restore Draft</button>
            <button className="btn btn--ghost btn--sm" onClick={handleDiscardDraft}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileBottomNav({ activePanel, onToggle }) {
  const sqft = useDeckStore((s) => s.sqft);
  const bom = useDeckStore((s) => s.bom);
  const lineItems = bom.length;

  return (
    <nav className="mobile-nav" id="mobile-nav">
      <button
        className={`mobile-nav__btn ${activePanel === 'tools' ? 'mobile-nav__btn--active' : ''}`}
        onClick={() => onToggle('tools')}
        aria-label="Tools"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        <span>Tools</span>
      </button>

      <button
        className={`mobile-nav__btn ${activePanel === 'properties' ? 'mobile-nav__btn--active' : ''}`}
        onClick={() => onToggle('properties')}
        aria-label="Properties"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span>Config</span>
      </button>

      <button
        className={`mobile-nav__btn mobile-nav__btn--center ${activePanel === 'bom' ? 'mobile-nav__btn--active' : ''}`}
        onClick={() => onToggle('bom')}
        aria-label="Bill of Materials"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
        <span>{lineItems} items</span>
      </button>

      <div className="mobile-nav__info">
        <span className="mobile-nav__sqft font-mono">{sqft}</span>
        <span className="mobile-nav__label">sq ft</span>
      </div>
    </nav>
  );
}

function MobileSheet({ title, onClose, children, tall }) {
  // Touch-to-dismiss the sheet by swiping down
  const [startY, setStartY] = useState(null);
  const [deltaY, setDeltaY] = useState(0);

  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
    setDeltaY(0);
  };

  const handleTouchMove = (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) setDeltaY(dy);
  };

  const handleTouchEnd = () => {
    if (deltaY > 80) {
      onClose();
    }
    setStartY(null);
    setDeltaY(0);
  };

  return (
    <>
      <div className="mobile-sheet__backdrop" onClick={onClose} />
      <div
        className={`mobile-sheet ${tall ? 'mobile-sheet--tall' : ''}`}
        style={{ transform: deltaY > 0 ? `translateY(${deltaY}px)` : undefined }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mobile-sheet__handle" />
        <div className="mobile-sheet__header">
          <h2 className="mobile-sheet__title">{title}</h2>
          <button className="btn btn--ghost btn--icon mobile-sheet__close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="mobile-sheet__body">
          {children}
        </div>
      </div>
    </>
  );
}

function ViewportLoader() {
  return (
    <div className="viewport-loader">
      <div className="viewport-loader__spinner" />
      <span>Loading 3D viewport…</span>
    </div>
  );
}
