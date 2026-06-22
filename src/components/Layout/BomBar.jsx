import React, { useState } from 'react';
import { useDeckStore } from '../../store/deckStore';
import { generateDeckSpecsPDF } from '../../utils/pdfExport';
import './BomBar.css';

export default function BomBar({ isMobile, expanded: forceExpanded }) {
  const bom = useDeckStore((s) => s.bom);
  const sqft = useDeckStore((s) => s.sqft);
  const unitPrices = useDeckStore((s) => s.materials.unitPrices);
  const materials = useDeckStore((s) => s.materials || { wasteFactor: 10 });
  const updateDeck = useDeckStore((s) => s.updateDeck);
  const [expanded, setExpanded] = useState(false);

  const handleExportPDF = (e) => {
    e.stopPropagation();
    const state = useDeckStore.getState();
    generateDeckSpecsPDF(state);
  };

  const isExpanded = forceExpanded || expanded;
  const wasteFactor = materials.wasteFactor ?? 10;

  const categories = {};
  bom.forEach((item) => {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
  });

  const lineItems = bom.length;
  const totalParts = bom.reduce((sum, item) => sum + item.quantity, 0);

  const getItemCost = (item) => {
    const priceKey = (unitPrices && (unitPrices[item.size] !== undefined))
      ? item.size
      : item.id;
    const unitPrice = (unitPrices && unitPrices[priceKey] !== undefined)
      ? unitPrices[priceKey]
      : 1.00;
    const total = item.length
      ? unitPrice * item.length * item.quantity
      : unitPrice * item.quantity;
    return { unitPrice, total };
  };

  const grandTotalCost = bom.reduce((sum, item) => {
    const { total } = getItemCost(item);
    return sum + total;
  }, 0);

  // Mobile BOM renders directly as a list of cards
  if (isMobile) {
    return (
      <div className="bom-mobile" id="bom-bar">
        <div className="bom-mobile__summary">
          <span className="badge">{lineItems} items</span>
          <span className="bom-bar__parts-count">{totalParts.toLocaleString()} pcs total</span>
          <span className="badge badge--green font-mono">${grandTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} est.</span>
          <span className="bom-bar__sqft font-mono">{sqft} sq ft</span>
          <span className="bom-bar__total-cost font-mono" style={{ color: 'var(--accent-green)', fontWeight: 'bold', marginLeft: 'auto' }}>${grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn--primary btn--sm" onClick={handleExportPDF}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export PDF Specs
          </button>
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
          {bom.map((item) => {
            const { unitPrice, total } = getItemCost(item);
            return (
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
                <div className="bom-card__price font-mono" style={{ fontSize: '11px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Unit: ${unitPrice.toFixed(2)}{item.length ? '/LF' : ''}</span>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>Cost: ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bom-mobile__total">
          <span>Total Cost Estimate</span>
          <span className="font-mono bom-bar__qty text-green" style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>
            ${grandTotalCost.toFixed(2)}
          </span>
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
          <span className="badge badge--green font-mono" style={{ marginLeft: '12px', fontSize: '11px', fontWeight: 'bold' }}>
            ${grandTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} est.
          </span>
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
          <button 
            className="btn btn--secondary btn--sm" 
            style={{ marginRight: '16px', display: 'flex', alignItems: 'center' }}
            onClick={handleExportPDF}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export PDF Specs
          </button>
          <span className="bom-bar__total-cost font-mono" style={{ color: 'var(--accent-green)', fontWeight: 'bold', marginRight: '16px', fontSize: '14px' }}>Total: ${grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
          <div className="bom-bar__config-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)' }}>
            <div className="bom-bar__waste-ctrl" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="label" style={{ margin: 0, textTransform: 'none', fontSize: 'var(--text-sm)' }}>Wastage Factor:</span>
              <div className="btn-group" style={{ display: 'flex', gap: '2px', background: 'var(--bg-primary)', padding: '2px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-default)' }}>
                {[0, 5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    className={`btn btn--xs ${wasteFactor === pct ? 'btn--active' : 'btn--ghost'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateDeck({ wasteFactor: pct });
                    }}
                    style={{ minWidth: '36px', height: '22px', padding: 0 }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <div className="bom-bar__cost-summary" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Estimated project material cost: <strong style={{ color: 'var(--accent-green)', fontSize: 'var(--text-md)' }}>${grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          </div>
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
                <th className="text-right">Unit Price</th>
                <th className="text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((item) => {
                const { unitPrice, total } = getItemCost(item);
                return (
                  <tr key={item.id}>
                    <td><span className={`badge badge--${item.category.toLowerCase()}`}>{item.category}</span></td>
                    <td>{item.description}</td>
                    <td className="font-mono">{item.size}</td>
                    <td className="font-mono">{item.length ? `${item.length}'` : '—'}</td>
                    <td className="font-mono bom-bar__qty">{item.quantity.toLocaleString()}</td>
                    <td>{item.unit}</td>
                    <td className="text-tertiary">{item.material}</td>
                    <td className="font-mono text-right">${unitPrice.toFixed(2)}{item.length ? '/LF' : ''}</td>
                    <td className="font-mono text-right" style={{ color: '#10b981', fontWeight: '500' }}>${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bom-bar__total-row">
                <td colSpan="4" className="text-right"><strong>Total Parts / Cost</strong></td>
                <td className="font-mono bom-bar__qty"><strong>{totalParts.toLocaleString()}</strong></td>
                <td colSpan="3"></td>
                <td className="font-mono text-right" style={{ color: 'var(--accent-green)', fontSize: '13px' }}><strong>${grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </footer>
  );
}
