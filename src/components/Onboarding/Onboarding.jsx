import React, { useState, useEffect } from 'react';
import './Onboarding.css';

const STORAGE_KEY = 'deckforge_onboarded';

const STEPS = [
  {
    title: 'Welcome to DeckForge',
    desc: 'Design structural decks with real-time material calculations based on IRC R507 building code.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="og" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6"/>
            <stop offset="100%" stopColor="#8b5cf6"/>
          </linearGradient>
        </defs>
        <rect x="4" y="28" width="56" height="6" rx="2" fill="url(#og)"/>
        <rect x="8" y="36" width="4" height="20" rx="1" fill="#3b82f6" opacity="0.8"/>
        <rect x="26" y="36" width="4" height="24" rx="1" fill="#3b82f6" opacity="0.8"/>
        <rect x="52" y="36" width="4" height="20" rx="1" fill="#3b82f6" opacity="0.8"/>
        <rect x="6" y="22" width="52" height="4" rx="1" fill="#f59e0b" opacity="0.9"/>
        <rect x="6" y="16" width="52" height="4" rx="1" fill="#f59e0b" opacity="0.7"/>
        <rect x="6" y="10" width="52" height="4" rx="1" fill="#f59e0b" opacity="0.5"/>
      </svg>
    ),
  },
  {
    title: 'Set Your Dimensions',
    desc: 'Use the Properties panel to set deck width, depth, and height. The structural engine recalculates joists, beams, and posts automatically.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#3b82f6" strokeWidth="2">
        <rect x="8" y="8" width="32" height="32" rx="2" strokeDasharray="4 2"/>
        <line x1="8" y1="4" x2="40" y2="4" stroke="#f59e0b"/>
        <line x1="44" y1="8" x2="44" y2="40" stroke="#f59e0b"/>
        <text x="24" y="3" fill="#f1f5f9" fontSize="6" textAnchor="middle" fontFamily="Inter" stroke="none">16'</text>
        <text x="47" y="26" fill="#f1f5f9" fontSize="6" textAnchor="middle" fontFamily="Inter" stroke="none">12'</text>
      </svg>
    ),
  },
  {
    title: 'Choose Your Materials',
    desc: 'Select lumber species, joist size, spacing, beam configuration, and decking material. Each choice impacts structural calculations.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="8" width="36" height="6" rx="1" fill="#c4a35a" opacity="0.8"/>
        <rect x="6" y="16" width="36" height="6" rx="1" fill="#c4a35a" opacity="0.6"/>
        <rect x="6" y="24" width="36" height="6" rx="1" fill="#c4a35a" opacity="0.4"/>
        <rect x="6" y="32" width="36" height="6" rx="1" fill="#c4a35a" opacity="0.3"/>
      </svg>
    ),
  },
  {
    title: 'View in 2D & 3D',
    desc: 'Toggle between blueprint and 3D views. Pan by dragging, or pinch-to-zoom on mobile. Rotate the 3D model to inspect from any angle.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#3b82f6" strokeWidth="2">
        <path d="M24 6L6 16l18 10 18-10L24 6z" fill="rgba(59,130,246,0.1)"/>
        <path d="M6 32l18 10 18-10"/>
        <path d="M6 24l18 10 18-10"/>
      </svg>
    ),
  },
  {
    title: 'Bill of Materials',
    desc: 'The BOM bar shows every component needed. Expand it for detailed quantities. Export a PDF for permit applications or material purchases.',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#f59e0b" strokeWidth="2">
        <path d="M18 10H14a4 4 0 0 0-4 4v24a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4V14a4 4 0 0 0-4-4h-4"/>
        <rect x="18" y="6" width="12" height="8" rx="2" fill="rgba(245,158,11,0.15)"/>
        <line x1="18" y1="24" x2="30" y2="24"/>
        <line x1="18" y1="30" x2="26" y2="30"/>
        <line x1="18" y1="36" x2="22" y2="36"/>
      </svg>
    ),
  },
];

export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setVisible(true);
    } catch { setVisible(true); }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else dismiss();
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="onboarding__backdrop">
      <div className="onboarding__card">
        {/* Progress dots */}
        <div className="onboarding__dots">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`onboarding__dot ${i === step ? 'onboarding__dot--active' : ''} ${i < step ? 'onboarding__dot--done' : ''}`}
            />
          ))}
        </div>

        <div className="onboarding__icon">{current.icon}</div>
        <h2 className="onboarding__title">{current.title}</h2>
        <p className="onboarding__desc">{current.desc}</p>

        <div className="onboarding__actions">
          {step > 0 ? (
            <button className="btn btn--ghost onboarding__btn" onClick={prev}>Back</button>
          ) : (
            <button className="btn btn--ghost onboarding__btn onboarding__skip" onClick={dismiss}>Skip</button>
          )}
          <button className="btn btn--primary onboarding__btn" onClick={next}>
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>

        <div className="onboarding__step-label">
          {step + 1} of {STEPS.length}
        </div>
      </div>
    </div>
  );
}
