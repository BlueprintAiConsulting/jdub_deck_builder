import React, { useState, useCallback } from 'react';
import { useDeckStore } from '../../store/deckStore';
import { useShallow } from 'zustand/react/shallow';
import { formatDimension } from '../../utils/units';
import { getSubObjectOffset } from '../../utils/polygonUtils.js';
import {
  SPECIES_OPTIONS, JOIST_SIZES, JOIST_SPACINGS,
  POST_SIZE_OPTIONS, DECK_BOARD_OPTIONS, BEAM_CONFIGS, SOIL_CAPACITIES,
  DECK_MATERIAL_OPTIONS, DECK_MATERIAL_COLORS, DECK_COLOR_OPTIONS,
  WOOD_COLORS
} from '../Materials/materialData.js';
import './PropertiesPanel.css';

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
  const feet = Math.floor(valueInches / 12);
  const inches = Math.round(valueInches % 12);
  
  const handleFeetChange = (e) => {
    const newFeet = Math.max(0, parseInt(e.target.value) || 0);
    const newVal = newFeet * 12 + inches;
    onChange(Math.max(min, Math.min(max, newVal)));
  };

  const handleInchesChange = (e) => {
    const newInches = Math.max(0, Math.min(11, parseInt(e.target.value) || 0));
    const newVal = feet * 12 + newInches;
    onChange(Math.max(min, Math.min(max, newVal)));
  };

  return (
    <div className="prop-field">
      <label className="label" htmlFor={`${id}-ft`}>{label}</label>
      <div className="prop-field__row" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
          <input
            id={`${id}-ft`}
            className="input input--sm"
            type="number"
            min={Math.floor(min / 12)}
            max={Math.floor(max / 12)}
            value={feet}
            onChange={handleFeetChange}
            style={{ width: '100%', minWidth: '45px', textAlign: 'right' }}
          />
          <span className="prop-field__unit" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ft</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
          <input
            id={`${id}-in`}
            className="input input--sm"
            type="number"
            min={0}
            max={11}
            value={inches}
            onChange={handleInchesChange}
            style={{ width: '100%', minWidth: '45px', textAlign: 'right' }}
          />
          <span className="prop-field__unit" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>in</span>
        </div>
        <span className="prop-field__formatted" style={{ marginLeft: '8px', fontSize: '11px', whiteSpace: 'nowrap', opacity: 0.8 }}>
          ({formatDimension(valueInches)})
        </span>
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
            <option key={opt.value ?? opt} value={opt.value ?? opt} disabled={opt.disabled}>
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
  const selectedSubObjectType = useDeckStore((s) => s.selectedSubObjectType);
  const setDimension = useDeckStore((s) => s.setDimension);
  const updateDeck = useDeckStore((s) => s.updateDeck);
  const selectSection = useDeckStore((s) => s.selectSection);
  const removeSection = useDeckStore((s) => s.removeSection);
  const toggleRailing = useDeckStore((s) => s.toggleRailing);
  const attachStairs = useDeckStore((s) => s.attachStairs);
  const updateStairs = useDeckStore((s) => s.updateStairs);
  const attachRamp = useDeckStore((s) => s.attachRamp);
  const updateRamp = useDeckStore((s) => s.updateRamp);
  
  const selectedTool = useDeckStore((s) => s.selectedTool);
  const placementDeck = useDeckStore((s) => s.placementDeck);
  const updatePlacementDeck = useDeckStore((s) => s.updatePlacementDeck);
  const placementLanding = useDeckStore((s) => s.placementLanding);
  const updatePlacementLanding = useDeckStore((s) => s.updatePlacementLanding);
  const placementStairs = useDeckStore((s) => s.placementStairs);
  const updatePlacementStairs = useDeckStore((s) => s.updatePlacementStairs);
  const placementRamp = useDeckStore((s) => s.placementRamp);
  const updatePlacementRamp = useDeckStore((s) => s.updatePlacementRamp);

  if (!calcs) return null;
  const joistSpanOk = calcs.joists.maxSpan >= deck.depth;
  const sectionIndex = sections.findIndex((s) => s.id === selectedSectionId);
  const currentSection = sections[sectionIndex] || sections[0];
  const isLanding = currentSection?.type === 'landing';
  const healthStatus = joistSpanOk ? 'ok' : 'warn';

  const stairObj = typeof currentSection.stairs === 'object' && currentSection.stairs !== null
    ? currentSection.stairs
    : (typeof currentSection.stairs === 'string'
      ? { direction: currentSection.stairs, width: 36, numberOfSteps: 5, rise: 7.25, run: 10 }
      : null);

  const rampObj = typeof currentSection.ramp === 'object' && currentSection.ramp !== null
    ? currentSection.ramp
    : (typeof currentSection.ramp === 'string'
      ? { direction: currentSection.ramp, mode: 'ada', width: 36, run: currentSection.height * 12, align: 'center' }
      : null);

  const Tag = isMobile ? 'div' : 'aside';
  const speciesSwatch = WOOD_COLORS[deck.species] || '#c4a35a';

  if (selectedTool !== 'select') {
    return (
      <Tag className={`props-panel ${isMobile ? 'props-panel--mobile' : 'animate-slide-right'}`} id="properties-panel" role="complementary" aria-label="Tool configuration">
        {selectedTool === 'rectangle' && (
          <>
            <div className="props-panel__action-row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Tool Mode: Add Deck Section
              </span>
            </div>
            <div style={{ padding: '16px', fontSize: '12px', lineHeight: '1.4' }} className="text-secondary">
              Configure default dimensions for the next deck section to place. Click and drag or single-click on the canvas to place it.
            </div>
            <CollapsibleSection
              title="New Deck Dimensions"
              accentColor="var(--accent-primary)"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>}
            >
              <DimensionInput id="placement-deck-width" label="Width" valueInches={placementDeck.width} onChange={(v) => updatePlacementDeck({ width: v })} />
              <DimensionInput id="placement-deck-depth" label="Depth" valueInches={placementDeck.depth} onChange={(v) => updatePlacementDeck({ depth: v })} />
              <DimensionInput id="placement-deck-height" label="Height" valueInches={placementDeck.height} onChange={(v) => updatePlacementDeck({ height: v })} min={12} max={168} />
            </CollapsibleSection>
          </>
        )}
        {selectedTool === 'landing' && (
          <>
            <div className="props-panel__action-row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Tool Mode: Add Landing
              </span>
            </div>
            <div style={{ padding: '16px', fontSize: '12px', lineHeight: '1.4' }} className="text-secondary">
              Configure default dimensions for the next landing. Click and drag or single-click on the canvas to place it.
            </div>
            <CollapsibleSection
              title="New Landing Dimensions"
              accentColor="var(--accent-primary)"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>}
            >
              <DimensionInput id="placement-landing-width" label="Width" valueInches={placementLanding.width} onChange={(v) => updatePlacementLanding({ width: v })} min={36} max={120} />
              <DimensionInput id="placement-landing-depth" label="Depth" valueInches={placementLanding.depth} onChange={(v) => updatePlacementLanding({ depth: v })} min={36} max={120} />
              <DimensionInput id="placement-landing-height" label="Height" valueInches={placementLanding.height} onChange={(v) => updatePlacementLanding({ height: v })} min={12} max={168} />
            </CollapsibleSection>
          </>
        )}
        {selectedTool === 'stairs' && (
          <>
            <div className="props-panel__action-row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Tool Mode: Add Stairs
              </span>
            </div>
            <div style={{ padding: '16px', fontSize: '12px', lineHeight: '1.4' }} className="text-secondary">
              Configure default stairs settings. Then, click on any deck edge in the layout canvas to attach them.
            </div>
            <CollapsibleSection
              title="New Stairs Dimensions"
              accentColor="var(--accent-green)"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h4v-4h4v-4h4v-4h4"/></svg>}
            >
              <div className="prop-field">
                <label className="label" htmlFor="placement-stair-width">Stair Width (in)</label>
                <input
                  id="placement-stair-width"
                  className="input input--sm"
                  type="number"
                  min="36"
                  max="96"
                  value={placementStairs.width}
                  onChange={(e) => updatePlacementStairs({ width: Number(e.target.value) })}
                />
              </div>
              <div className="prop-field">
                <label className="label" htmlFor="placement-stair-steps">Number of Steps</label>
                <input
                  id="placement-stair-steps"
                  className="input input--sm"
                  type="number"
                  min="1"
                  max="20"
                  value={placementStairs.numberOfSteps}
                  onChange={(e) => updatePlacementStairs({ numberOfSteps: Number(e.target.value) })}
                />
              </div>
              <div className="prop-field">
                <label className="label" htmlFor="placement-stair-rise">Rise per Step (in)</label>
                <input
                  id="placement-stair-rise"
                  className="input input--sm"
                  type="number"
                  step="0.25"
                  min="4"
                  max="9"
                  value={placementStairs.rise}
                  onChange={(e) => updatePlacementStairs({ rise: Number(e.target.value) })}
                />
              </div>
              <div className="prop-field">
                <label className="label" htmlFor="placement-stair-run">Run per Step (in)</label>
                <input
                  id="placement-stair-run"
                  className="input input--sm"
                  type="number"
                  step="0.25"
                  min="8"
                  max="14"
                  value={placementStairs.run}
                  onChange={(e) => updatePlacementStairs({ run: Number(e.target.value) })}
                />
              </div>
            </CollapsibleSection>
          </>
        )}
        {selectedTool === 'ramp' && (
          <>
            <div className="props-panel__action-row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Tool Mode: Add Ramp
              </span>
            </div>
            <div style={{ padding: '16px', fontSize: '12px', lineHeight: '1.4' }} className="text-secondary">
              Configure default ramp settings. Then, click on any deck edge in the layout canvas to attach it.
            </div>
            <CollapsibleSection
              title="New Ramp Dimensions"
              accentColor="var(--accent-green)"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="20" x2="22" y2="12" /><line x1="2" y1="20" x2="22" y2="20" /></svg>}
            >
              <SelectField
                id="placement-ramp-mode"
                label="Ramp Mode"
                value={placementRamp.mode}
                options={[
                  { value: 'ada', label: 'ADA Compliance (1:12)' },
                  { value: 'utility', label: 'Utility Mode' },
                ]}
                onChange={(v) => {
                  updatePlacementRamp({ mode: v });
                }}
              />
              <div className="prop-field">
                <label className="label" htmlFor="placement-ramp-width">Ramp Width (in)</label>
                <input
                  id="placement-ramp-width"
                  className="input input--sm"
                  type="number"
                  min="36"
                  max="96"
                  value={placementRamp.width}
                  onChange={(e) => updatePlacementRamp({ width: Number(e.target.value) })}
                />
              </div>
              <div className="prop-field">
                <label className="label" htmlFor="placement-ramp-run">Ramp Run (in)</label>
                <input
                  id="placement-ramp-run"
                  className="input input--sm"
                  type="number"
                  min="12"
                  max="1000"
                  value={placementRamp.run}
                  readOnly={placementRamp.mode === 'ada'}
                  disabled={placementRamp.mode === 'ada'}
                  style={placementRamp.mode === 'ada' ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                  onChange={(e) => updatePlacementRamp({ run: Number(e.target.value) })}
                />
              </div>
            </CollapsibleSection>
          </>
        )}
        {selectedTool === 'railing' && (
          <>
            <div className="props-panel__action-row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Tool Mode: Railings
              </span>
            </div>
            <div style={{ padding: '16px', fontSize: '12px', lineHeight: '1.4' }} className="text-secondary">
              Click on any deck edge in the layout canvas to toggle railings on or off for that edge.
            </div>
          </>
        )}
      </Tag>
    );
  }

  return (
    <Tag className={`props-panel ${isMobile ? 'props-panel--mobile' : 'animate-slide-right'}`} id="properties-panel" role="complementary" aria-label="Deck properties">
      {/* Health indicator header */}
      <div className="props-panel__health">
        <div className={`health-dot health-dot--${healthStatus}`}></div>
        <span className="props-panel__health-label">
          {healthStatus === 'ok' ? 'All spans within limits' : 'Span limit exceeded'}
        </span>
      </div>

      {/* Delete Selection Header/Action Button */}
      {selectedSectionId && (
        <div className="props-panel__action-row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {selectedSubObjectType === 'stairs' ? 'Selected: Stairs' : selectedSubObjectType === 'ramp' ? 'Selected: Ramp' : `Selected: Section ${sectionIndex + 1}`}
          </span>
          <button
            className="btn btn--sm"
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              color: '#ef4444', 
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => {
              if (selectedSubObjectType === 'stairs') {
                attachStairs(selectedSectionId, stairObj.direction); // this toggles/removes it
              } else if (selectedSubObjectType === 'ramp') {
                attachRamp(selectedSectionId, rampObj.direction); // this toggles/removes it
              } else {
                if (window.confirm("Are you sure you want to delete this deck section?")) {
                  removeSection(selectedSectionId);
                }
              }
            }}
            id="btn-delete-selected-object"
          >
            ✕ Delete
          </button>
        </div>
      )}

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
      {selectedSubObjectType === 'stairs' ? (
        <CollapsibleSection
          title="Stair Dimensions"
          accentColor="var(--accent-green)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h4v-4h4v-4h4v-4h4"/></svg>}
        >
          <div className="prop-field">
            <label className="label" htmlFor="stair-width">Stair Width (in)</label>
            <input
              id="stair-width"
              className="input input--sm"
              type="number"
              min="36"
              max="96"
              value={stairObj?.width || 36}
              onChange={(e) => updateStairs(selectedSectionId, { width: Number(e.target.value) })}
            />
          </div>
          <div className="prop-field">
            <label className="label" htmlFor="stair-steps">Number of Steps</label>
            <input
              id="stair-steps"
              className="input input--sm"
              type="number"
              min="1"
              max="20"
              value={stairObj?.numberOfSteps || 5}
              onChange={(e) => updateStairs(selectedSectionId, { numberOfSteps: Number(e.target.value) })}
            />
          </div>
          <div className="prop-field">
            <label className="label" htmlFor="stair-rise">Rise per Step (in)</label>
            <input
              id="stair-rise"
              className="input input--sm"
              type="number"
              step="0.25"
              min="4"
              max="9"
              value={stairObj?.rise || 7.25}
              onChange={(e) => updateStairs(selectedSectionId, { rise: Number(e.target.value) })}
            />
          </div>
          <div className="prop-field">
            <label className="label" htmlFor="stair-run">Run per Step (in)</label>
            <input
              id="stair-run"
              className="input input--sm"
              type="number"
              step="0.25"
              min="8"
              max="14"
              value={stairObj?.run || 10}
              onChange={(e) => updateStairs(selectedSectionId, { run: Number(e.target.value) })}
            />
          </div>
        </CollapsibleSection>
      ) : selectedSubObjectType === 'ramp' ? (
        <CollapsibleSection
          title="Ramp Dimensions"
          accentColor="var(--accent-green)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="20" x2="22" y2="12" /><line x1="2" y1="20" x2="22" y2="20" /></svg>}
        >
          <SelectField
            id="sel-ramp-mode"
            label="Ramp Mode"
            value={rampObj?.mode || 'ada'}
            options={[
              { value: 'ada', label: 'ADA Compliance (1:12)' },
              { value: 'utility', label: 'Utility Mode' },
            ]}
            onChange={(v) => {
              const nextRun = v === 'ada' ? currentSection.height * 12 : currentSection.height * 8;
              updateRamp(selectedSectionId, { mode: v, run: nextRun });
            }}
          />
          <div className="prop-field">
            <label className="label" htmlFor="ramp-width">Ramp Width (in)</label>
            <input
              id="ramp-width"
              className="input input--sm"
              type="number"
              min="36"
              max="96"
              value={rampObj?.width || 36}
              onChange={(e) => updateRamp(selectedSectionId, { width: Number(e.target.value) })}
            />
          </div>
          <div className="prop-field">
            <label className="label" htmlFor="ramp-run">Ramp Run (in)</label>
            <input
              id="ramp-run"
              className="input input--sm"
              type="number"
              min="12"
              max="1000"
              value={rampObj?.mode === 'ada' ? (currentSection.height * 12) : (rampObj?.run || currentSection.height * 8)}
              readOnly={rampObj?.mode === 'ada'}
              disabled={rampObj?.mode === 'ada'}
              style={rampObj?.mode === 'ada' ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
              onChange={(e) => updateRamp(selectedSectionId, { run: Number(e.target.value) })}
            />
          </div>
        </CollapsibleSection>
      ) : isLanding ? (
        <CollapsibleSection
          title="Landing Dimensions"
          accentColor="var(--accent-primary)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 3H3v18h18V3z"/><path d="M9 3v18"/><path d="M3 9h18"/></svg>}
        >
          <DimensionInput id="dim-width" label="Width" valueInches={deck.width} onChange={(v) => setDimension('width', v)} min={36} max={120} />
          <DimensionInput id="dim-depth" label="Depth" valueInches={deck.depth} onChange={(v) => setDimension('depth', v)} min={36} max={120} />
          <DimensionInput id="dim-height" label="Height" valueInches={deck.height} onChange={(v) => setDimension('height', v)} min={12} max={168} />
        </CollapsibleSection>
      ) : (
        <CollapsibleSection
          title="Dimensions"
          accentColor="var(--accent-primary)"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 3H3v18h18V3z"/><path d="M9 3v18"/><path d="M3 9h18"/></svg>}
        >
          <DimensionInput id="dim-width" label="Width" valueInches={deck.width} onChange={(v) => setDimension('width', v)} />
          <DimensionInput id="dim-depth" label="Depth" valueInches={deck.depth} onChange={(v) => setDimension('depth', v)} />
          <DimensionInput id="dim-height" label="Height" valueInches={deck.height} onChange={(v) => setDimension('height', v)} min={12} max={168} />
        </CollapsibleSection>
      )}

      {!isLanding && (
        <>
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
            <SelectField id="sel-joist-orient" label="Joist Direction" value={deck.joistOrientation || 'vertical'} options={[{ value: 'vertical', label: 'Vertical (N-S)' }, { value: 'horizontal', label: 'Horizontal (E-W)' }]} onChange={(v) => updateDeck({ joistOrientation: v })} />
            <SelectField id="sel-beam-config" label="Beam Config" value={deck.beamConfig} options={BEAM_CONFIGS} onChange={(v) => updateDeck({ beamConfig: v })} />
            <SelectField
              id="sel-beam-count"
              label="Support Beams"
              value={deck.beamCount || 'auto'}
              options={[
                { value: 'auto', label: 'Automatic (12 ft Limit)' },
                { value: '1', label: '1 Beam' },
                { value: '2', label: '2 Beams' },
                { value: '3', label: '3 Beams' },
                { value: '4', label: '4 Beams' },
              ]}
              onChange={(v) => updateDeck({ beamCount: v === 'auto' ? 'auto' : Number(v) })}
            />
            <div className="prop-field">
              <label className="label" htmlFor="beam-setback-slider">Beam Setback / Cantilever (in)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="beam-setback-slider"
                  type="range"
                  min="0"
                  max={Math.max(0, (deck.joistOrientation === 'horizontal' ? deck.width : deck.depth) - 24)}
                  value={deck.beamSetback !== undefined ? deck.beamSetback : 12}
                  onChange={(e) => updateDeck({ beamSetback: Number(e.target.value) })}
                  style={{ flexGrow: 1, accentColor: 'var(--accent-primary)' }}
                />
                <input
                  id="beam-setback-input"
                  className="input input--sm"
                  type="number"
                  min="0"
                  max={Math.max(0, (deck.joistOrientation === 'horizontal' ? deck.width : deck.depth) - 24)}
                  value={deck.beamSetback !== undefined ? deck.beamSetback : 12}
                  onChange={(e) => {
                    const limit = Math.max(0, (deck.joistOrientation === 'horizontal' ? deck.width : deck.depth) - 24);
                    const val = Math.max(0, Math.min(limit, Number(e.target.value)));
                    updateDeck({ beamSetback: val });
                  }}
                  style={{ width: '60px' }}
                />
              </div>
            </div>
            <SelectField id="sel-post-size" label="Post Size" value={deck.postSize} options={POST_SIZE_OPTIONS.map((s) => ({ value: s, label: s }))} onChange={(v) => updateDeck({ postSize: v })} />
            <SelectField 
              id="sel-footer-width" 
              label="Footer Width (in)" 
              value={deck.footerWidth !== undefined ? deck.footerWidth : 12} 
              options={[
                { value: 12, label: '12"' },
                { value: 15, label: '15"' },
                { value: 18, label: '18"' },
                { value: 24, label: '24"' }
              ]} 
              onChange={(v) => updateDeck({ footerWidth: Number(v) })} 
            />
            <div className="prop-field">
              <label className="label">Add Blocking</label>
              <button
                type="button"
                className={`btn btn--ghost prop-toggle ${deck.blocking !== false ? 'prop-toggle--on' : ''}`}
                onClick={() => updateDeck({ blocking: deck.blocking === false ? true : false })}
                aria-pressed={deck.blocking !== false}
                style={{ width: '100%' }}
              >
                {deck.blocking !== false ? '✓ Enabled' : '✗ Disabled'}
              </button>
            </div>
            {deck.blocking !== false && (
              <SelectField
                id="sel-blocking-spacing"
                label="Blocking Spacing"
                value={deck.blockingSpacing !== undefined ? deck.blockingSpacing : 72}
                options={[
                  { value: 48, label: '4 ft' },
                  { value: 72, label: '6 ft (Default)' },
                  { value: 96, label: '8 ft' },
                ]}
                onChange={(v) => updateDeck({ blockingSpacing: Number(v) })}
              />
            )}
          </CollapsibleSection>

          <div className="divider" />

          {/* Decking */}
          <CollapsibleSection
            title="Decking"
            accentColor="#f5a623"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="1"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="2" y1="14" x2="22" y2="14"/></svg>}
          >
            <SelectField id="sel-board-size" label="Board Size" value={deck.deckBoardSize} options={DECK_BOARD_OPTIONS.map((s) => ({ value: s, label: s }))} onChange={(v) => updateDeck({ deckBoardSize: v })} />
            <SelectField
              id="sel-deck-material"
              label="Deck Material"
              value={deck.deckMaterial}
              options={DECK_MATERIAL_OPTIONS}
              onChange={(v) => updateDeck({ deckMaterial: v })}
              swatch={DECK_MATERIAL_COLORS[deck.deckMaterial]}
            />
            <SelectField id="sel-decking-orient" label="Decking Direction" value={deck.deckingOrientation || 'perpendicular'} options={[{ value: 'perpendicular', label: 'Perpendicular to Joists' }, { value: 'parallel', label: 'Parallel to Joists' }, { value: 'diagonal', label: '45° Diagonal' }]} onChange={(v) => updateDeck({ deckingOrientation: v })} />
            {DECK_COLOR_OPTIONS[deck.deckMaterial] && DECK_COLOR_OPTIONS[deck.deckMaterial].length > 1 && (
              <div className="prop-field">
                <label className="label">Decking Color / Line</label>
                <div className="swatch-picker">
                  <div className="swatch-picker__active-label text-sm text-secondary" style={{ marginBottom: '8px', fontWeight: 500 }}>
                    {(() => {
                      const opts = DECK_COLOR_OPTIONS[deck.deckMaterial] || [];
                      const opt = opts.find(o => o.value === deck.deckColor);
                      return opt ? opt.label : 'Select color';
                    })()}
                  </div>
                  <div className="swatch-picker__grid" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(DECK_COLOR_OPTIONS[deck.deckMaterial] || []).map((opt) => {
                      const isSelected = opt.value === deck.deckColor;
                      return (
                        <button
                          key={opt.value}
                          className={`swatch-picker__item ${isSelected ? 'swatch-picker__item--selected' : ''}`}
                          onClick={() => updateDeck({ deckColor: opt.value })}
                          title={opt.label}
                          aria-label={opt.label}
                          id={`swatch-${opt.value}`}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: opt.color,
                            border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)',
                            outlineOffset: isSelected ? '2px' : '0px',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease, border-color 0.15s ease',
                            padding: 0,
                            boxShadow: isSelected ? '0 0 8px var(--accent-primary-glow)' : 'none',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
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
        </>
      )}

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
                disabled={edge === 'n' && currentSection.ledgerAttached}
                title={edge === 'n' && currentSection.ledgerAttached ? "Blocked by House Wall" : ""}
                style={edge === 'n' && currentSection.ledgerAttached ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                {{ n: '↑ North', s: '↓ South', e: '→ East', w: '← West' }[edge]}
              </button>
            ))}
          </div>
        </div>
        {stairObj ? (
          <>
            <SelectField
              id="sel-stairs-dir"
              label="Stair Direction"
              value={stairObj.direction || 's'}
              options={[
                { value: 'n', label: '↑ North Edge', disabled: currentSection.ledgerAttached },
                { value: 's', label: '↓ South Edge' },
                { value: 'e', label: '→ East Edge' },
                { value: 'w', label: '← West Edge' },
              ]}
              onChange={(v) => updateStairs(selectedSectionId, { direction: v })}
            />
            <SelectField
              id="sel-stairs-align"
              label="Stair Alignment"
              value={stairObj.align || 'center'}
              options={[
                { value: 'center', label: 'Center' },
                { value: 'left', label: 'Left / Top Edge' },
                { value: 'right', label: 'Right / Bottom Edge' },
                { value: 'custom', label: 'Custom' },
              ]}
              onChange={(v) => updateStairs(selectedSectionId, { align: v })}
            />
            <div className="prop-field">
              <label className="label" htmlFor="stair-offset">Position along Edge (in)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="stair-offset-slider"
                  type="range"
                  min="0"
                  max={(() => {
                    const isVert = stairObj.direction === 'n' || stairObj.direction === 's';
                    const edgeLen = isVert ? currentSection.width : currentSection.depth;
                    return Math.max(0, edgeLen - stairObj.width);
                  })()}
                  value={Math.round(getSubObjectOffset(currentSection, 'stairs'))}
                  onChange={(e) => updateStairs(selectedSectionId, { offset: Number(e.target.value), align: 'custom' })}
                  style={{ flexGrow: 1, accentColor: 'var(--accent-primary)' }}
                />
                <input
                  id="stair-offset"
                  className="input input--sm"
                  type="number"
                  min="0"
                  max={(() => {
                    const isVert = stairObj.direction === 'n' || stairObj.direction === 's';
                    const edgeLen = isVert ? currentSection.width : currentSection.depth;
                    return Math.max(0, edgeLen - stairObj.width);
                  })()}
                  value={Math.round(getSubObjectOffset(currentSection, 'stairs'))}
                  onChange={(e) => updateStairs(selectedSectionId, { offset: Number(e.target.value), align: 'custom' })}
                  style={{ width: '60px' }}
                />
              </div>
            </div>
            <div className="prop-field">
              <label className="label" htmlFor="stair-width">Stair Width (in)</label>
              <input
                id="stair-width"
                className="input input--sm"
                type="number"
                min="36"
                max="96"
                value={stairObj.width || 36}
                onChange={(e) => updateStairs(selectedSectionId, { width: Number(e.target.value) })}
              />
            </div>
            <div className="prop-field">
              <label className="label" htmlFor="stair-steps">Number of Steps</label>
              <input
                id="stair-steps"
                className="input input--sm"
                type="number"
                min="1"
                max="20"
                value={stairObj.numberOfSteps || 5}
                onChange={(e) => updateStairs(selectedSectionId, { numberOfSteps: Number(e.target.value) })}
              />
            </div>
            <div className="prop-field">
              <label className="label" htmlFor="stair-rise">Rise per Step (in)</label>
              <input
                id="stair-rise"
                className="input input--sm"
                type="number"
                step="0.25"
                min="4"
                max="9"
                value={stairObj.rise || 7.25}
                onChange={(e) => updateStairs(selectedSectionId, { rise: Number(e.target.value) })}
              />
            </div>
            <div className="prop-field">
              <label className="label" htmlFor="stair-run">Run per Step (in)</label>
              <input
                id="stair-run"
                className="input input--sm"
                type="number"
                step="0.25"
                min="8"
                max="14"
                value={stairObj.run || 10}
                onChange={(e) => updateStairs(selectedSectionId, { run: Number(e.target.value) })}
              />
            </div>
            <button
              className="btn btn--secondary btn--full btn--sm"
              style={{ color: 'var(--accent-red)', marginTop: '8px' }}
              onClick={() => attachStairs(selectedSectionId, stairObj.direction)}
              id="btn-remove-stairs"
            >
              Remove Stairs
            </button>
          </>
        ) : (
          <SelectField
            id="sel-stairs"
            label="Add Stairs"
            value="none"
            options={[
              { value: 'none', label: 'None' },
              { value: 'n', label: '↑ North Edge', disabled: currentSection.ledgerAttached },
              { value: 's', label: '↓ South Edge' },
              { value: 'e', label: '→ East Edge' },
              { value: 'w', label: '← West Edge' },
            ]}
            onChange={(v) => {
              if (v !== 'none') {
                attachStairs(selectedSectionId, v);
              }
            }}
          />
        )}

        <div className="props-panel__divider-thin" style={{ margin: '16px 0', borderTop: '1px dashed rgba(255,255,255,0.1)' }} />
        
        {rampObj ? (
          <>
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent-green)' }}>Ramp Configuration</h4>
            <SelectField
              id="sel-ramp-dir"
              label="Ramp Direction"
              value={rampObj.direction || 's'}
              options={[
                { value: 'n', label: '↑ North Edge', disabled: currentSection.ledgerAttached },
                { value: 's', label: '↓ South Edge' },
                { value: 'e', label: '→ East Edge' },
                { value: 'w', label: '← West Edge' },
              ]}
              onChange={(v) => updateRamp(selectedSectionId, { direction: v })}
            />
             <SelectField
              id="sel-ramp-align"
              label="Ramp Alignment"
              value={rampObj.align || 'center'}
              options={[
                { value: 'center', label: 'Center' },
                { value: 'left', label: 'Left / Top Edge' },
                { value: 'right', label: 'Right / Bottom Edge' },
                { value: 'custom', label: 'Custom' },
              ]}
              onChange={(v) => updateRamp(selectedSectionId, { align: v })}
            />
            <div className="prop-field">
              <label className="label" htmlFor="ramp-offset">Position along Edge (in)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="ramp-offset-slider"
                  type="range"
                  min="0"
                  max={(() => {
                    const isVert = rampObj.direction === 'n' || rampObj.direction === 's';
                    const edgeLen = isVert ? currentSection.width : currentSection.depth;
                    return Math.max(0, edgeLen - rampObj.width);
                  })()}
                  value={Math.round(getSubObjectOffset(currentSection, 'ramp'))}
                  onChange={(e) => updateRamp(selectedSectionId, { offset: Number(e.target.value), align: 'custom' })}
                  style={{ flexGrow: 1, accentColor: 'var(--accent-primary)' }}
                />
                <input
                  id="ramp-offset"
                  className="input input--sm"
                  type="number"
                  min="0"
                  max={(() => {
                    const isVert = rampObj.direction === 'n' || rampObj.direction === 's';
                    const edgeLen = isVert ? currentSection.width : currentSection.depth;
                    return Math.max(0, edgeLen - rampObj.width);
                  })()}
                  value={Math.round(getSubObjectOffset(currentSection, 'ramp'))}
                  onChange={(e) => updateRamp(selectedSectionId, { offset: Number(e.target.value), align: 'custom' })}
                  style={{ width: '60px' }}
                />
              </div>
            </div>
            <SelectField
              id="sel-ramp-mode"
              label="Ramp Mode"
              value={rampObj.mode || 'ada'}
              options={[
                { value: 'ada', label: 'ADA Compliance (1:12)' },
                { value: 'utility', label: 'Utility Mode' },
              ]}
              onChange={(v) => {
                const nextRun = v === 'ada' ? currentSection.height * 12 : currentSection.height * 8;
                updateRamp(selectedSectionId, { mode: v, run: nextRun });
              }}
            />
            <div className="prop-field">
              <label className="label" htmlFor="ramp-width">Ramp Width (in)</label>
              <input
                id="ramp-width"
                className="input input--sm"
                type="number"
                min="36"
                max="96"
                value={rampObj.width || 36}
                onChange={(e) => updateRamp(selectedSectionId, { width: Number(e.target.value) })}
              />
            </div>
            <div className="prop-field">
              <label className="label" htmlFor="ramp-run">Ramp Run (in)</label>
              <input
                id="ramp-run"
                className="input input--sm"
                type="number"
                min="12"
                max="1000"
                value={rampObj.mode === 'ada' ? (currentSection.height * 12) : (rampObj.run || currentSection.height * 8)}
                readOnly={rampObj.mode === 'ada'}
                disabled={rampObj.mode === 'ada'}
                style={rampObj.mode === 'ada' ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                onChange={(e) => updateRamp(selectedSectionId, { run: Number(e.target.value) })}
              />
            </div>
            <button
              className="btn btn--secondary btn--full btn--sm"
              style={{ color: 'var(--accent-red)', marginTop: '8px' }}
              onClick={() => attachRamp(selectedSectionId, rampObj.direction)}
              id="btn-remove-ramp"
            >
              Remove Ramp
            </button>
          </>
        ) : (
          <SelectField
            id="sel-ramp"
            label="Add Ramp"
            value="none"
            options={[
              { value: 'none', label: 'None' },
              { value: 'n', label: '↑ North Edge', disabled: currentSection.ledgerAttached },
              { value: 's', label: '↓ South Edge' },
              { value: 'e', label: '→ East Edge' },
              { value: 'w', label: '← West Edge' },
            ]}
            onChange={(v) => {
              if (v !== 'none') {
                attachRamp(selectedSectionId, v);
              }
            }}
          />
        )}
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
          {calcs.ramp && (
            <>
              <div className="props-info__divider" />
              <div className="props-info__row">
                <span>Ramp Mode</span>
                <span className="font-mono">{calcs.ramp.mode.toUpperCase()}</span>
              </div>
              <div className="props-info__row">
                <span>Ramp Slope</span>
                <span className="font-mono">{calcs.ramp.slopeRatio}</span>
              </div>
              <div className="props-info__row">
                <span>Ramp Run</span>
                <span className="font-mono">{formatDimension(calcs.ramp.run)}</span>
              </div>
              <div className="props-info__row">
                <span>Ramp Length</span>
                <span className="font-mono">{formatDimension(calcs.ramp.surfaceLength)}</span>
              </div>
              {calcs.ramp.intermediateLandings > 0 && (
                <div className="props-info__row">
                  <span>ADA Landings</span>
                  <span className="font-mono">{calcs.ramp.intermediateLandings}</span>
                </div>
              )}
            </>
          )}
        </div>
        {!joistSpanOk && (
          <div className="props-warning">
            ⚠ Deck depth exceeds max joist span. An interior beam has been added automatically.
          </div>
        )}
        {calcs.ramp && calcs.ramp.mode === 'ada' && calcs.ramp.maxSlopeExceeded && (
          <div className="props-warning">
            ⚠ ADA Ramp slope exceeds 1:12 limit! Max slope exceeded.
          </div>
        )}
        {calcs.ramp && calcs.ramp.mode === 'ada' && calcs.ramp.doesNotFit && (
          <div className="props-warning">
            ⚠ ADA Ramp does not fit in the available space! Overlaps other sections.
          </div>
        )}
      </CollapsibleSection>

      <div className="divider" />

      {/* Unit Prices */}
      <CollapsibleSection
        title="Unit Prices"
        accentColor="#10b981"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg>}
        defaultOpen={false}
      >
        <div className="props-prices">
          {Object.entries(deck.unitPrices || {}).map(([key, val]) => {
            let label = key;
            if (key === 'concrete') label = 'Concrete Mix ($/bag)';
            else if (key === 'joist-hangers') label = 'Joist Hangers ($/ea)';
            else if (key === 'post-bases') label = 'Post Bases ($/ea)';
            else if (key === 'screws') label = 'Screws ($/ea)';
            else label = `${key} Lumber ($/LF)`;

            return (
              <div className="prop-field" key={key}>
                <label className="label" htmlFor={`price-${key}`}>{label}</label>
                <input
                  id={`price-${key}`}
                  type="number"
                  step="0.01"
                  min="0"
                  className="input input--sm font-mono"
                  value={val}
                  onChange={(e) => {
                    const numVal = Math.max(0, parseFloat(e.target.value) || 0);
                    const updatedPrices = { ...(deck.unitPrices || {}), [key]: numVal };
                    updateDeck({ unitPrices: updatedPrices });
                  }}
                />
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </Tag>
  );
}
