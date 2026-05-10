import React, { useState, useCallback } from 'react';
import { useDeckStore } from '../../store/deckStore';
import { useShallow } from 'zustand/react/shallow';
import { formatDimension } from '../../utils/units';
import {
  SPECIES_OPTIONS, JOIST_SIZES, JOIST_SPACINGS,
  POST_SIZE_OPTIONS, DECK_BOARD_OPTIONS, BEAM_CONFIGS, SOIL_CAPACITIES,
} from '../Materials/materialData';
import { WOOD_COLORS } from '../Materials/materialData';
import './PropertiesPanel.css';

const DECK_MATERIALS = [
  { value: 'PT-SYP', label: 'Pressure Treated' },
  { value: 'CEDAR', label: 'Cedar' },
  { value: 'REDWOOD', label: 'Redwood' },
  { value: 'COMPOSITE', label: 'Composite' },
  { value: 'PVC', label: 'PVC' },
];

/* ── Chevron icon ── */
function ChevronDown({ open }) {
  return (
    <svg className={`collapsible__chevron ${open ? 'collapsible__chevron--open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

/* ── Collapsible section wrapper ── */
function CollapsibleSection({ title, icon, accentColor, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="props-panel__section">
      <div className="collapsible__header" onClick={() => setOpen(!open)} role="button" aria-expanded={open}>
        <h3 className="props-panel__heading" style={{ margin: 0 }}>
          {icon && <span className="props-heading__icon" style={{ color: accentColor }}>{icon}</span>}
          <span className="props-heading__bar" style={{ background: accentColor || 'var(--accent-primary)' }}></span>
          {title}
        </h3>
        <ChevronDown open={open} />
      </div>
      <div className={`collapsible__body ${open ? 'collapsible__body--open' : ''}`}>
        <div className="collapsible__inner">
          <div className="props-section__content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function DimensionInput({ id, label, valueInches, onChange, min = 12, max = 480 }) {
  const feet = Math.round(valueInches / 12);
  return (
    <div className="prop-field">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="prop-field__row">
        <input
          id={id}
          name={id}
          className="input input--sm"
          type="number"
          min={Math.round(min / 12)}
          max={Math.round(max / 12)}
          value={feet}
          onChange={(e) => onChange(Number(e.target.value) * 12)}
        />
        <span className="prop-field__unit">ft</span>
        <span className="prop-field__formatted">{formatDimension(valueInches)}</span>
      </div>
    </div>
  );
}

function SelectField({ id, label, value, options, onChange, swatch }) {
  return (
    <div className="prop-field">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="prop-field__select-wrap">
        {swatch && <span className="prop-field__swatch" style={{ background: swatch }}></span>}
        <select id={id} name={id} className={`select ${swatch ? 'select--with-swatch' : ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((opt) => (
            <option key={opt.value ?? opt} value={opt.value ?? opt}>
              {opt.label ?? opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function PropertiesPanel({ isMobile }) {
  const deck = useDeckStore(useShallow((s) => {
    const sec = s.sections.find((x) => x.id === s.selectedSectionId) || s.sections[0];
    return { ...s.materials, ...sec };
  }));
  const calcs = useDeckStore(useShallow((s) => s.sectionCalcs[s.selectedSectionId] || Object.values(s.sectionCalcs)[0]));
  const sections = useDeckStore((s) => s.sections);
  const selectedSectionId = useDeckStore((s) => s.selectedSectionId);
  const setDimension = useDeckStore((s) => s.setDimension);
  const updateDeck = useDeckStore((s) => s.updateDeck);
  const selectSection = useDeckStore((s) => s.selectSection);
  const removeSection = useDeckStore((s) => s.removeSection);
  const toggleRailing = useDeckStore((s) => s.toggleRailing);
  const attachStairs = useDeckStore((s) => s.attachStairs);

  if (!calcs) return null;
  const joistSpanOk = calcs.joists.maxSpan >= deck.depth;
  const sectionIndex = sections.findIndex((s) => s.id === selectedSectionId);
  const currentSection = sections[sectionIndex] || sections[0];
  const healthStatus = joistSpanOk ? 'ok' : 'warn';

  const Tag = isMobile ? 'div' : 'aside';
  const speciesSwatch = WOOD_COLORS[deck.species] || '#c4a35a';

  return (
    <Tag className={`props-panel ${isMobile ? 'props-panel--mobile' : 'animate-slide-right'}`} id="properties-panel" role="complementary" aria-label="Deck properties">
      {/* Health indicator header */}
      <div className="props-panel__health">
        <div className={`health-dot health-dot--${healthStatus}`}></div>
        <span className="props-panel__health-label">
          {healthStatus === 'ok' ? 'All spans within limits' : 'Span limit exceeded'}
        </span>
      </div>

      {/* Section Selector */}
      {sections.length > 1 && (
        <div className="props-panel__section-nav-wrap">
          <div className="props-section-nav">
            <span className="props-section-nav__title">
              Section {sectionIndex + 1} of {sections.length}
            </span>
            <button
              className="btn btn--ghost btn--sm"
              style={{ color: 'var(--accent-red)', fontSize: '11px' }}
              onClick={() => removeSection(selectedSectionId)}
              id="btn-delete-section"
            >✕ Delete</button>
          </div>
          <div className="props-section-tabs">
            {sections.map((sec, i) => (
              <button
                key={sec.id}
                className={`props-section-tab ${sec.id === selectedSectionId ? 'props-section-tab--active' : ''}`}
                onClick={() => selectSection(sec.id)}
              >{i + 1}</button>
            ))}
          </div>
          <div className="divider" />
        </div>
      )}

      {/* Dimensions */}
      <CollapsibleSection
        title="Dimensions"
        accentColor="var(--accent-primary)"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 3H3v18h18V3z"/><path d="M9 3v18"/><path d="M3 9h18"/></svg>}
      >
        <DimensionInput id="dim-width" label="Width" valueInches={deck.width} onChange={(v) => setDimension('width', v)} />
        <DimensionInput id="dim-depth" label="Depth" valueInches={deck.depth} onChange={(v) => setDimension('depth', v)} />
        <DimensionInput id="dim-height" label="Height" valueInches={deck.height} onChange={(v) => setDimension('height', v)} min={12} max={168} />
      </CollapsibleSection>

      <div className="divider" />

      {/* Framing */}
      <CollapsibleSection
        title="Framing"
        accentColor="var(--accent-warm)"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/></svg>}
      >
        <SelectField id="sel-species" label="Lumber Species" value={deck.species} options={SPECIES_OPTIONS} onChange={(v) => updateDeck({ species: v })} swatch={speciesSwatch} />
        <SelectField id="sel-joist-size" label="Joist Size" value={deck.joistSize} options={JOIST_SIZES.map((s) => ({ value: s, label: s }))} onChange={(v) => updateDeck({ joistSize: v })} />
        <SelectField id="sel-joist-spacing" label="Joist Spacing" value={deck.joistSpacing} options={JOIST_SPACINGS.map((s) => ({ value: s, label: `${s}" o.c.` }))} onChange={(v) => updateDeck({ joistSpacing: Number(v) })} />
        <SelectField id="sel-beam-config" label="Beam Config" value={deck.beamConfig} options={BEAM_CONFIGS} onChange={(v) => updateDeck({ beamConfig: v })} />
        <SelectField id="sel-post-size" label="Post Size" value={deck.postSize} options={POST_SIZE_OPTIONS.map((s) => ({ value: s, label: s }))} onChange={(v) => updateDeck({ postSize: v })} />
      </CollapsibleSection>

      <div className="divider" />

      {/* Decking */}
      <CollapsibleSection
        title="Decking"
        accentColor="#f5a623"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="1"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="2" y1="14" x2="22" y2="14"/></svg>}
      >
        <SelectField id="sel-board-size" label="Board Size" value={deck.deckBoardSize} options={DECK_BOARD_OPTIONS.map((s) => ({ value: s, label: s }))} onChange={(v) => updateDeck({ deckBoardSize: v })} />
        <SelectField id="sel-deck-material" label="Deck Material" value={deck.deckMaterial} options={DECK_MATERIALS} onChange={(v) => updateDeck({ deckMaterial: v })} />
      </CollapsibleSection>

      <div className="divider" />

      {/* Site */}
      <CollapsibleSection
        title="Site"
        accentColor="var(--accent-purple)"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
      >
        <SelectField id="sel-soil" label="Soil Capacity" value={deck.soilCapacity} options={SOIL_CAPACITIES} onChange={(v) => updateDeck({ soilCapacity: Number(v) })} />
        <div className="prop-field">
          <label className="label" htmlFor="btn-ledger-toggle">Ledger Attached</label>
          <button
            className={`btn btn--ghost prop-toggle ${deck.ledgerAttached ? 'prop-toggle--on' : ''}`}
            onClick={() => updateDeck({ ledgerAttached: !deck.ledgerAttached })}
            id="btn-ledger-toggle"
            aria-pressed={deck.ledgerAttached}
          >
            {deck.ledgerAttached ? '✓ Attached to house' : '✗ Freestanding deck'}
          </button>
        </div>
      </CollapsibleSection>

      <div className="divider" />

      {/* Railings & Stairs */}
      <CollapsibleSection
        title="Railings & Stairs"
        accentColor="var(--accent-green)"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 5L12 13 2 5"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>}
      >
        <div className="prop-field">
          <label className="label">Railings</label>
          <div className="railing-grid">
            {['n', 's', 'e', 'w'].map((edge) => (
              <button
                key={edge}
                className={`btn btn--sm railing-btn ${currentSection.railings[edge] ? 'railing-btn--active' : ''}`}
                onClick={() => toggleRailing(selectedSectionId, edge)}
              >
                {{ n: '↑ North', s: '↓ South', e: '→ East', w: '← West' }[edge]}
              </button>
            ))}
          </div>
        </div>
        <SelectField
          id="sel-stairs"
          label="Stairs"
          value={currentSection.stairs || 'none'}
          options={[
            { value: 'none', label: 'None' },
            { value: 'n', label: '↑ North Edge' },
            { value: 's', label: '↓ South Edge' },
            { value: 'e', label: '→ East Edge' },
            { value: 'w', label: '← West Edge' },
          ]}
          onChange={(v) => attachStairs(selectedSectionId, v === 'none' ? null : v)}
        />
      </CollapsibleSection>

      <div className="divider" />

      {/* Structural Info */}
      <CollapsibleSection
        title="Structural Info"
        accentColor="var(--accent-primary)"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
        defaultOpen={true}
      >
        <div className="props-info">
          <div className="props-info__row">
            <span>Max Joist Span</span>
            <span className={`font-mono ${!joistSpanOk ? 'text-warning' : ''}`}>
              {formatDimension(calcs.joists.maxSpan)}
              {!joistSpanOk && ' ⚠'}
            </span>
          </div>
          <div className="props-info__row">
            <span>Joists</span>
            <span className="font-mono" style={{ color: 'var(--accent-primary)' }}>{calcs.joists.count}</span>
          </div>
          <div className="props-info__row">
            <span>Beams</span>
            <span className="font-mono" style={{ color: 'var(--accent-warm)' }}>{calcs.beams.count}</span>
          </div>
          <div className="props-info__row">
            <span>Posts</span>
            <span className="font-mono" style={{ color: 'var(--accent-red)' }}>{calcs.posts.posts.length}</span>
          </div>
          <div className="props-info__row">
            <span>Footing Dia.</span>
            <span className="font-mono">{calcs.footings.diameter}"</span>
          </div>
          <div className="props-info__row">
            <span>Footing Count</span>
            <span className="font-mono">{calcs.footings.count}</span>
          </div>
          {calcs.stairs && (
            <>
              <div className="props-info__divider" />
              <div className="props-info__row">
                <span>Stair Risers</span>
                <span className="font-mono">{calcs.stairs.numRisers}</span>
              </div>
              <div className="props-info__row">
                <span>Riser Height</span>
                <span className="font-mono">{calcs.stairs.riserHeight}"</span>
              </div>
              <div className="props-info__row">
                <span>Total Run</span>
                <span className="font-mono">{formatDimension(calcs.stairs.totalRun)}</span>
              </div>
            </>
          )}
        </div>
        {!joistSpanOk && (
          <div className="props-warning">
            ⚠ Deck depth exceeds max joist span. An interior beam has been added automatically.
          </div>
        )}
      </CollapsibleSection>
    </Tag>
  );
}
