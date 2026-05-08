import React, { Suspense, useState, useCallback, useEffect } from 'react';
import Toolbar from './Toolbar';
import ToolPanel from './ToolPanel';
import PropertiesPanel from './PropertiesPanel';
import BomBar from './BomBar';
import Canvas2D from '../Viewport2D/Canvas2D';
import Scene3D from '../Viewport3D/Scene3D';
import { useDeckStore } from '../../store/deckStore';
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
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="app-shell">
      <Toolbar />
      <div className="app-body">
        <ToolPanel />
        <main className="viewport-container">
          {viewMode === '2d' ? (
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
