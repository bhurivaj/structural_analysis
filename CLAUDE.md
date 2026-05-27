# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A web app for structural engineers to perform structural analysis and generate calculation reports.

## Stack

| Layer        | Technology   |
| ------------ | ------------ |
| Language     | TypeScript   |
| Build        | Vite         |
| UI Framework | Vue 3        |
| State        | Pinia        |
| Routing      | Vue Router   |
| Styling      | Tailwind CSS |
| 3D Canvas    | Three.js     |
| Charts/Viz   | D3.js        |
| Unit Testing | Vitest       |
| E2E Testing  | Playwright   |

## Infrastructure

Docker Compose manages the local dev environment. The app source lives in `./app/`.

```bash
docker compose up          # Start dev server (http://localhost:5173)
docker compose up --build  # Rebuild image then start
docker compose down        # Stop and remove containers
```

## Development Commands

```bash
npm install           # Install dependencies
npm run dev           # Start dev server
npm run build         # Production build
npm run test          # Run all Vitest unit tests
npm run test:unit     # Run single file: npx vitest run <path>
npm run lint          # Lint
npm run test:e2e      # Playwright e2e tests (headless)
npm run test:e2e:ui   # Visual browser UI for tests
npm run test:e2e:debug # Debug mode
```

## Project Structure

```tree
src/
├── types/              ← TypeScript interfaces (structure, loads, solver results)
├── stores/             ← Pinia state management
├── solver/             ← FEM engine (matrix stiffness method, iterative for tension-only)
├── components/         ← Vue components (canvas, panels, UI)
├── views/              ← 4 pages: Workspace, SteelProfiles, Analysis, Report
├── composables/        ← Reusable logic (undo/redo, viewport, session cache)
└── data/               ← TIS steel profiles (374 total)
```

## Internal Units (always stored as)

- **Force:** kN
- **Length:** m
- **Stress:** MPa
- **Moments:** kN·m

Data flows: User Input → `from*()` → Store (internal units) → Display `to*()` → User sees selected units

---

## Key Documentation

See `./docs/` for detailed guides:

1. **[CANVAS_ARCHITECTURE.md](docs/CANVAS_ARCHITECTURE.md)** — Three.js WebGL canvas, SceneManager, renderers, interaction composables, keyboard shortcuts
2. **[FEATURES.md](docs/FEATURES.md)** — All feature implementations (node labels, deformed shape, multi-select, tension-only, etc.)
3. **[DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)** — LRFD design assessment, utilization ratios, AISC 360
4. **[UNIT_SYSTEM.md](docs/UNIT_SYSTEM.md)** — Settings store, unit conversion, data contract
5. **[TESTING.md](docs/TESTING.md)** — E2E/unit test strategy, test coverage requirements

---

## Rules

### Before any task

1. Read `./docs/SPEC.md` first (Architecture, Current State, Data Contract, Gap Analysis, Next Steps).
2. **For ANY bug fix or new feature: Design test case FIRST** before implementation.
   - Identify what you're testing (solver logic, UI interaction, integration, etc.)
   - List expected outcomes
   - Plan test file location and structure

### File Size Limit

- **If any source file exceeds 300 lines, split it into a new file.**
  - Extract logical sections (e.g., a group of related functions, a composable, a sub-component) into a separate file
  - Update all import paths accordingly
  - This applies to `.ts`, `.vue`, `.spec.ts`, `.test.ts`, and `.md` files alike

### After completing any task

**Test Cases (MANDATORY — ALWAYS KEEP):**
1. **Write test cases** (Vitest for logic, Playwright for E2E) covering:
   - Happy path (normal usage)
   - Edge cases (boundary conditions, unusual inputs)
   - Error cases (invalid states, failures)
   - Integration (feature works with rest of system)
2. **Check in test files** to git — test cases are living documentation
   - Unit tests: `src/**/__tests__/*.test.ts`
   - E2E tests: `tests/e2e/*.spec.ts`
3. **Run all tests** (`npm run test`, `npm run test:e2e`) — must pass before done
4. **Test coverage goal:** Minimum 80% of new code paths exercised

**Documentation (ALWAYS UPDATE):**
1. Update relevant `./docs/*.md` file with implementation details
   - Include test case scenarios and architectural decisions
2. Update `./docs/SPEC.md` — use this checklist every time, no exceptions:
   - [ ] Feature count incremented? (any new file, composable, or capability counts)
   - [ ] Feature list entry added/updated? (even sub-tasks like Phase 1d items)
   - [ ] Data Contract updated? (any `interface` or `type` change → update the types list)
   - [ ] "Next Steps" / roadmap updated? (mark done ✅, update pending 🔲)
   - [ ] New composables / renderers / stores listed under Architecture?
3. **Never claim "done" without:**
   - All tests passing ✅
   - Test files committed ✅
   - All SPEC.md checklist items above completed ✅

---

## Recent Work (May 2026)

**Phase 1 — Three.js Canvas (replaces D3/SVG):**
- Canvas fully rebuilt to Three.js WebGL: `SceneManager`, dual cameras (2D ortho / 3D perspective), `OrbitControls`
- Renderers: `StructureRenderer` (nodes/members/deformed), `GridRenderer` (adaptive world-unit grid), `LoadsRenderer` (ArrowHelper), `SupportRenderer`
- `useThreeInteraction` composable: raycasting hit-test, rubber-band selection (window vs. crossing), node drag, endpoint reconnect
- `useCanvasMode` composable: camera mode state (`'2d'` / `'3d'`), workplane Z
- `WorkplaneControls.vue`: preset views (Top/Front/Side/Iso), workplane Z input
- Node/member labels: HTML overlay via `updateLabels()` frame callback (not SVG text)
- Snapshot: `renderer.domElement.toDataURL()` (WebGL canvas, not SVG serialize)

**Phase 3 — Full 3D FEM Solver:**
- Frame: 6-DOF/node (ux, uy, uz, θx, θy, θz); Truss: 3-DOF/node (ux, uy, uz)
- 12×12 local frame stiffness + 6×6 local truss stiffness
- Gram-Schmidt local axis: `ey ≈ global Y` (gravity direction) for horizontal members → V=Vy, M=Mz backward-compat aliases correct
- `memberProps.ts`: Iz = strong axis = profile.Ix (XY/gravity bending); Iy = weak axis = profile.Iy (XZ/lateral bending)
- `approximateJ.ts`: torsion constant J from section geometry (CHS/RHS/open)
- New result fields: `uz`, `rx`, `ry` (NodeResult); `Vz[]`, `My[]`, `T[]` (MemberResult)

**Phase 4 — 3D UI Bridge:**
- `LoadPanel.vue`: Fz input field (visible in 3D camera mode only)
- `NodePanel.vue`: Roller-Z (out-of-plane) support option
- `LoadsRenderer.ts`: Fz arrow (Z-direction ArrowHelper)
- `DisplacementTable.vue`: uz, rx, ry columns
- `ReactionTable.vue`: Rz, Mx, My columns
- `DiagramPanel.vue`: Vz / My / T diagram modes (shown only when `has3dForces`)
- `ReportResultsSections.vue`: mirrored 3D columns in print report
- `StructureRenderer.ts`: deformed shape uses actual `uz + node.z` for Z position

**Envelope Analysis & Capacity Graphs:**
- "⊛ Envelope" runs all LRFD combinations, finds worst-case demands per member
- `performDesignCheckEnvelope()` returns worst UR_combined + governing combo name
- DesignAssessmentPanel has Active/Envelope toggle; D3 bar chart capacity graph

**Vue template pattern:** `!` non-null assertion is invalid in Vue templates — wrap in a `requireX()` script function that uses `!` and call that in the template instead

**Testing:** 132 E2E tests + 323 unit tests (455 total)

---

## Communication Style

- **Answers:** Short, tight, to the point — no fluff, no rambling
- **No over-engineering:** Solve the actual problem, not hypothetical ones
- **Token economy:** Save tokens by being concise; focused answers beat detailed ones
- **Explanations:** Only when necessary; trust you can read code and understand context

---

## Quick Reference

### Keyboard Shortcuts

| Key                        | Action                      |
| -------------------------- | --------------------------- |
| S / P / N / M / L / D / R  | SELECT / PAN / NODE / MEMBER / POINT_LOAD / DIST_LOAD / MOMENT |
| Delete / Backspace         | Delete selected             |
| Escape                     | Cancel pending member start |
| Space (hold)               | Temporary pan mode          |
| Ctrl/Cmd+Z                 | Undo                        |
| Ctrl/Cmd+Shift+Z or Ctrl+Y | Redo                        |

### Canvas Tools

- **SELECT (S):** Click/drag to select; rubber-band window (left→right) or crossing (right→left)
  - **Endpoint reconnect:** When 1 member is selected, drag the white circle handles at each endpoint to reconnect to a different node; snap highlight appears within 20px radius
- **PAN (P):** Left-drag to pan; always use scroll wheel or middle-mouse in any mode
- **ADD_NODE (N):** Click canvas to place nodes; snaps to world-unit grid if enabled (G toggles snap)
- **ADD_MEMBER (M):** Click two nodes to create member; see ghost line preview
- **ADD_POINT_LOAD (L):** Click node to add load; form pre-fills on click; Fz field visible in 3D camera mode
- **ADD_DIST_LOAD (D):** Click member to add distributed load; invisible rect for easy selection
- **ADD_MOMENT (R):** Click node to add moment; blocked on truss structures

### Core Stores

- **structureStore** — nodes, members, structure type, selections (`selectedNodeIds`, `selectedMemberIds`)
- **loadsStore** — point, distributed, moment loads per type with auto-labels
- **steelProfileStore** — 374 TIS profiles, selected profile per member
- **solverStore** — analysis results, deformed shape toggle, success flag
- **settingsStore** — units (force, length, stress), project info, defaults, deformed scale

### Multi-select Behavior

- **2+ items selected:** `WorkspaceView.multiSelectActive` intercepts the right panel **only when the selection includes nodes** (or is mixed). Member-only multi-select lets `MemberPanel` handle it with its bulk-assign UI.
- **Member-only multi-select:** MemberPanel shows bulk profile dropdown + "Apply to N Members" / "Remove Profile from All" / "Delete N Members" buttons.
- **`multiSelectActive` condition:** `nodeCount + memberCount > 1 && !(nodeCount === 0 && memberCount > 1)`

### FEM Solver

- **3D frame:** 6-DOF/node (ux, uy, uz, θx, θy, θz); 12×12 local stiffness, transformed via direction cosines
- **3D truss:** 3-DOF/node (ux, uy, uz); 6×6 local stiffness
- **Local axis:** Gram-Schmidt convention — `ey ≈ global Y` (gravity) for horizontal members; backward-compat: V=Vy, M=Mz
- **Section props:** `Iz` = strong axis (gravity/XY bending) = `profile.Ix`; `Iy` = weak axis = `profile.Iy`; `J` from `approximateJ.ts`
- **Iterative for tension-only:** Removes compressive cables, re-solves until converged (max 50 iterations)
- **Slack handling:** Removed members get zero forces in result
- **Supports:** pin (3 DOF fixed), fixed (6 DOF fixed), roller-X/Y/Z (5 DOF fixed)
- **Matrix method:** Assemble K (stiffness), F (force), apply BC, solve Kd = F, compute reactions and member forces

### Steel Profile Data Caveat

TIS profile data (`src/data/`) stores `ry: 0` for **all 374 profiles** — it is not pre-computed in the source Excel. Always derive radius of gyration from section properties:

```ts
ry = profile.Iy > 0 ? Math.sqrt(profile.Iy / profile.A) : 0
```

Both `designCheck.ts` and `autoSize.ts` must use this formula for consistent UR values. Using `profile.ry` directly will produce ry = 0, which silently skips the column buckling check.

### Session & Persistence

- **Auto-save:** 800ms after changes → localStorage `structcalc_session` (watcher in `WorkspaceView` only)
- **Resume dialog:** Only shown on fresh start (`structure.nodes.length === 0`); skipped when navigating back to Workspace
- **Undo/Redo:** 300ms debounced snapshots, 50-entry stack
- **JSON Import/Export:** ⬆⬇ button in navbar → modal with paste or file upload
- **Profile changes outside Workspace:** `DesignAssessmentPanel.applyProfile()` and `autoSizeAll()` call `cache.saveSession()` explicitly — the WorkspaceView auto-save watcher doesn't run when on Analysis page
