import React, { useState } from 'react';
import { useDeckStore } from '../../store/deckStore';
import './BomBar.css';

export default function BomBar({ isMobile, expanded: forceExpanded }) {
  const bom = useDeckStore((s) => s.bom);
  const sqft = useDeckStore((s) => s.sqft);
  const [expanded, setExpanded] = useState(false);

  const isExpanded = forceExpanded || expanded;

  const categories = {};
  bom.forEach((item) => {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
  });

  const lineItems = bom.length;
  const totalParts = bom.reduce((sum, item) => sum + item.quantity, 0);

  // Mobile BOM renders directly as a list of cards
  if (isMobile) {
    return (
      <div className="bom-mobile" id="bom-bar">
        <div className="bom-mobile__summary">
          <span className="badge">{lineItems} items</span>
          <span className="bom-bar__parts-count">{totalParts.toLocaleString()} pcs total</span>
          <span className="bom-bar__sqft font-mono">{sqft} sq ft</span>
        </div>

        <div className="bom-mobile__chips">
          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat} className="bom-bar__chip">
              <span className="bom-bar__chip-label">{cat}</span>
              <span className="bom-bar__chip-count">{items.length}</span>
            </div>
          ))}
        </div>

        {/* Card-based BOM for mobile */}
        <div className="bom-mobile__list">
          {bom.map((item) => (
            <div key={item.id} className="bom-card">
              <div className="bom-card__header">
                <span className={`badge badge--${item.category.toLowerCase()} badge--sm`}>{item.category}</span>
                <span className="bom-card__qty font-mono">{item.quantity.toLocaleString()}</span>
              </div>
              <div className="bom-card__desc">{item.description}</div>
              <div className="bom-card__meta">
                <span className="font-mono">{item.size}</span>
                {item.length && <span className="font-mono">{item.length}'</span>}
                <span>{item.unit}</span>
                <span className="text-tertiary">{item.material}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bom-mobile__total">
          <span>Total Parts</span>
          <span className="font-mono bom-bar__qty">{totalParts.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  // Desktop BOM
  return (
    <footer className={`bom-bar ${isExpanded ? 'bom-bar--expanded' : ''}`} id="bom-bar">
      <div
        className="bom-bar__summary"
        onClick={() => setExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label="Toggle bill of materials"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!isExpanded); }}}
      >
        <div className="bom-bar__left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
          <span className="bom-bar__title">Bill of Materials</span>
          <span className="badge">{lineItems} items</span>
          <span className="bom-bar__parts-count">{totalParts.toLocaleString()} pcs total</span>
        </div>

        <div className="bom-bar__chips">
          {Object.entries(categories).map(([cat, items]) => (
            <div key={cat} className="bom-bar__chip">
              <span className="bom-bar__chip-label">{cat}</span>
              <span className="bom-bar__chip-count">{items.length}</span>
            </div>
          ))}
        </div>

        <div className="bom-bar__right">
          <span className="bom-bar__sqft font-mono">{sqft} sq ft</span>
          <button
            className="btn btn--ghost btn--icon bom-bar__toggle"
            aria-label={isExpanded ? 'Collapse BOM' : 'Expand BOM'}
            tabIndex={-1}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="bom-bar__table-wrap animate-slide-up">
          <table className="bom-bar__table" role="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Size</th>
                <th>Length</th>
                <th className="text-right">Qty</th>
                <th>Unit</th>
                <th>Material</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((item) => (
                <tr key={item.id}>
                  <td><span className={`badge badge--${item.category.toLowerCase()}`}>{item.category}</span></td>
                  <td>{item.description}</td>
                  <td className="font-mono">{item.size}</td>
                  <td className="font-mono">{item.length ? `${item.length}'` : '—'}</td>
                  <td className="font-mono bom-bar__qty">{item.quantity.toLocaleString()}</td>
                  <td>{item.unit}</td>
                  <td className="text-tertiary">{item.material}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bom-bar__total-row">
                <td colSpan="4" className="text-right"><strong>Total Parts</strong></td>
                <td className="font-mono bom-bar__qty"><strong>{totalParts.toLocaleString()}</strong></td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </footer>
  );
}
