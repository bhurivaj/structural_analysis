# Structural Analysis Web App — Spec

**Objective:** Quick reference to avoid losing context on long projects. Current state, architecture, data flow, and next steps only.

---

## Architecture

**Stack:**
- Frontend: Vue 3 + TypeScript + Vite
- State: Pinia (stores: structureStore, loadsStore, steelProfileStore, solverStore, settingsStore)
- Routing: Vue Router 4
- Styling: Tailwind CSS v4
- Canvas: D3.js v7 (zoom, pan, interactive drawing)
- FEM Math: mathjs (lusolve for matrix solve)
- Testing: Vitest (unit), Playwright (e2e)

**Infrastructure:**
- Docker Compose — dev environment at `http://localhost:5173`
- Node 22-alpine container
- App source in `./app/`

**Directory Structure:**
```
src/
├── types/          ← TypeScript interfaces
├── stores/         ← Pinia state management
├── solver/         ← FEM engine (matrix stiffness method)
├── components/     ← Vue components (canvas, panels, UI)
├── views/          ← 4 pages: Workspace, SteelProfiles, Analysis, Report
├── composables/    ← Reusable logic (undo/redo, viewport, session cache)
└── data/           ← TIS steel profiles (374 total: H, I, C, L, RHS, CHS, RoundPipe, WideFlange, LightLipChannel)
```

---

## Current State

**✅ Completed (27/27 features):**

1. **Interactive Canvas Workspace**
   - D3 draw tools: SELECT, PAN, ADD_NODE, ADD_MEMBER, ADD_POINT_LOAD, ADD_DIST_LOAD, ADD_MOMENT
   - Pan/zoom: scroll wheel, middle-mouse (wheel click), Space+drag temporary pan
   - Keyboard shortcuts (S, P, N, M, L, D, R, G=snap-toggle, Delete, Ctrl+Z/Y)
   - Undo/Redo with debounced snapshots (up to 50 entries)
   - Session persistence: auto-save to localStorage + resume dialog
   - **Force labels now update when unit settings change + deformed scale changes**
   - **Grid snap toggle (G key)** — snap new nodes to integer world units; adaptive grid (power-of-2 sizing) visible at all zoom levels
   - **Shift+drag node** — snap to nearest grid position
   - **Editable node labels** — auto-assigned N1, N2, … with inline editing
   - **Truss validation** — moment loads prevented on truss structures with UX feedback
   - **Member label display on canvas** — shows member label + steel profile designation (e.g., "M1 / H 150×75") at midpoint, changes color when selected
   - **Ghost line preview** — shows correct direction when drawing members or reconnecting endpoints
   - **Origin marker** — crosshair at (0,0) visible on canvas
   - **Fit-to-view button** — correctly centers structure and zooms to fit

2. **FEM Solver**
   - 2D Frame + Truss analysis via matrix stiffness method
   - Nodes, members, loads (point, distributed, moment, supports)
   - Calculates: displacements, reactions, member end forces

3. **Steel Profile Database**
   - **TIS 1228 Thai standard — 374 profiles total** (extracted from single source of truth: steel.xlsx)
   - H-Sections (73), I-Sections (20), Channels (16), Equal Angles (46), Rectangular Tubes/RHS (26), Square Tubes/CHS (32), Round Pipes (35), Wide Flange (81), Light Lip Channel (45)
   - Cross-section SVG rendering per profile class

4. **Settings System**
   - Units: Force (kN/N/tf), Length (m/cm/mm/ft), Stress (MPa/kPa/tf/cm²/ksc)
   - Project info: name, engineer name
   - Default member parameters: E, Fy, A, I
   - **Deformed shape amplification slider (0–5000, displayed as 0.0x–50.0x, default 1000 = 10.0x)**
   - All persisted to localStorage
   - **Unit changes now propagate instantly to canvas, analysis, and report**

5. **Analysis Page**
   - DiagramPanel: interactive N/V/M diagrams (member selector + toggle buttons)
   - Tables: reactions, displacements, member end forces (all with proper unit conversion)
   - **DesignAssessmentPanel: per-member utilization ratios with pass/fail/marginal status**
   - **Automated suggestions for structural improvements in Thai**

6. **Print Report**
   - Project header (name, engineer, units, code reference)
   - **Section 1: Structure Diagram** — SVG canvas snapshot captured after analysis (responsive viewBox, fits print)
   - **Section 2: Structure Summary** — type, node/member/load count, design pass/fail count
   - **Section 3: Design Criteria** — AISC 360 φ values, K, Lb, PASS/MARGINAL/FAIL thresholds from `settings.urMarginal`/`urFail`, Fy/E defaults
   - **Section 4–5: Nodes & Members** — with member length, profile name, type (Frame/Truss/Cable)
   - **Section 6: Steel Profile Parameters** — d, bf, tf, tw, A, Ix, Iy, Sx, ry, Fy, mass (shown only when profiles used)
   - **Section 7: Applied Loads** — label, type, location (member label for distributed loads), values in selected units
   - **Sections 8–10: Reactions, Displacements, Member End Forces** — all unit-converted; displacement ux/uy in selected length unit
   - **Section 11: Design Assessment (LRFD)** — per-member UR table with color-coded status, suggestion notes
   - **Print CSS** — resets overflow constraints from App layout so all content prints; font/padding tuned for A4
   - **Scrollable** — report page uses `overflow-y-auto` within fixed navbar layout
   - All values converted to selected units

7. **JSON Import/Export**
   - ⬆⬇ button in navbar opens modal
   - Two input methods: paste JSON or upload .json file
   - Full validation of structure, members, loads schema
   - Confirmation dialog before replacing current data
   - Export button downloads current session as JSON

8. **Testing**
   - **132 E2E Playwright tests** across 15 spec files: navigation, steel profiles, canvas tools, pan/zoom, unit reflection, import/export, design assessment, deformed shape, CAD interactions, member labels, tension-only, endpoint-reconnect, support icons, distributed load rendering, rubber band selection, load cases/combinations, envelope analysis, capacity graph, bug-fix regressions
   - **320 Vitest unit tests** covering solver, LRFD design checks, autoSize, steel profiles, load cases store, envelope analysis, trapezoidal distributed load correctness, and utility logic
   - **Total: 452 tests passing** — comprehensive coverage of all features and edge cases

9. **Bug Fixes & Canvas Improvements (Recent Wave)**
   - **Cross-section SVG rendering:** H/I, C, L, RHS, CHS now render correctly
   - **Undo/Redo timing:** Fixed with `nextTick()` to prevent race conditions
   - **Unit reflection:** Canvas force labels, moment conversions, load values all reactive to unit changes
   - **Multi-assign panel logic:** Fixed `multiSelectActive` condition to correctly exclude member-only multi-select
   - **Resume dialog:** Fixed re-appearance on navigation-back by checking `structure.nodes.length === 0`
   - **Analysis profile persistence:** Profile assignments now saved explicitly via `cache.saveSession()` when modified in DesignAssessmentPanel
   - **Column buckling UR mismatch:** Fixed `autoSize.ts` to derive `ry = sqrt(Iy/A)` instead of using `profile.ry = 0`
   - **Trapezoidal distributed load fixed-end forces (Bug):** `loadVector.ts` used `wAvg=(w1+w2)/2` instead of `w1` as the uniform part in superposition — fixed to `w1*L/2 + 3*dw*L/20` giving correct `(7w1+3w2)L/20` formula
   - **Trapezoidal distributed load V/M stations (Bug):** `postProcessor.ts` used `w(xi)·x` to approximate load integral — replaced with correct integrals `w1·x + dw·x²/(2L)` for V and `w1·x²/2 + dw·x³/(6L)` for M; UDL (w1=w2) was unaffected
   - **Ghost line direction (Y-axis):** Fixed SVG Y-coordinate negation in member/endpoint ghost lines (lines 374, 411)
   - **Fit-to-view button:** Corrected viewport calculation using actual `clientWidth/Height` and proper Y-coordinate formula
   - **Canvas origin at startup:** Set initial viewport so world (0,0) centers at screen center (line 643)
   - **Grid disappears on zoom-in:** Implemented adaptive power-of-2 grid sizing (lines 107–131) — grid now always visible
   - **Origin marker crosshair:** Added visual indicator at world (0,0) with accent-colored lines
   - **G key snap toggle:** Wired G key to `toggleSnap()` in `handleKeyDown` and snap logic to `ADD_NODE` handler
   - **Shift+drag node snap:** Nodes snap to nearest integer world unit when held Shift during drag (line 617–620)
   - **Middle-mouse pan:** Added support for middle-button drag in any mode (using `event.buttons & 4` check, line 625)
   - **Steel profiles lazy-load issue:** Profiles now eager-loaded in store init; visible on Workspace without visiting SteelProfileView first
   - **Distributed load rendering:** Implemented full visualization with perpendicular arrows, trapezoidal fill, baseline, and w1/w2 labels
   - **Support icons redesign:** Updated to proper structural engineering symbols:
     - **Pinned:** Triangle pointing down + base line + diagonal hatch marks
     - **Fixed:** Horizontal bar + diagonal hatch marks (representing wall below)
     - **Roller:** Triangle + two circles for wheels; direction-aware (X-axis: points left, wheels vertical; Y-axis: points down, wheels horizontal)
   - **Roller direction (axis X vs Y):** Separated rendering logic so horizontal roller (constrained in X) displays correctly with left-pointing triangle and vertically-stacked wheels
   - **LoadPanel type auto-update:** Fixed watch on `activeTool` with `{ immediate: true }` so load type is set when panel mounts after tool already active

10. **Session Management**
    - Auto-save 800ms after changes
    - Resume dialog on page reload

11. **Undo/Redo**
    - 300ms debounced snapshots
    - 50-entry stack with oldest drop-off
    - Fixed watcher timing with `nextTick()`

12. **Design Assessment** — LRFD (AISC 360)
    - **Axial capacity** (AISC E3): Compression with column curve; Tension with Fy; both with φc/φt = 0.9
    - **Flexural capacity** (AISC F2): Uses Sx with LTB check; Lp = 1.76×ry×√(E/Fy); φb = 0.9
    - **Shear capacity** (AISC G2): Vn = 0.6×Fy×Av; φv = 1.0
    - **Interaction** (H1-1): If UR_axial ≥ 0.2: UR_combined = UR_axial + (8/9)×UR_bending; else: UR_axial/2 + UR_bending
    - UR_combined = max(interaction, UR_shear)
    - Color-coded results: green (pass), yellow (marginal), red (fail)
    - Thai-language improvement suggestions per member (with shear guidance)

13. **Deformed Shape Visualization**
    - DEF button on analysis canvas toggles deformed member overlay
    - Deformed members shown as dashed blue lines with displacement amplification
    - **Scale controlled via settings slider (0–5000, displayed as amplification factor: 0.0x–50.0x)**
    - **Default: 1000 (10x amplification) for clear visibility**
    - Canvas dashing scales with zoom for consistent appearance

14. **Multi-select & Batch Delete**
    - Rubber-band selection and Shift+click toggle in SELECT mode
    - Right panel shows "Delete Selected" button when 2+ items selected
    - Delete/Backspace cascades to remove orphaned loads (point, distributed, moment)
    - **All dependent loads cleaned up automatically when nodes/members deleted**

15. **Load Tools UX Rework**
    - **Press L/D/R → right panel auto-switches to Load tab, loadType auto-set**
    - **Click node in ADD_POINT_LOAD/ADD_MOMENT mode → Node dropdown pre-filled**
    - **Click member in ADD_DIST_LOAD mode → Member dropdown pre-filled**
    - **Click load item in list → form populates for editing with "Update Load" button**
    - Cancel button exits edit mode; supports update/add workflows seamlessly

16. **Auto-switch Tab on SELECT Click**
    - **In SELECT mode, clicking a node → right panel switches to Node tab**
    - **In SELECT mode, clicking a member → right panel switches to Member tab**
    - **In SELECT mode, clicking a load arrow → right panel switches to Load tab with form pre-filled for editing**
    - Load arrows (point, distributed, moment) now interactive in SELECT mode
    - **Distributed load click area improved with invisible interaction rect** — easier to select
    - Tab switching is automatic based on canvas selection/editing state

17. **Friendly Member & Load Labels**
    - **Member auto-label** — M1, M2, … (sequential) + editable in MemberPanel
    - **Load auto-label** — PL1, DL1, ML1 (per-type counters) + editable in LoadPanel
    - Labels shown in load list instead of raw ID slices
    - Labels persist in reports
    - Easy visual identification of members and loads during modeling

18. **Enhanced Click/Drag UX (CAD-style interactions)**
    - **Wider member hit area** — invisible 14px thick stroke behind 2px visible line; click members easily even when zoomed out
    - **Deselect on background click** — clicking empty canvas in SELECT mode clears all selections
    - **ADD_MEMBER ghost line preview** — dashed blue line follows cursor from first node to mouse; clear visual feedback
    - **Improved cursor feedback** — load placement tools show crosshair cursor; member lines show pointer only in SELECT mode
    - **Directional rubber-band selection (window vs crossing):**
      - **Left→Right drag (window):** solid blue box, selects only elements completely inside box (traditional CAD window)
      - **Right→Left drag (crossing):** dashed green box, selects any element the box touches or intersects (traditional CAD crossing)
    - **Node drag coordinate fix** — accurate positioning even when canvas has left offset (e.g., left panel open)

19. **Member Label Rotation (parallel to member line)**
    - **Labels now align with member angle** — text rotates to run parallel to the member it labels instead of always being horizontal
    - **Perpendicular offset** — labels stay offset "above" the member line regardless of angle (using SVG `dy` in rotated frame)
    - **Readability guard** — text never renders upside-down; automatic 180° flip for members at steep angles
    - **Improves visual hierarchy** — labels naturally follow member direction, matching CAD software convention

20. **Tension-Only Members (Cable / Rod / Sling)**
    - **Flag**: `tensionOnly?: boolean` on Member type; UI checkbox in MemberPanel
    - **Iterative solver** — if tension-only member has compression force (N < 0), remove it and re-solve until no more members compress (max 50 iterations)
    - **Slack handling** — removed members get zero forces in result (N=V=M=0) so UI doesn't break
    - **Canvas visual indicator** — tension-only members shown as dashed orange lines (#f97316) for easy identification
    - **Design check** — tension-only members: check only tensile axial stress (UR = T / φPn), skip bending/shear/compression checks
    - **Supports cable/sling/hanger rods/diagonal braces** in structures (e.g., cable-stayed, suspended bridges)

21. **Endpoint Reconnect (Member Drag)**
    - **CAD-style endpoint handles** — selecting a single member in SELECT mode shows two white/blue circle handles at each endpoint
    - **Drag to reconnect** — drag either handle to a different node to change `startNodeId`/`endNodeId` via `structure.updateMember()`
    - **Live snap** — nearest node within 20 screen px highlighted with blue ring; member reconnects on mouse-up
    - **Ghost line** — dashed blue line from fixed end to cursor during drag (same style as ADD_MEMBER preview)
    - **No-snap cancel** — releasing in empty space leaves member unchanged
    - **Full undo/redo** — changes captured by existing debounced watcher automatically
    - **Layer**: `#endpoint-layer` SVG group on top of all canvas layers; handled by `drawEndpointHandles()` in `StructureCanvas.vue`

22. **Multi-assign Steel Profiles (Bulk)**
    - When 2+ members are selected in Workspace, MemberPanel shows bulk-assign UI
    - Profile dropdown + "Apply to N Members" button applies same profile to all selected
    - "Remove Profile from All" clears `steelProfileId` for all selected members
    - "Delete N Members" batch-deletes selected members (cleans up loads too)

23. **Auto-size All (LRFD)**
    - "⚡ Auto-size All" button in DesignAssessmentPanel (shown only when FAIL/MARGINAL members exist)
    - Finds lightest steel profile (same class preferred) that achieves UR_combined < urFail for each failing member
    - Updates member section properties; re-run analysis to verify results
    - Count of changes shown in status message

25. **Combined Load Cases (LRFD)**
    - **Load categories** — every load tagged as Dead (D), Live (L), Wind (W), Seismic (E), or Snow (S)
    - **Load combinations** — 5 pre-defined AISC LRFD presets (Service 1.0D+1.0L, 1.4D, 1.2D+1.6L, 1.2D+1.0W+1.0L, 0.9D+1.0W) + user-defined custom combos
    - **Active combination** — user picks one combination; solver applies factors (`buildFactoredLoads`) before running FEM
    - **UI** — "Combo" tab in right panel (`LoadCombinationPanel.vue`); active combo name badge above Run button; case badge on each load in load list
    - **Analysis banner** — shows combination name used for current results
    - **Report** — Section 7: Load Combinations table; Section 8: Applied Loads with Case column
    - **Persistence** — custom combos + active selection saved to `structcalc_load_cases` localStorage key
    - **Backward compat** — existing loads without `loadCase` default to Dead (D)

24. **Live Section Modifier (Alternatives Table)**
    - Each row in DesignAssessmentPanel has a "▼" toggle button
    - Expands AlternativesRow sub-panel showing alternative profiles from same class (sorted by mass)
    - Shows UR_axial, UR_bending, UR_shear, UR_combined, status per alternative
    - "Apply" button swaps profile immediately (updates member section, no re-analysis needed)
    - Powered by `autoSize.ts`: `getAlternatives()` and `findOptimalProfile()`

---

## Data Contract

**Internal Units (always stored as):**

- Force: kN
- Length: m
- Stress: MPa
- Moments: kN·m

**Data Flow:**

1. **User Input** (canvas tools, panels) → convert via `fromLength()`, `fromForce()` → store in internal units
2. **Storage** (Pinia stores) → always kN/m/MPa
3. **Display** (tables, report, diagrams) → convert via `toLength()`, `toForce()`, `toStress()` using `settingsStore.unitLabel`

**Key Types** (in `src/types/`):

- `StructureNode`: { id, x, y, support, rollerAxis?, label }
- `Member`: { id, startNodeId, endNodeId, steelProfileId, E, A, I, isTruss, tensionOnly?, label? }
- `Load`: PointLoad | DistributedLoad | MomentLoad
- `SteelProfile`: { id, standard, profileClass, d, bf, tf, tw, A, Ix, Iy, Sx, E, Fy, ... }
- `SolverResult`: { success, nodeResults, reactions, memberResults }

**Settings Store State:**

```ts
{
  projectName, engineerName,
  forceUnit, lengthUnit, stressUnit,
  defaultE, defaultFy, defaultA, defaultI,
  deformedScale,
  snapshotDataUrl   // SVG data URL captured after analysis for report
}
```

**LocalStorage Keys:**

- `structcalc_session` — node/member/load snapshots + structure type
- `structcalc_settings` — unit choices, project info, defaults

---

26. **Envelope Analysis**
    - **"⊛ Envelope" button** in Workspace sidebar — runs FEM for all load combinations in one pass
    - **Force tracking per member:** max tension N, max compression N (tracked separately), max |V|, max |M| across all combos
    - **`performDesignCheckEnvelope()`** — runs per-combo design checks, returns worst-case UR_combined with governing combo name
    - **Design Assessment toggle:** "Active" / "Envelope" button group (shown only when envelope has been run)
    - **Governing combo badge** per member row when in Envelope mode — indigo badge shows which combination governed
    - **Auto-size All** works in envelope mode — uses envelope forces for `findOptimalProfile()`
    - **AlternativesRow** uses worst-case envelope forces when in envelope mode
    - Analysis page shows indigo banner with number of combinations analyzed

27. **Capacity Graphs**
    - **Table/Graph tabs** in each member's AlternativesRow
    - **D3 bar chart** plotting UR_combined vs alternative profiles, sorted by mass
    - **Color zones:** green (PASS < urMarginal), amber (MARGINAL), red (FAIL ≥ urFail)
    - **Threshold lines:** dashed lines at urMarginal and urFail thresholds
    - **Current profile highlighted** with indigo fill and border
    - Powered by existing `getAlternatives()` data — no extra network calls

---

## Gap Analysis

Known limitations and missing functionality compared to a full-featured structural analysis tool.

### Point Loads

| # | Gap | Detail |
|---|-----|--------|
| 1 | **Cartesian input only** | UI accepts Fx/Fy components — no polar input (magnitude + angle). Inclined loads require manual decomposition. |
| 2 | ~~**No load cases / combinations**~~ | ✅ **Resolved** — loads tagged D/L/W/E/S; solver applies AISC LRFD factors from active combination. |
| 3 | **Label only settable after creation** | `LoadPanel.vue` shows the label field only in edit mode (`v-if="editingLoadId"`). Must create first, then click to rename. |
| 4 | **Canvas shows resultant magnitude only** | Arrow label = `|F|` resultant. No visual breakdown of Fx/Fy components on canvas. |
| 5 | **Multiple loads on same node render as separate arrows** | Solver sums correctly, but canvas draws one arrow per load entry — visually cluttered when stacked. |
| 6 | **2D only (no Fz)** | `PointLoad` type has only `fx`, `fy`. No out-of-plane force component. |
| 7 | **No self-weight generation** | No auto-load from member section + material density. All loads must be entered manually. |

---

## Next Steps (Optional Enhancements)

1. ~~**Envelope analysis**~~ — ✅ Implemented (feature 26)
2. ~~**Capacity graphs**~~ — ✅ Implemented (feature 27)
3. **Envelope N/V/M diagrams** — plot min/max force diagram bands across all combinations (visual overlay on DiagramPanel)
4. **Self-weight generation** — auto-compute dead load from member length × profile mass/m × gravity

---

**To run locally:**

```bash
docker compose up              # Start dev server
npm run test:e2e              # Run e2e tests
npm run test:e2e:ui           # Visual test UI
```

See `CLAUDE.md` for detailed implementation notes, keyboard shortcuts, canvas architecture, session/undo design, and testing strategy.
