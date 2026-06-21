# Apple Home Dashboard — Customization Build Plan

**Goal:** Extend the fork so Nick can fully customize the dashboard:
1. **Move tiles freely** — reorder/move any tile, within and across sections.
2. **Show any entity as a sensor** — promote *any* entity (incl. `sensor`/`binary_sensor`, normally chip-only) to a real tile, rendered read-only "sensor style."

**Audience:** A builder model (Codex) implements this end-to-end. Nick does not touch the terminal. A reviewer (Hermes) checks the result after.

**Repo:** `npstewart87/apple-home-dashboard` (fork of `nitaybz/apple-home-dashboard`)
**Local:** `~/code/apple-home-dashboard` on the Mac mini. `upstream` + `origin` remotes set.
**Branch to build on:** create `feat/custom-tiles-and-sensors` off `main`.

---

## 0. Ground Truth (verified by reading the code — do not re-derive)

### Architecture
- **TypeScript + native Web Components** (Custom Elements + Shadow DOM). **No React/Vue.** Don't introduce a framework.
- **Build:** Webpack 5 → single bundle `dist/apple-home-dashboard.js` (`LimitChunkCountPlugin maxChunks:1`). **Must stay one file** for HACS.
- **Strategy pattern:** `src/apple-home-strategy.ts` registers a Lovelace strategy that returns pure config objects.
- **Manager singletons** in `src/utils/` handle cross-cutting concerns. Follow this pattern; don't scatter logic.
- **CSS-in-JS** via Shadow DOM template literals. Global CSS does nothing here. Container queries (not media queries), 5 breakpoints. **Test RTL** when touching CSS.

### The two files that matter most
- `src/config/DashboardConfig.ts` (1056 lines) — **the brain.** Domain→group maps, card-type decisions, what's a "supported" tile vs chip-only.
- `src/utils/CustomizationManager.ts` (818 lines) — **the memory.** Loads/saves/migrates user customizations.

### Customization schema (LIVE structure — `types.ts` is stale, trust this)
Runtime shape is `{ home, pages, ui, background }`:
```
home: {
  excluded_from_dashboard: string[]
  excluded_from_home: string[]
  sections: { order: string[], hidden: string[] }
  favorites: string[]
  chips_order: string[]
  tall_cards: string[]                       // entity_ids forced to TALL
  entities_order: { [areaId]: string[] }     // per-area tile order  ← tile-move already partly here
}
pages: { [pageKey]: {...} }
ui: { hide_header, hide_sidebar }
background: { type, value }
```
- `migrateToNewStructure()` upgrades old configs. **Any new field MUST be added here with a safe default** so existing users don't break.

### Persistence (already solved — DO NOT build new storage)
- `saveCustomizationsToStorage()` writes the whole `customizations` object **into the dashboard's own Lovelace config** via `hass.callWS({type:'lovelace/config/save', url_path, config})`, keyed per-dashboard.
- Fallback path mentions an `input_text` helper named `apple_home_dashboard_config`.
- **Implication:** new customization fields are persisted automatically once they live in the `customizations` object. No DB, no new WS calls needed.

### Domain / card-type logic (key for Goal #2)
- `SUPPORTED_DOMAINS` = light, switch, cover, climate, fan, media_player, lock, alarm_control_panel, scene, script, camera, vacuum, water_heater. **These become tiles.**
- `STATUS_SECTION_DOMAINS` = `sensor`, `binary_sensor`. **These are chip-only today** (top status chips), never full tiles.
- `getDeviceGroup(domain, entityId, attributes, showSwitches)` maps an entity → a `DeviceGroup` (Climate/Lighting/Security/Energy/Other) using `device_class`.
- `DEFAULT_TALL_DOMAINS` = climate, lock, alarm_control_panel, camera, vacuum, water_heater → render TALL by default.
- `CardDesignType` enum = `REGULAR | TALL` (designed for extension).
- `isSupportedDomain()` gatekeeps whether an entity is rendered as a tile at all.

### Existing reorder/drag infrastructure (key for Goal #1)
- `src/utils/DragAndDropManager.ts` (899 lines) — SortableJS-based, custom touch handling.
- `src/utils/SectionReorderManager.ts` (869 lines) — section ordering.
- `src/utils/EditModeManager.ts` — toggles edit mode.
- `home.entities_order[areaId]` already persists per-area tile order. **Goal #1 is mostly extending this, not building from zero.**

---

## 1. GOAL #1 — Move tiles freely

### What exists
Per-area tile ordering (`entities_order[areaId]`) + SortableJS drag already work *within a section*. The gap is **moving a tile across sections/areas** and a clean UX for it.

### Tasks
1. **Audit current drag scope.** In `DragAndDropManager.ts`, determine whether SortableJS groups are per-section (siloed) or share a group. Document findings in the PR description.
2. **Enable cross-section drag.** Give the relevant Sortable instances a shared `group` (or `group: { name, pull, put }`) so a tile can be dragged from one section into another. Guard against dropping into incompatible carousels (scenes/cameras) unless intended.
3. **Persist cross-area moves.** When a tile moves areas, update BOTH source and destination `entities_order[areaId]` arrays, and if the move implies a new area assignment, record it (see new field below). Save via existing `CustomizationManager` path.
4. **New schema field (if needed):** `home.entity_area_overrides: { [entity_id]: areaId }` — lets a tile live in a section other than its HA-assigned area. Add to `migrateToNewStructure()` default `{}`. Honor it wherever entities are grouped into sections (likely `HomePage.ts` / `DashboardConfig` grouping).
5. **Edit-mode affordance.** Ensure moving is only possible in edit mode (`EditModeManager`), consistent with existing tall-card toggle UX.
6. **RTL + touch:** verify drag works RTL and on touch (iPad wall tablet is a target per README).

### Acceptance
- In edit mode, drag a tile from Living Room into Kitchen; it stays after reload.
- Reordering within a section still works (no regression).
- Order persists per-dashboard (test with two Apple Home dashboards — must stay independent).

---

## 2. GOAL #2 — Show ANY entity as a sensor (read-only tile)

### The core problem
`sensor`/`binary_sensor` (and anything not in `SUPPORTED_DOMAINS`) can't be placed as a tile today. "Show any entity as a sensor" = let the user **promote any entity to a read-only tile** that displays its state/icon like a sensor readout, regardless of domain.

### Design decision (recommend to builder)
Add a **third card design type** `SENSOR` to `CardDesignType` (`'sensor'`). A SENSOR card:
- Renders entity friendly name + current state + unit + icon, **read-only** (no toggle/control action; tap may open more-info dialog only).
- Works for ANY domain (sensor, binary_sensor, or even a light shown as a readout).
- Respects existing styling tokens (`LiquidGlassStyles.ts`), REGULAR footprint by default, TALL allowed.

### Tasks
1. **Extend the enum:** add `SENSOR = 'sensor'` to `CardDesignType` in `types.ts`.
2. **New schema field:** `home.sensor_cards: string[]` (entity_ids the user forced to sensor-style). Add to `migrateToNewStructure()` default `[]`. Mirror the existing `tall_cards` pattern exactly — it's the proven template for "user forced this entity into a display mode."
3. **New schema field:** `home.promoted_entities: string[]` (entity_ids the user added as tiles even though their domain isn't in `SUPPORTED_DOMAINS`). Default `[]`.
4. **Gatekeeper change:** where `isSupportedDomain()` filters entities out, also allow any entity_id present in `promoted_entities`. Don't widen `SUPPORTED_DOMAINS` globally — keep promotion explicit/opt-in.
5. **Card type resolution:** in the card-type decision path (search `is_tall` / `CardDesignType` usage in `DashboardConfig.ts` + `AppleHomeCard.ts`), add: if entity ∈ `sensor_cards` → render SENSOR design. Precedence: SENSOR > TALL > REGULAR (a forced sensor is read-only even if also tall-eligible — or allow SENSOR+TALL combo; builder's call, document it).
6. **Renderer:** implement the SENSOR card body in `src/components/AppleHomeCard.ts` (and/or wherever REGULAR/TALL render). Read-only, state-formatted (use HA's state + `unit_of_measurement`; format binary_sensor as on/off or device_class-aware text). Reuse existing icon/color helpers (`EntityData` / `getDeviceGroup` for grouping color).
7. **Picker UI:** in edit mode, provide a way to (a) add an entity as a tile (entity picker → adds to `promoted_entities`), and (b) toggle an existing tile to "show as sensor" (adds/removes from `sensor_cards`). Mirror how the tall-card toggle is surfaced today — find that UI and extend the same menu/long-press affordance. Keep it native (no new framework).
8. **Grouping:** a promoted entity needs a home section. Default to its HA area; if none, use `entity_area_overrides` (from Goal #1) or an "Other" group. Let the user move it (Goal #1 makes this natural).

### Acceptance
- In edit mode, add a `sensor.*` (e.g. a temperature or battery sensor) as a tile → appears as a read-only sensor card showing the value + unit.
- Toggle an existing controllable tile (e.g. a light) to "show as sensor" → becomes read-only readout; toggling back restores controls.
- Survives reload; per-dashboard isolation holds.
- No regression to existing chip/StatusSection behavior (sensors should STILL appear in chips unless explicitly promoted — promotion is additive).

---

## 3. Cross-cutting requirements

- **Migration safety:** every new field added to `migrateToNewStructure()` with a default; old saved configs must load without error. Test by loading a config that lacks the new fields.
- **Single-bundle:** `npm run build` must still emit one `dist/apple-home-dashboard.js`. No code-splitting.
- **Lint/format:** `npm run lint` and `npm run format` clean before commit.
- **i18n:** any new user-facing strings go through `LocalizationService` / `localize()` and get added to `src/translations/en.json` (other languages can fall back).
- **RTL + touch:** verify on RTL and touch; iPad is a first-class target.
- **Don't break HACS:** keep `hacs.json`, single bundle, and the strategy registration intact.

---

## 4. Build sequence (suggested for Codex)

1. Branch `feat/custom-tiles-and-sensors` off `main`.
2. Schema first: extend `types.ts` (`Customizations`/`CardDesignType`) + `migrateToNewStructure()` defaults. Build — confirm no runtime break.
3. Goal #2 data path: `promoted_entities` + `sensor_cards` gatekeeping + card-type resolution (no UI yet). Hardcode a test entity to verify rendering.
4. Goal #2 renderer: SENSOR card in `AppleHomeCard.ts`.
5. Goal #2 UI: edit-mode picker + per-tile "show as sensor" toggle.
6. Goal #1: shared SortableJS group for cross-section drag + `entity_area_overrides` persistence.
7. Polish: RTL, touch, i18n strings, lint/format.
8. `npm run build`, deploy bundle to HA (`dist/apple-home-dashboard.js` → HA `www`/HACS path + bump hacstag), hard-refresh, manual test against acceptance criteria.
9. Commit in logical chunks, push branch, open PR against `npstewart87/apple-home-dashboard:main`. PR body documents: what changed, new schema fields, how persistence works, test evidence (screenshots/gifs of moving a tile + a promoted sensor).

---

## 5. Files Codex will most likely touch

| File | Why |
|---|---|
| `src/types/types.ts` | extend `Customizations`, `CardDesignType` |
| `src/utils/CustomizationManager.ts` | migration defaults; (persistence already handled) |
| `src/config/DashboardConfig.ts` | `isSupportedDomain` gate, card-type resolution, grouping |
| `src/components/AppleHomeCard.ts` | SENSOR card renderer; sensor/tall/regular branching |
| `src/components/AppleHomeView.ts` | possibly, for section composition |
| `src/pages/HomePage.ts` / `RoomPage.ts` | grouping promoted entities into sections |
| `src/utils/DragAndDropManager.ts` | shared group for cross-section drag |
| `src/utils/EditModeManager.ts` | gating new edit affordances |
| `src/sections/*` | where the per-tile menu/long-press lives (find the tall-card toggle, extend it) |
| `src/translations/en.json` | new strings |

---

## 6. Guardrails / "don't do this"

- ❌ Don't add React/Vue/any framework.
- ❌ Don't split the bundle.
- ❌ Don't widen `SUPPORTED_DOMAINS` globally to "fix" Goal #2 — promotion must be explicit per entity (avoids flooding every dashboard with hundreds of sensors).
- ❌ Don't build a new storage backend — reuse `CustomizationManager` persistence.
- ❌ Don't break old saved configs — migration defaults are mandatory.
- ❌ Don't make SENSOR cards interactive controls — they're read-only by definition (more-info dialog on tap is the most they do).
