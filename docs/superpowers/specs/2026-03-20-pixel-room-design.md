# Pixel Room View — Design Spec

**Date**: 2026-03-20
**Branch**: `redesign/pixel-room` (based on `main`)
**Status**: Approved

---

## Overview

Add a **Pixel Room** view to the existing live-dashboard frontend. The room is an alternative way to visualize device activity: each online device is represented by a Stardew-Valley-style pixel character sitting at a desk, with their current app shown on their monitor screen.

This is a **new view alongside the existing card view** — a toggle button at the top of the page switches between "Room" and "Cards". No existing UI is removed or modified.

---

## Visual Design

### Style
- **Pixel art**, Stardew Valley aesthetic: small blocky characters, soft colors, no anti-aliasing
- Implemented entirely with **inline SVG + CSS** — no external images, no new libraries

### Perspective
- **Front-facing full view** (正面全景): like looking at a stage set
- Viewer sees the full room: back wall, window, baseboard, wooden floor
- All characters and desks arranged horizontally left-to-right

### Color Modes (auto-switching)

| State | Mode | Palette |
|-------|------|---------|
| Any device online | **Day** | Warm cream wall `#efe5d0`, cherry-blossom curtains `#f0b0c0`, honey-wood floor `#c8935a`, sunshine window |
| All devices offline | **Night** | Deep purple wall `#16213e`, dark-wood floor `#2c1a0e`, moonlight window, matches existing `body.night-mode` |

Transition between modes uses the same 1.2s CSS transition already present in the main theme.

### Per-device Slot

Each device occupies one slot (desk + character). Slots are laid out evenly; up to 4 devices fit comfortably, more will scroll or compress.

**Online state:**
- Character sits upright at desk, subtle breathing animation (CSS keyframe, ~3s cycle, `transform: scaleY`)
- Monitor screen is lit (blue glow border)
- Screen displays: app emoji/icon (large, centered) + app name (small text below)
- Character name label below the desk

**Offline state:**
- Character is dimmed (`opacity: 0.35`), head drooped, `zzz` text floats above
- Monitor screen is dark, no border glow
- Label shows device name with ○ indicator

### Room Decorations (fixed)
- Window centered on back wall (sunshine / moon depending on mode)
- One potted plant `🪴` between desk slots as decoration
- Wooden floor planks (CSS horizontal lines)
- Curtains on window sides

---

## Architecture

### New Files

```
packages/frontend/src/components/
└── PixelRoom.tsx          # Main room component
    ├── RoomBackground     # Wall, window, floor, curtains (SVG)
    ├── DeviceSlot         # One character + desk + monitor (SVG, per device)
    └── (inline SVG only, no sub-files needed)
```

### Modified Files

```
packages/frontend/src/components/
└── CurrentStatus.tsx      # Add view toggle button; conditionally render PixelRoom or existing cards

packages/frontend/app/
└── globals.css            # Add pixel-room CSS animations (breathing, glow, zzz float)
```

### Data Flow

- `PixelRoom` receives the same `devices: DeviceState[]` prop already available in `CurrentStatus`
- No new API calls, no backend changes
- Re-uses existing `useDashboard` hook (10s polling)
- Day/night mode detected via `document.body.classList.contains('night-mode')` (already set by existing logic)

### View Toggle State

- Stored in React `useState` (local, not persisted) — defaults to `"room"` view
- Toggle button: two icons, `🏠` Room / `📋` Cards, pill-shaped, placed in the existing header area of `CurrentStatus`

---

## Animations

All via CSS `@keyframes`, `prefers-reduced-motion` respected:

| Animation | Target | Details |
|-----------|--------|---------|
| `breathe` | Online character body | `scaleY(1) → scaleY(0.97)`, 3s ease-in-out infinite |
| `screenGlow` | Online monitor border | opacity 1 → 0.6 → 1, 4s infinite |
| `zzzFloat` | Offline zzz text | `translateY(0) → translateY(-6px)`, 2s infinite |

---

## Constraints & Non-Goals

- **No isometric/oblique view** — front-facing only, simpler to implement
- **No speech bubbles** — app info shown on monitor screen only
- **No external sprite sheets or image files** — pure SVG
- **No new npm packages**
- **No backend changes**
- **No changes to existing card view**
- **Max 4 devices** renders cleanly; beyond that, slots compress (acceptable degradation)

---

## Acceptance Criteria

1. Toggle button switches between Room and Cards views
2. Room shows correct online/offline state for each device from `/api/current`
3. Online character has breathing animation; offline has zzz
4. Monitor screen shows current `app_name` for online devices
5. Day/night color mode matches `body.night-mode` class state
6. `prefers-reduced-motion` disables all animations
7. No regressions in existing card view
8. Works on mobile (characters stack or scale down gracefully)
