import React from 'react';
import { useDeckStore } from '../../store/deckStore';
import './ToolPanel.css';

const tools = [
  { id: 'select', label: 'Select', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
    </svg>
  )},
  { id: 'rectangle', label: 'Rectangle', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
    </svg>
  )},
  { id: 'stairs', label: 'Stairs', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20h4v-4h4v-4h4v-4h4"/>
    </svg>
  )},
  { id: 'landing', label: 'Landing', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"/>
      <rect x="7" y="7" width="10" height="10" rx="1"/>
    </svg>
  )},
  { id: 'railing', label: 'Railing', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="4" x2="4" y2="20"/>
      <line x1="20" y1="4" x2="20" y2="20"/>
      <line x1="4" y1="8" x2="20" y2="8"/>
      <line x1="8" y1="8" x2="8" y2="20"/>
      <line x1="12" y1="8" x2="12" y2="20"/>
      <line x1="16" y1="8" x2="16" y2="20"/>
    </svg>
  )},
];

export default function ToolPanel({ isMobile, onClose }) {
  const selectedTool = useDeckStore((s) => s.selectedTool);
  const setSelectedTool = useDeckStore((s) => s.setSelectedTool);
  const showGrid = useDeckStore((s) => s.showGrid);
  const toggleGrid = useDeckStore((s) => s.toggleGrid);
  const resetDeck = useDeckStore((s) => s.resetDeck);
  const viewMode = useDeckStore((s) => s.viewMode);
  const visibleLayers2d = useDeckStore((s) => s.visibleLayers2d || { decking: true, framing: true, foundation: true, accessories: true });
  const visibleLayers3d = useDeckStore((s) => s.visibleLayers3d || { decking: true, framing: true, foundation: true, accessories: true });
  const toggleLayer = useDeckStore((s) => s.toggleLayer);

  const [activeLayerTab, setActiveLayerTab] = React.useState('2d');
  const activeMode = viewMode === 'split' ? activeLayerTab : (viewMode === '3d' ? '3d' : '2d');
  const visibleLayers = activeMode === '3d' ? visibleLayers3d : visibleLayers2d;

  const handleToolSelect = (toolId) => {
    setSelectedTool(toolId);
    if (isMobile && onClose) onClose();
  };

  if (isMobile) {
    return (
      <div className="tool-panel--mobile">
        <div className="tool-mobile__section">
          <span className="label">Tools</span>
          <div className="tool-mobile__grid">
            {tools.map((tool) => (
              <button
                key={tool.id}
                className={`tool-mobile__btn ${selectedTool === tool.id ? 'tool-mobile__btn--active' : ''}`}
                onClick={() => handleToolSelect(tool.id)}
                id={`tool-${tool.id}`}
              >
                {tool.icon}
                <span>{tool.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="divider" />

        <div className="tool-mobile__section">
          <span className="label">View</span>
          <button
            className={`tool-mobile__btn tool-mobile__btn--wide ${showGrid ? 'tool-mobile__btn--active' : ''}`}
            onClick={toggleGrid}
            id="btn-toggle-grid"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="1"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="21" y2="15"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
              <line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
            <span>Grid</span>
          </button>
        </div>

        <div className="divider" />

        <div className="tool-mobile__section">
          <span className="label">Templates</span>
          <button
            className="tool-mobile__template"
            onClick={() => { resetDeck(); if (onClose) onClose(); }}
            id="template-basic"
          >
            <div className="tool-panel__template-rect" />
            <div>
              <div className="tool-panel__template-name">Basic Deck</div>
              <div className="tool-panel__template-size">16' × 12'</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <aside className="tool-panel animate-slide-left" id="tool-panel">
      <div className="tool-panel__section">
        <span className="label">Tools</span>
        <div className="tool-panel__grid">
          {tools.map((tool) => (
            <button
              key={tool.id}
              className={`tool-panel__btn ${selectedTool === tool.id ? 'tool-panel__btn--active' : ''}`}
              onClick={() => setSelectedTool(tool.id)}
              data-tooltip={tool.label}
              id={`tool-${tool.id}`}
            >
              {tool.icon}
              <span className="tool-panel__label">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="divider" />

      <div className="tool-panel__section">
        <span className="label">View</span>
        <button
          className={`tool-panel__btn tool-panel__btn--wide ${showGrid ? 'tool-panel__btn--active' : ''}`}
          onClick={toggleGrid}
          id="btn-toggle-grid"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="1"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
          <span>Grid</span>
        </button>
      </div>

      <div className="divider" />

      <div className="tool-panel__section">
        <span className="label">Templates</span>
        <button
          className="tool-panel__template"
          onClick={resetDeck}
          id="template-basic"
        >
          <div className="tool-panel__template-preview">
            <div className="tool-panel__template-rect" />
          </div>
          <div className="tool-panel__template-info">
            <span className="tool-panel__template-name">Basic Deck</span>
            <span className="tool-panel__template-size">16' × 12'</span>
          </div>
        </button>
      </div>

      <div className="divider" />

      <div className="tool-panel__section">
        <span className="label">Layers</span>
        {viewMode === 'split' && (
          <div className="tool-panel__layer-tabs" id="layer-viewport-tabs">
            <button
              className={`tool-panel__layer-tab ${activeLayerTab === '2d' ? 'tool-panel__layer-tab--active' : ''}`}
              onClick={() => setActiveLayerTab('2d')}
              title="Configure 2D Blueprint Layers"
            >
              2D
            </button>
            <button
              className={`tool-panel__layer-tab ${activeLayerTab === '3d' ? 'tool-panel__layer-tab--active' : ''}`}
              onClick={() => setActiveLayerTab('3d')}
              title="Configure 3D Preview Layers"
            >
              3D
            </button>
          </div>
        )}
        <div className="tool-panel__grid">
          <button
            className={`tool-panel__btn ${visibleLayers.decking ? 'tool-panel__btn--active' : ''}`}
            onClick={() => toggleLayer('decking', activeMode)}
            data-tooltip={visibleLayers.decking ? "Hide Decking" : "Show Decking"}
            id="btn-layer-decking"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18v4H3V6zm0 8h18v4H3v-4z"/>
            </svg>
            <span className="tool-panel__label">Decking</span>
          </button>
          
          <button
            className={`tool-panel__btn ${visibleLayers.framing ? 'tool-panel__btn--active' : ''}`}
            onClick={() => toggleLayer('framing', activeMode)}
            data-tooltip={visibleLayers.framing ? "Hide Framing" : "Show Framing"}
            id="btn-layer-framing"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
            </svg>
            <span className="tool-panel__label">Framing</span>
          </button>

          <button
            className={`tool-panel__btn ${visibleLayers.foundation ? 'tool-panel__btn--active' : ''}`}
            onClick={() => toggleLayer('foundation', activeMode)}
            data-tooltip={visibleLayers.foundation ? "Hide Foundation" : "Show Foundation"}
            id="btn-layer-foundation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M5 17h14M8 12h8M10 7h4"/>
            </svg>
            <span className="tool-panel__label">Posts</span>
          </button>

          <button
            className={`tool-panel__btn ${visibleLayers.accessories ? 'tool-panel__btn--active' : ''}`}
            onClick={() => toggleLayer('accessories', activeMode)}
            data-tooltip={visibleLayers.accessories ? "Hide Accessories" : "Show Accessories"}
            id="btn-layer-accessories"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19h16M4 15h12M4 11h8M4 7h4M20 5v14"/>
            </svg>
            <span className="tool-panel__label">Railings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
