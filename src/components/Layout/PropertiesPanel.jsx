import React from 'react';
import { useDeckStore } from '../../store/deckStore';
import { formatDimension } from '../../utils/units';
import {
  SPECIES_OPTIONS, JOIST_SIZES, JOIST_SPACINGS,
  POST_SIZE_OPTIONS, DECK_BOARD_OPTIONS, BEAM_CONFIGS, SOIL_CAPACITIES,
} from '../Materials/materialData';
import './PropertiesPanel.css';

const DECK_MATERIALS = [
  { value: 'PT-SYP', label: 'Pressure Treated' },
  { value: 'CEDAR', label: 'Cedar' },
  { value: 'REDWOOD', label: 'Redwood' },
  { value: 'COMPOSITE', label: 'Composite' },
  { value: 'PVC', label: 'PVC' },
];

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

function SelectField({ id, label, value, options, onChange }) {
  return (
    <div className="prop-field">
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} name={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PropertiesPanel({ isMobile }) {
  const deck = useDeckStore((s) => {
    const sec = s.sections.find((x) => x.id === s.selectedSectionId) || s.sections[0];
    return { ...s.materials, ...sec };
  });
  const calcs = useDeckStore((s) => s.sectionCalcs[s.selectedSectionId] || Object.values(s.sectionCalcs)[0]);
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

  const Tag = isMobile ? 'div' : 'aside';

  return (
    <Tag className={`props-panel ${isMobile ? 'props-panel--mobile' : 'animate-slide-right'}`} id="properties-panel" role="complementary" aria-label="Deck properties">
      {/* Section Selector */}
      {sections.length > 1 && (
        <div className="props-panel__section">
          <div className="props-panel__section-nav">
            <h3 className="props-panel__heading" style={{ margin: 0 }}>
              Section {sectionIndex + 1} of {sections.length}
            </h3>
            <button
              className="btn btn--ghost btn--sm"
              style={{ color: '#ef4444', fontSize: '11px' }}
              onClick={() => removeSection(selectedSectionId)}
            >✕ Delete</button>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
            {sections.map((sec, i) => (
              <button
                key={sec.id}
                className={`btn btn--sm ${sec.id === selectedSectionId ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => selectSection(sec.id)}
                style={{ minWidth: '36px' }}
              >{i + 1}</button>
            ))}
          </div>
          <div className="divider" />
        </div>
      )}

      {/* Dimensions */}
      <div className="props-panel__section">
        <h3 className="props-panel__heading">Dimensions</h3>
        <DimensionInput
          id="dim-width"
          label="Width"
          valueInches={deck.width}
          onChange={(v) => setDimension('width', v)}
        />
        <DimensionInput
          id="dim-depth"
          label="Depth"
          valueInches={deck.depth}
          onChange={(v) => setDimension('depth', v)}
        />
        <DimensionInput
          id="dim-height"
          label="Height"
          valueInches={deck.height}
          onChange={(v) => setDimension('height', v)}
          min={12}
          max={168}
        />
      </div>

      <div className="divider" />

      {/* Framing */}
      <div className="props-panel__section">
        <h3 className="props-panel__heading">Framing</h3>
        <SelectField
          id="sel-species"
          label="Lumber Species"
          value={deck.species}
          options={SPECIES_OPTIONS}
          onChange={(v) => updateDeck({ species: v })}
        />
        <SelectField
          id="sel-joist-size"
          label="Joist Size"
          value={deck.joistSize}
          options={JOIST_SIZES.map((s) => ({ value: s, label: s }))}
          onChange={(v) => updateDeck({ joistSize: v })}
        />
        <SelectField
          id="sel-joist-spacing"
          label="Joist Spacing"
          value={deck.joistSpacing}
          options={JOIST_SPACINGS.map((s) => ({ value: s, label: `${s}" o.c.` }))}
          onChange={(v) => updateDeck({ joistSpacing: Number(v) })}
        />
        <SelectField
          id="sel-beam-config"
          label="Beam Config"
          value={deck.beamConfig}
          options={BEAM_CONFIGS}
          onChange={(v) => updateDeck({ beamConfig: v })}
        />
        <SelectField
          id="sel-post-size"
          label="Post Size"
          value={deck.postSize}
          options={POST_SIZE_OPTIONS.map((s) => ({ value: s, label: s }))}
          onChange={(v) => updateDeck({ postSize: v })}
        />
      </div>

      <div className="divider" />

      {/* Decking */}
      <div className="props-panel__section">
        <h3 className="props-panel__heading">Decking</h3>
        <SelectField
          id="sel-board-size"
          label="Board Size"
          value={deck.deckBoardSize}
          options={DECK_BOARD_OPTIONS.map((s) => ({ value: s, label: s }))}
          onChange={(v) => updateDeck({ deckBoardSize: v })}
        />
        <SelectField
          id="sel-deck-material"
          label="Deck Material"
          value={deck.deckMaterial}
          options={DECK_MATERIALS}
          onChange={(v) => updateDeck({ deckMaterial: v })}
        />
      </div>

      <div className="divider" />

      {/* Site */}
      <div className="props-panel__section">
        <h3 className="props-panel__heading">Site</h3>
        <SelectField
          id="sel-soil"
          label="Soil Capacity"
          value={deck.soilCapacity}
          options={SOIL_CAPACITIES}
          onChange={(v) => updateDeck({ soilCapacity: Number(v) })}
        />
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
      </div>

      <div className="divider" />

      {/* Railings & Stairs */}
      <div className="props-panel__section">
        <h3 className="props-panel__heading">Railings & Stairs</h3>
        <div className="prop-field">
          <label className="label">Railings</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {['n', 's', 'e', 'w'].map((edge) => (
              <button
                key={edge}
                className={`btn btn--sm ${currentSection.railings[edge] ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => toggleRailing(selectedSectionId, edge)}
                style={{ textTransform: 'capitalize' }}
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
      </div>

      <div className="divider" />

      {/* Structural Info */}
      <div className="props-panel__section">
        <h3 className="props-panel__heading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Structural Info
        </h3>
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
            <span className="font-mono">{calcs.joists.count}</span>
          </div>
          <div className="props-info__row">
            <span>Beams</span>
            <span className="font-mono">{calcs.beams.count}</span>
          </div>
          <div className="props-info__row">
            <span>Posts</span>
            <span className="font-mono">{calcs.posts.posts.length}</span>
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
      </div>
    </Tag>
  );
}
