# Design System: RepoMind — Codebase Copilot

## 1. Visual Theme & Atmosphere
A restrained, high-agency engineering cockpit with confident typographic hierarchy, calibrated dark surfaces, and tactile micro-motion. The atmosphere feels like a precision instrument for software architects: deep dark canvas, whisper-thin borders, calm slate neutrals, and a singular electric sky cyan accent (#38BDF8) with zero garish neon glow. Every interaction communicates density, precision, and verified semantic grounding.

- **Density:** 7 (Cockpit Balanced — dense code inspectability without visual friction)
- **Variance:** 6 (Offset Asymmetric hierarchy with strict tabular alignment)
- **Motion:** 6 (Fluid spring physics with 120ms tactile response)

---

## 2. Color Palette & Roles
- **Obsidian Canvas (`#090A0F`)** — Base root canvas, ultra-dark matte off-black. Never pure black (#000000).
- **Surface Elevation (`#0F1219`)** — Navbar, sidebars, and elevated message bubbles.
- **Card Substrate (`#151923`)** — Code inspector cards, trace logs, modal dialogs.
- **Card Hover Substrate (`#1C2230`)** — Interactive hover states for buttons and citation chips.
- **Whisper Border (`rgba(255, 255, 255, 0.08)`)** — 1px micro-borders separating panels and cards.
- **Subtle Line (`rgba(255, 255, 255, 0.04)`)** — Internal dividers and horizontal rules.
- **Primary Ink (`#F8FAFC`)** — Main headlines and query prompt text (Slate-50).
- **Secondary Ink (`#94A3B8`)** — Explanations, source metadata, and component descriptions.
- **Muted Carbon (`#64748B`)** — Line numbers, keyboard hints, timestamps, and inactive icons.
- **Sky Cyan Accent (`#38BDF8`)** — Singular functional accent for citations, active pills, and primary CTAs.
- **Emerald Grounding (`#10B981`)** — Guardrail passed indicators and commit SHA verification badges.
- **Amber Warning (`#F59E0B`)** — Issue tracking and moderate confidence tags.
- **Rose Alert (`#F43F5E`)** — Error banners and failed guardrail states.

---

## 3. Typography Rules
- **Display / Headlines:** `Plus Jakarta Sans` or modern grotesque sans-serif (`-apple-system, BlinkMacSystemFont, "Segoe UI"`). Tracking tight (`-0.02em`), confident weight (700), never shouty or inflated.
- **Body & Prose:** Clean system sans (`14px / 1.65` line height). Max 70 characters per reading line in answer bubbles.
- **Code & Numbers:** `JetBrains Mono` / `SF Mono` / `ui-monospace`. All file paths, line ranges (`L12–L45`), commit SHAs (`@56393c9`), and citation indexes (`[1]`) MUST use monospace.
- **Anti-Patterns Banned:** `Inter` in generic defaults, generic serifs (Times/Georgia), rainbow gradient header text.

---

## 4. Component Stylings
- **Citation Badges:** Compact monospace numbers (`[1]`, `[2]`). Resting background `rgba(56, 189, 248, 0.08)`, border `rgba(56, 189, 248, 0.25)`, text `#38BDF8`. Active/hover transforms to solid `#38BDF8` with dark ink.
- **Buttons:** Tactile feedback with `-1px` scale on active click. Primary CTA uses Sky Cyan fill with dark text. Secondary buttons use transparent fill with `1px` whisper border.
- **Cards & Popovers:** Border radius `8px–12px`. Tinted diffused shadow `0 12px 32px -4px rgba(0, 0, 0, 0.6)`. No bright outer glow boxes.
- **Inputs:** Dark recessed field with subtle border. Focus state activates subtle 1px border highlight (`rgba(56, 189, 248, 0.4)`) and zero ugly browser outlines.
- **Progress Bars:** Smooth cubic-bezier transitions (`0.25, 1, 0.5, 1`) with dual-color linear gradients and live log streams.

---

## 5. Layout Principles
- **Spatial Containment:** Max-width containment (920px for chat thread, 1400px for desktop container).
- **Z-Index Layering:** Strict non-overlapping layers. Floating citation inspect drawers dock directly below the active bubble.
- **Empty State Restraint:** Minimalist hero badge + direct headline + single repository switch action. No distracting decorative card grids.

---

## 6. Motion & Micro-Interactions
- **Spring Physics:** `cubic-bezier(0.16, 1, 0.3, 1)` for smooth entry fades.
- **Streaming Pulse:** Subtle 6px emerald/cyan pulse dot during token and vector generation.
- **Hardware Acceleration:** All transitions strictly isolated to `opacity` and `transform`.

---

## 7. Anti-Patterns (Banned)
- ❌ No emojis in system UI labels or buttons
- ❌ No pure black backgrounds (`#000000`)
- ❌ No neon purple/blue AI gradient blurs
- ❌ No 3-column generic marketing cards
- ❌ No filler copywriting ("Unleash your code", "Next-gen AI copilot")
- ❌ No floating labels or clumsy multi-step wizards
