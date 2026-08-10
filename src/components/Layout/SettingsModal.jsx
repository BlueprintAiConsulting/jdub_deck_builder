import React, { useState, useEffect } from 'react';
import { useDeckStore } from '../../store/deckStore';
import './SettingsModal.css';

const DEFAULT_PRICES = {
  '2x8': 1.20,
  '2x10': 1.50,
  '2x12': 2.00,
  '6x6': 3.00,
  '5/4x6': 0.80,
  'concrete': 6.00,
  'joist-hangers': 1.50,
  'post-bases': 7.50,
  'screws': 0.08,
  'ledger-loks': 1.25,
  'z-flashing': 8.50,
};

const CATEGORIES = [
  {
    title: 'Lumber (per Linear Foot)',
    keys: ['2x8', '2x10', '2x12', '6x6', '5/4x6']
  },
  {
    title: 'Hardware (per unit)',
    keys: ['joist-hangers', 'post-bases', 'screws', 'ledger-loks', 'z-flashing']
  },
  {
    title: 'Concrete',
    keys: ['concrete']
  }
];

const LABELS = {
  '2x8': '2x8 Joists/Beams',
  '2x10': '2x10 Joists/Beams',
  '2x12': '2x12 Joists/Beams',
  '6x6': '6x6 Posts',
  '5/4x6': '5/4x6 Deck Boards',
  'joist-hangers': 'Joist Hangers',
  'post-bases': 'Post Bases',
  'screws': 'Structural Screws',
  'ledger-loks': 'LedgerLOKs',
  'z-flashing': 'Z-Flashing (10ft roll)',
  'concrete': 'Concrete (60lb bag)',
};

export default function SettingsModal({ isOpen, onClose }) {
  const storePrices = useDeckStore(s => s.materials.unitPrices || {});
  const updateDeck = useDeckStore(s => s.updateDeck);
  
  const [localPrices, setLocalPrices] = useState({});

  useEffect(() => {
    if (isOpen) {
      setLocalPrices({ ...DEFAULT_PRICES, ...storePrices });
    }
  }, [isOpen, storePrices]);

  if (!isOpen) return null;

  const handleChange = (key, val) => {
    setLocalPrices(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    const parsedPrices = {};
    Object.keys(localPrices).forEach(k => {
      parsedPrices[k] = parseFloat(localPrices[k]) || 0;
    });
    updateDeck({ unitPrices: parsedPrices });
    onClose();
  };

  const handleReset = () => {
    setLocalPrices({ ...DEFAULT_PRICES });
  };

  return (
    <div className="toolbar-modal__backdrop" onClick={onClose}>
      <div className="toolbar-modal__card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <h3 className="toolbar-modal__title">Pricing Configuration</h3>
        <p className="toolbar-modal__subtitle" style={{ margin: '0 0 12px 0' }}>Edit local material costs to generate accurate BOM estimates</p>
        
        <div className="settings-modal__grid">
          {CATEGORIES.map(cat => (
            <React.Fragment key={cat.title}>
              <div className="settings-modal__section-title">{cat.title}</div>
              {cat.keys.map(key => (
                <div key={key} className="settings-modal__group">
                  <label className="label">{LABELS[key] || key}</label>
                  <div className="settings-modal__input-wrapper">
                    <span className="settings-modal__currency">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input settings-modal__input"
                      value={localPrices[key] !== undefined ? localPrices[key] : ''}
                      onChange={(e) => handleChange(key, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        <div className="toolbar-modal__actions" style={{ marginTop: '8px' }}>
          <button className="btn btn--ghost" onClick={handleReset} style={{ marginRight: 'auto' }}>Reset Defaults</button>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave}>Save Prices</button>
        </div>
      </div>
    </div>
  );
}
