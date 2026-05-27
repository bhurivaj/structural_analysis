# Structural Analysis Web App — Spec

**Objective:** Quick reference to avoid losing context on long projects. Current state, architecture, data flow, and next steps only.

---

## Architecture

**Stack:**
- Frontend: Vue 3 + TypeScript + Vite
- State: Pinia (stores: structureStore, loadsStore, steelProfileStore, solverStore, settingsStore)
- Routing: Vue Router 4
- Styling: Tailwind CSS v4
- Canvas: Three.js r0.184 (WebGL renderer, OrthographicCamera/PerspectiveCamera, OrbitControls)
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

**✅ Completed (32/32 features):**

1. **Interactive Canvas Workspace (Three.js WebGL)**
   - Draw tools: SELECT, PAN, ADD_NODE, ADD_MEMBER, ADD_POINT_LOAD, ADD_DIST_LOAD, ADD_MOMENT
   - Pan/zoom: scroll wheel, middle-mouse drag, Space+drag temporary pan
   - Keyboard shortcuts (S, P, N, M, L, D, R, G=snap-toggle, Delete, Ctrl+Z/Y)
   - Undo/Redo with debounced snapshots (up to 50 entries)
   - Session persistence: auto-save to localStorage + resume dialog
   - **Three.js canvas (Phase 1 complete):** replaced D3/SVG with WebGL renderer
     - `SceneManager.ts` — dual cameras (OrthographicCamera 2D / PerspectiveCamera 3D), OrbitControls, resize loop
     - `StructureRenderer.ts` — nodes (Points), members (LineSegments), deformed shape (LineDashedMaterial), ep handles, ghost line, snap ring
     - `useThreeInteraction.ts` — Vue composable for all pointer/keyboard interactions; `pointerdown` capture to intercept OrbitControls
     - `threeHitTest.ts` — raycaster hit tests; `clientToWorld` (XY plane, 2D), `clientToWorldXZ` (horizontal XZ plane, 3D), node/member screen-space hit tests
     - **2D/3D camera toggle button** (top-right of canvas) — switches OrthographicCamera ↔ PerspectiveCamera with `SceneManager.setMode()`
   - **Grid snap toggle (G key)** — snap new nodes to integer world units; adaptive power-of-2 grid visible at all zoom levels
   - **Shift+drag node** — snap to nearest integer world unit
   - **Editable node labels** — auto-assigned N1, N2, … with inline editing
   - **Truss validation** — moment loads prevented on truss structures
   - **Ghost line preview** — dashed blue line follows cursor when drawing members or dragging endpoints
   - **Origin marker** — crosshair at world (0,0)
   - **Fit-to-view** — F key + button centers structure in view

2. **FEM Solver (3D — Phase 3 ✅) + 3D UI Bridge (Phase 4 ✅)**
   - **Always-3D** Frame + Truss analysis via matrix stiffness method (2D structures fall out naturally when z=0)
   - **Frame:** 6 DOF/node (ux, uy, uz, θx, θy, θz); **Truss:** 3 DOF/node (ux, uy, uz)
   - Full 3D Euler-Bernoulli beam element (12×12); 3D truss element (6×6); local axis via Gram-Schmidt
   - Approximate St-Venant torsion constant J from section geometry (CHS/RHS/open sections)
   - Calculates: displacements (ux/uy/uz/rx/ry/rz), reactions (6 components), member forces (N, Vy, Vz, My, Mz, T)
   - Backward-compat aliases: V=Vy, M=Mz for 2D diagram rendering
   - **Phase 4 UI:** Fz input in LoadPanel (3D mode); roller-Z option in NodePanel; Fz arrow in canvas
   - **Phase 4 Results:** displacement table (ux/uy/uz/rx/ry/θz), reactions table (Rx/Ry/Rz/Mx/My/Mz)
   - **Phase 4 Diagrams:** Vz / My / T diagram modes in DiagramPanel (visible only when 3D forces are non-zero)
   - **Phase 4 Deformed shape:** 3D deformed shape uses uz + node.z for Z offset in StructureRenderer

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
   - **455 Vitest unit tests** across 28 test files — added Phase 3 solver tests: geometry3D (14), elementStiffness3D (13), solver3D (16), updated boundaryConditions/loadVector/dof
   - **Total: ~587 E2E + unit tests passing** — comprehensive coverage of all features and edge cases

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

- `StructureNode`: { id, x, y, z?, support, rollerAxis?, label } — z optional (default 0); rollerAxis: 'x'|'y'|'z'
- `Member`: { id, startNodeId, endNodeId, steelProfileId, E, A, I, isTruss, tensionOnly?, label?, Iy?, Iz?, J? }
  - Iy = I about local y-axis (weak axis, lateral/XZ bending = profile.Iy)
  - Iz = I about local z-axis (strong axis, gravity/XY bending = profile.Ix)
  - J  = torsion constant (approximated from section geometry)
- `Load`: PointLoad | DistributedLoad | MomentLoad
  - `PointLoad`: { fx, fy, fz? } — fz added for out-of-plane force (no UI yet; Phase 4)
- `SteelProfile`: { id, standard, profileClass, d, bf, tf, tw, A, Ix, Iy, Sx, E, Fy, ... }
- `NodeResult`: { nodeId, ux, uy, uz, rx, ry, rz } — all in mm / rad
- `ReactionResult`: { nodeId, rx, ry, rz, mx, my, mz } — forces kN, moments kN·m
- `MemberResult`: { memberId, stations, N, V, M, Vy, Vz, My, Mz, T, endForces }
  - V=Vy and M=Mz as backward-compat aliases for 2D diagram rendering
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

28. **Self-weight Generation**
    - **"⚖ Self-weight" button** in Workspace sidebar — generates downward distributed Dead loads from assigned member profiles
    - **w = profile.mass × 9.81 / 1000 kN/m** (global_y direction, loadCase: 'D')
    - **`isSelfWeight: true` flag** on DistributedLoad type — distinguishes SW loads from user loads
    - **Idempotent:** removes existing SW loads before regenerating; user-added loads are untouched
    - Skips members without assigned steel profiles; returns count of loads created

29. **Envelope N/V/M Diagrams**
    - **`computeEnvelopeDiagrams()`** in `envelopeAnalysis.ts` — computes per-station min/max N/V/M arrays across all combos
    - **`MemberDiagramEnvelope`** type stores `{ memberId, stations, minN/maxN, minV/maxV, minM/maxM }` per member
    - **DiagramPanel Active/Envelope toggle** — visible when envelope has been run; switches between single-combo line and envelope band
    - **SVG band rendering:** filled indigo polygon between max and min curves + dashed min line for clarity
    - Shows "Envelope across N combos" label when in envelope mode

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
| 6 | ~~**No Fz UI input**~~ | ✅ **Resolved** — Fz input field in LoadPanel (Phase 4). Mx/My moment loads not yet supported in UI (niche). |
| 7 | **No self-weight generation** | No auto-load from member section + material density. All loads must be entered manually. |

---

## Next Steps (Optional Enhancements)

1. ~~**Envelope analysis**~~ — ✅ Implemented (feature 26)
2. ~~**Capacity graphs**~~ — ✅ Implemented (feature 27)
3. ~~**Envelope N/V/M diagrams**~~ — ✅ Implemented (feature 28)
4. ~~**Self-weight generation**~~ — ✅ Implemented (feature 29)
5. ~~**Icon refresh (Undo/Redo/Import)**~~ — ✅ Done
6. ~~**User Guide**~~ — ✅ Created `docs/USER_GUIDE.md`
7. ~~**In-app Help page**~~ — ✅ Done (`/help` route + `HelpView.vue`)
8. ~~**Three.js canvas Phase 1**~~ — ✅ Done (WebGL renderer, dual cameras, all interactions ported)
9. ~~**3D FEM solver (Phase 3)**~~ — ✅ Done (frame 6-DOF, truss 3-DOF, 12×12 element stiffness, local axis frame, approximate J, Vy/Vz/My/Mz/T member forces)
10. ~~**3D UI bridge (Phase 4)**~~ — ✅ Done (Fz input, roller-Z, 3D results tables, Vz/My/T diagrams, 3D deformed shape with uz)

### 3D Canvas Roadmap (In Progress)

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Three.js visual/interaction replacement (2D parity) | ✅ Done |
| **Phase 2** | 3D node placement, work plane Z, camera presets + axes gizmo | ✅ Done |
| **Phase 3** | 3D FEM solver — frame 6-DOF/node (ux,uy,uz,rx,ry,rz), truss 3-DOF/node | ✅ Done |
| **Phase 4** | 3D UI bridge — Fz input, roller-Z, 3D results tables, Vz/My/T diagrams, 3D deformed shape | ✅ Done |

**Phase 2 status (✅ Done):**
- ✅ `workplaneZ` shared state — `useCanvasMode.ts` (`workplaneZ` ref + `setWorkplaneZ`); all composable callers share the same module-level ref
- ✅ `structureStore.addNode` — always initializes `z: 0` by default; `loadSnapshot` backfills z for legacy sessions
- ✅ `useCanvasKeys.ts` (new composable) — keyboard handlers extracted from `useThreeInteraction.ts` (ESCAPE via `onEscape` callback); keeps interaction file under 300 lines
- ✅ Node placement at work plane Z — `ADD_NODE` in 3D mode projects onto horizontal XZ plane via `clientToWorldXZ(planeY=workplaneZ)`, snaps X+Z, stores `{ x, y: workplaneZ, z }`
- ✅ Node drag at node's own plane — `_nodeDrag` stores `{ planeVal, is3d, origX, origY, origZ, startWx, startW2 }`; in 3D drag updates X+Z (keeps Y/elevation constant); in 2D drag updates X+Y
- ✅ Grid at workplane Y elevation — `GridRenderer.update(sceneMan, workplaneZ)` places horizontal `GridHelper` (XZ plane, no rotation) via `helper.position.y = workplaneZ`; rebuilds when elevation changes
- ✅ Preset camera views — `SceneManager.setPresetView('top'|'front'|'side'|'iso')` with proper `camera.up` for gimbal-lock-safe top view
- ✅ Axes gizmo — `THREE.AxesHelper` added/removed via `SceneManager.setMode()` lifecycle (appears in 3D only)
- ✅ `WorkplaneControls.vue` (new component) — Z input (unit-converted via `settingsStore.toLength/fromLength`) + TOP/FRONT/SIDE/ISO preset buttons; renders only in 3D mode (`v-if="cameraMode === '3d'"`) at `absolute top-12 right-2`
- ✅ Tests: 408 unit tests (25 files) + 8 E2E tests in `workplane-3d.spec.ts`

**Phase 4 status (✅ Done):**
- ✅ `LoadPanel.vue` — Fz input field (shown in 3D camera mode); included in add/update/edit round-trip
- ✅ `NodePanel.vue` — roller-Z "Out-of-Plane (Z)" option added
- ✅ `LoadsRenderer.ts` — Fz arrow rendered in Three.js Z direction
- ✅ `DisplacementTable.vue` — uz, rx, ry, θz columns (was: ux, uy, θz only)
- ✅ `ReactionTable.vue` — Rz, Mx, My, Mz columns (was: Rx, Ry, Mz only)
- ✅ `DiagramPanel.vue` — Vz / My / T diagram modes; violet buttons; hidden for pure-2D structures
- ✅ `ReportResultsSections.vue` — reactions and displacements sections mirrored with full 3D columns
- ✅ `StructureCanvas.vue` + `StructureRenderer.ts` — deformed shape uses `uz + node.z` for Z offset (was hardcoded 0.01)

**Phase 3 status (✅ Done):**
- ✅ Types: `Member` + Iy/Iz/J; `StructureNode.rollerAxis` + 'z'; `NodeResult` + uz/rx/ry; `ReactionResult` + rz/mx/my; `MemberResult` + Vy/Vz/My/Mz/T; `PointLoad` + fz
- ✅ DOF: `DOF_PER_NODE` { frame: 6, truss: 3 }; `buildDofMap`/`totalDof` unchanged (already generic)
- ✅ `geometry3D.ts` — `memberLength3D`, `memberDirectionCosines`, `localAxisFrame` (Gram-Schmidt, ey≈globalY for horizontal members), `transformationMatrix12x12`
- ✅ `elementStiffness3D.ts` — `frameElement3D` (12×12 global), `trussElement3D` (6×6 global)
- ✅ `approximateJ.ts` — approximate J for CHS/RHS/open sections from section geometry
- ✅ `assembler.ts` — uses 3D element functions; Iz=strong axis, Iy=weak axis fallbacks
- ✅ `loadVector.ts` — fz→DOF[2]; mz→DOF[5]; dist load DOF index shift for 6-DOF frames
- ✅ `boundaryConditions.ts` — fixed(6DOF)/pinned(0-2)/roller(x/y/z) for frame; fixed(0-2)/pinned(0-2) for truss
- ✅ `postProcessor.ts` — uz/rx/ry extraction; 6-component reactions; N/Vy/Vz/My/Mz/T per member; V=Vy/M=Mz aliases
- ✅ `utils/memberProps.ts` — `memberPropsFromProfile()` central mapping with correct Iz=profile.Ix, Iy=profile.Iy
- ✅ Tests: geometry3D.test.ts (14), elementStiffness3D.test.ts (13), solver3D.test.ts (16); updated dof/loadVector/boundaryConditions tests
- ✅ Backward compat: all z=0 structures produce identical N/V/M results; uz/rx/ry = 0; V=Vy alias correct

**Phase 1d status:**
- ✅ Grid rendering — `GridRenderer.ts` adaptive power-of-2 grid in 2D + `THREE.GridHelper` (XY plane) in 3D + amber origin marker; runs every frame via `SceneManager.addFrameCallback()`
- ✅ Snap to grid — G key wired to `toggleSnap()` in `useThreeInteraction.ts`
- ✅ Node Z input — `z?: number` in `StructureNode`; Z field shown in `NodePanel` when 3D mode; `StructureRenderer` uses `n.z ?? 0`; shared state via `useCanvasMode.ts`
- ✅ Load arrows (Three.js) — `LoadsRenderer.ts`: point loads (Fx/Fy arrows), distributed loads (multi-arrow along member), moment loads (arc ring); wired into `StructureCanvas.vue` via `loadsStore` watch
- ✅ Support symbols (Three.js) — `SupportRenderer.ts`: batched `LineSegments` geometry; pinned triangle, fixed bar+hatch, roller triangle+wheels (rollerAxis 'x'/'y'); wired into `StructureCanvas.vue`
- ✅ Node/Member labels — HTML overlay in `StructureCanvas.vue`: per-frame `updateLabels()` via `addFrameCallback`; projects node/member-midpoint to screen pixels; renders as `<span>` with `pointer-events: none`; node labels = N1/N2/… (slate-500), member labels = M1/M2/… (slate-400)

---

**To run locally:**

```bash
docker compose up              # Start dev server
npm run test:e2e              # Run e2e tests
npm run test:e2e:ui           # Visual test UI
```

See `CLAUDE.md` for detailed implementation notes, keyboard shortcuts, canvas architecture, session/undo design, and testing strategy.
