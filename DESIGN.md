---
name: BlueprintDeckEngine
description: 3D deck building software for DIY homeowners
colors:
  primary: "#4e8ef7"
  primary-deep: "#2563eb"
  neutral-bg: "#060a14"
  neutral-text: "#e8edf5"
  warm-accent: "#f5a623"
  green-accent: "#34d399"
  red-accent: "#f87171"
typography:
  display:
    fontFamily: "'Inter', -apple-system, sans-serif"
    fontSize: "2rem"
  body:
    fontFamily: "'Inter', -apple-system, sans-serif"
    fontSize: "0.8125rem"
  label:
    fontFamily: "'Inter', -apple-system, sans-serif"
    fontSize: "0.6875rem"
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  input:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
---

# Design System: BlueprintDeckEngine

## 1. Overview

**Creative North Star: "The Expert Blueprint"**

The design system exudes technical precision, reliability, and expert confidence. It's built for functionality, centering the 3D visualizer while maintaining an interface that feels robust and structural. It explicitly avoids feeling like an overwhelming CAD tool or a cartoonish toy.

**Key Characteristics:**
- Strict functional layout
- Expert typographic hierarchy
- Layered surfaces using glassmorphism for depth
- Authoritative but accessible tone

## 2. Colors

The palette is anchored by a deep technical canvas and punctuated with sharp, structural accents.

### Primary
- **Blueprint Blue** (#4e8ef7): Used for primary actions, selections, and focus rings to guide the user reliably through their tasks.

### Secondary
- **Safety Amber** (#f5a623): Used for warnings and structural cautions.
- **Success Green** (#34d399): Used for validation and healthy structural metrics.
- **Error Red** (#f87171): Used strictly for structural violations that prevent building.

### Neutral
- **Deep Space** (#060a14): The primary application canvas in dark mode.
- **Crisp White** (#e8edf5): Primary readable text.

### Named Rules
**The Expert Restraint Rule.** Color is functional, never purely decorative. Use semantic colors (amber, green, red) strictly for their meaning, not for generic branding.

## 3. Typography

**Display Font:** Inter (with sans-serif)
**Body Font:** Inter (with sans-serif)
**Label/Mono Font:** JetBrains Mono (with monospace)

**Character:** Technical, highly legible, and precise.

### Hierarchy
- **Display** (2rem, 1.2): Hero headers and major tool states.
- **Body** (0.8125rem, 1.5): Standard UI text.
- **Label** (0.6875rem, uppercase, 0.08em): Eyebrows, toolbars, and metadata.
- **Code/Metrics** (0.8125rem, JetBrains Mono): Data tables and measurements.

## 4. Elevation

The system is layered and lifting, utilizing glassmorphism to show depth above the 3D canvas without obscuring it completely.

### Shadow Vocabulary
- **Float** (`0 8px 32px rgba(0,0,0,0.55)`): Modal dialogs and central overlays.
- **Panel** (`0 4px 16px rgba(0,0,0,0.45)`): Floating tool panels and HUDs.
- **Action Glow** (`0 0 24px rgba(78,142,247,0.2)`): Used on primary actions and selections to emphasize interactivity.

### Named Rules
**The Glass Canvas Rule.** UI panels floating over the 3D viewport must use glassmorphism (translucency + background blur) to maintain the user's spatial awareness of the structure underneath.

## 5. Components

### Buttons
- **Shape:** 6px radius.
- **Primary:** Blueprint Blue gradient with inner shadow and text glow.
- **Hover / Focus:** Lifts (-1px) and intensifies glow.
- **Ghost:** Transparent background with subtle hover state.

### Cards / Containers
- **Corner Style:** 10px to 14px radius.
- **Background:** Semi-transparent glass (`rgba(12, 18, 33, 0.75)`).
- **Shadow Strategy:** Elevated panels over the 3D scene.
- **Border:** Subtle structural borders (`rgba(59, 130, 246, 0.12)`).

### Inputs / Fields
- **Style:** Flat background, 1px subtle border, 6px radius.
- **Focus:** Blueprint Blue border with an outer glow.

## 6. Do's and Don'ts

### Do:
- **Do** rely on structural borders and precise spacing to group information.
- **Do** keep error messages educational and focused on safety.

### Don't:
- **Don't** use overly playful or cartoonish interfaces.
- **Don't** create overwhelming, dense CAD-like panels that crowd the screen.
- **Don't** obscure the 3D visualizer completely; it is the hero.
