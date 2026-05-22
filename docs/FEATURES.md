# Features Implementation Guide

Detailed documentation of all feature implementations: nodes, members, loads, deformed shapes, selections, and tension-only members.

## Session Persistence & Undo/Redo

### Session Persistence

Auto-saved to localStorage (`structcalc_session`) 800ms after changes.
On page reload, resume dialog offers:

- **Continue** — restore nodes, members, structure type, loads
- **Start New** — clear and start fresh

Composable: `src/composables/useSessionCache.ts`

### Undo/Redo

Implemented in `src/composables/useUndoRedo.ts` as module-level singleton:

- 300ms debounced snapshots (rapid changes collapse into one entry)
- 50-entry past stack; oldest dropped on overflow
- Future stack populated on undo; cleared on new change
- `_isRestoring` flag with `nextTick()` prevents spurious snapshots
- Snapshots: nodes, members, structureType, loads (JSON deep clone)

## JSON Import/Export

### Components and Files

**UI:**
- `src/components/ui/ImportModal.vue` — modal with two tabs (Paste JSON | Upload File)
- ⬆⬇ button in `AppNavbar.vue` toggles modal visibility

**Schema:**
Uses `SessionSnapshot` from `src/composables/useSessionCache.ts`:

```ts
{
  structureType: 'frame' | 'truss',
  nodes: StructureNode[],
  members: Member[],
  loads: Load[],
  savedAt?: string  // ISO timestamp (informational only)
}
```

**Import Flow:**
1. User pastes JSON or selects .json file
2. Validate: check required fields (nodes, members, loads, structureType)
3. Show confirmation dialog with data summary
4. On confirm: call `structure.loadSnapshot()` + `loads.loadSnapshot()`
5. Clear solver result, modal closes
6. Undo/redo watcher auto-captures snapshot; session auto-save triggers

**Export Flow:**
1. Collect current `structure.nodes`, `structure.members`, `loads.loads`, `structure.structureType`
2. Wrap in `SessionSnapshot` with current timestamp
3. Download as JSON file: `structure-{timestamp}.json`

## Editable Node Labels

### Architecture

Nodes have auto-assigned labels (N1, N2, …) that engineers may want to customize.

**In `StructureNode` type (`src/types/structure.ts`):**
- `label: string` field (stored with each node, initialized as `N${nodes.length + 1}`)

**In `structureStore.ts`:**
- `updateNode(id, data)` already supports partial updates including label

**In `NodePanel.vue` (right sidebar):**
- Text input field binds to `selectedNode.value?.label`
- On blur or Enter: calls `structure.updateNode(nodeId, { label: newValue })`
- Input validates: non-empty, max 20 chars
- Changes persist to sessionStorage via auto-save watcher

**In `StructureCanvas.vue`:**
- Labels render at node position when selected (via #node-labels SVG text)
- Positioned offset below node circle to avoid overlap
- Font size 12px, color #334155 (slate-700)

### Verification

1. Add node → auto-labeled N1 ✅
2. Select node → label appears in NodePanel input ✅
3. Edit label → press Enter → canvas updates ✅
4. Reload page → label persists ✅
5. Undo/redo → label reverts/restores ✅

## Grid Snap Toggle & Truss Validation

### Grid Snap Toggle

Implemented in `StructureCanvas.vue` as `gridSnap` ref (default true):

- Toggle button in toolbar labeled "⊞ Snap"
- When active, new nodes snap to 80px grid (matches grid visual)
- Snap logic: `Math.round(coord / 80) * 80`
- State persisted to sessionStorage

### Truss Validation

Trusses are pin-jointed structures and cannot resist moment loads.

**In `loadsStore.ts`:**
- `addMomentLoad()` checks `structure.structureType === 'truss'` and returns null if true
- User cannot add moment loads to truss structures via UI

**In `structureStore.ts`:**
- `setStructureType(type)` when switching to truss:
  - Calls `loadsStore.removeMomentLoads()`
  - Returns count of removed loads
  - Displays amber warning toast: "Switched to Truss — X moment load(s) removed"

**UX:** Toast auto-hides after 4 seconds; clear visual feedback without blocking workflow.

## Deformed Shape Visualization

### Architecture

Analysis results include displacements (ux, uy per node). Deformed shape overlays member positions after applying amplified displacements.

**In `solverStore.ts`:**
- `showDeformed` ref (boolean) — toggles deformed overlay
- `deformedScale` ref (0–500%, default 100) — in `settingsStore`
- `toggleDeformed()` — button click handler

**In `StructureCanvas.vue`:**
- `#deformed-layer` SVG group (added in onMounted after member-layer)
- `drawDeformed(g)` function:
  - Loops members; finds start/end nodes in result
  - Calculates deformed positions: `x' = x + ux×scale`, `y' = -(y + uy×scale)`
  - Renders as dashed blue lines with opacity 0.8
  - Line width scales with viewport zoom: `strokeWidth = 2 / k`
  - Stroke-dasharray: `5/k, 3/k` (consistent dashing at all zoom levels)
- Called in `drawAll()` after `drawMembers()`
- Watch includes `solver.showDeformed` → redraw on toggle

**In `WorkspaceView.vue`:**
- DEF button in diagram overlay (only shows when analysis successful)
- Positioned bottom-right with separator line and toggle styling

### Verification

1. Run analysis → DEF button appears ✅
2. Click DEF → deformed members render over structure ✅
3. Adjust deformedScale slider → deformation amplification changes in real-time ✅
4. Pan/zoom → deformed lines follow, dashing stays consistent ✅
5. Clear result → DEF button disappears, showDeformed resets to false ✅

## Multi-select & Batch Delete with Load Cascade

### Architecture

Multi-select was already fully implemented (rubber-band selection, Shift+click toggle, "Delete Selected" button). Phase 3 fixed the core issue: **deleting nodes or members left orphaned loads** (point_load, moment on nodes; distributed_load on members).

**Solution:** Added cascade cleanup helpers in `loadsStore.ts` and integrated them into `structureStore.ts` delete operations.

### Files Modified

**1. `src/stores/loadsStore.ts`**
- Added `removeLoadsForNode(nodeId: string)` — removes point_load and moment loads attached to a node
- Added `removeLoadsForMember(memberId: string)` — removes distributed_load attached to a member

**2. `src/stores/structureStore.ts`**
- `deleteNode(id)` — before removing members, collect their IDs; after cascading member deletion, call both cleanup helpers
- `deleteMember(id)` — after removing member, call cleanup helper

### Verification

1. Add node with point load → delete node → orphan removed ✅
2. Add member with distributed load → delete member → orphan removed ✅
3. Multi-select 3 nodes + loads → Delete Selected button → all nodes + members + loads removed ✅
4. Undo restores full structure + loads (no stale data) ✅

## Auto-switch Tab on SELECT Click

Clicking any canvas element in SELECT mode now automatically opens the matching editing panel tab.

### Implementation

**Signal Flow:** No new state added — uses existing Pinia selection state and `useCanvasTool` composable state.

```
Click node → structure.selectNode() → selectedNodeIds changes → WorkspaceView watch → rightTab = 'node'
Click member → structure.selectMember() → selectedMemberIds changes → WorkspaceView watch → rightTab = 'member'
Click load → setEditingLoad(id) → editingLoadId changes → WorkspaceView watch → rightTab = 'load'
                                                        → LoadPanel watch → form auto-fills
```

### Files Modified

**1. `src/views/WorkspaceView.vue`**
- Destructured `editingLoadId` from `useCanvasTool()`
- Added three watches for selectedNodeIds, selectedMemberIds, editingLoadId

**2. `src/components/canvas/StructureCanvas.vue`**
- Destructured `setEditingLoad` from `useCanvasTool()`
- In `drawForces()`, wrapped each load type in a `<g>` group with click handlers
- Cursor changes to `pointer` in SELECT mode, `default` in other modes

### Verification

1. SELECT mode → click node → Node tab ✅
2. SELECT mode → click member → Member tab ✅
3. SELECT mode → click load arrow → Load tab + edit form pre-filled ✅
4. Non-SELECT modes → click load → no action (tool modes unchanged) ✅

## Bug Fix: Distributed Load Click Interaction

### Issue

Distributed load arrows were not clickable in SELECT mode despite having click handlers. The click area was too small (5 thin 1.5px stroke arrows).

### Solution

Added invisible SVG `<rect>` element wrapping the distributed load arrows:

```ts
loadGroup.append('rect')
  .attr('x', Math.min(n1.x, n2.x) - 15 / scale)
  .attr('y', Math.min(-n1.y, -n2.y) - arrowLen - 15 / scale)
  .attr('width', distLen + 30 / scale)
  .attr('height', arrowLen + 30 / scale)
  .attr('fill', 'none')
  .attr('pointer-events', 'all')
```

The rect:
- Has `fill: none` (invisible, no visual impact)
- Has `pointer-events: all` (captures clicks even when invisible)
- Spans member length + 30px padding on all sides for comfortable clicking
- Positioned behind arrow lines (SVG render order: rect first, then lines)

### Verification

1. SELECT mode → distributed load click → Load tab opens ✅
2. Form pre-fills with load values ✅
3. "Update Load" button available for editing ✅

## Friendly Member & Load Labels

### Context

Nodes had auto-labels (N1, N2, ...) and were editable via NodePanel, but members and loads displayed as raw UUID slices (e.g., `PL @ a3f2`), which was non-intuitive.

### Implementation

**1. `src/stores/structureStore.ts` — Member auto-label**

```ts
function addMember(data: Omit<Member, 'id'>): Member {
  const member: Member = { id: generateId(), label: `M${members.value.length + 1}`, ...data }
```

Pattern matches `addNode()` — sequential labels M1, M2, ... with override via data spread.

**2. `src/stores/loadsStore.ts` — Load auto-label (per-type)**

```ts
// addPointLoad: label = `PL${pointLoads.length + 1}`
// addDistributedLoad: label = `DL${distLoads.length + 1}`
// addMomentLoad: label = `ML${momentLoads.length + 1}`
```

Each type has its own counter — PL1/PL2, DL1/DL2, ML1/ML2 (no collisions).

**3. `src/components/panels/MemberPanel.vue` — Editable label**

Inserted before Steel Profile dropdown. Calls existing `update()` → `structure.updateMember()`.

**4. `src/components/panels/LoadPanel.vue` — Edit + display**

- Label input field in edit mode (only when `editingLoadId` is set)
- Load list displays `load.label` with fallback to old format

### Verification

1. Add member → auto-label M1 ✅
2. Select member → label input in MemberPanel shows M1 ✅
3. Add point load → auto-label PL1 ✅
4. Report → load column shows label ✅

## Canvas Member Label Display

### Architecture

Member labels now display on the canvas at the midpoint of each member line, showing the member label and assigned steel profile designation (e.g., "M1 / H 150×75").

**File Modified:** `src/components/canvas/StructureCanvas.vue` only

### Implementation

**1. Helper Function**

```ts
function shortDesignation(des: string): string {
  const parts = des.split('×')
  return parts.length > 2 ? parts.slice(0, 2).join('×') : des
}
```

Shortens steel profile designation from "H 150×75×7×5" to "H 150×75" (first 2 parts only).

**2. Member Label Rendering (in drawMembers())**

- D3 `.selectAll('text.member-label')` with data binding to members
- Position: midpoint of member (x, y calculated from start/end nodes)
- Offset: `-8/viewport.value.k` upward (perpendicular to member line)
- Font size: `10/viewport.value.k` (scales inversely with zoom)
- Color: `#2563eb` (blue) when selected, `#64748b` (slate-500) when not
- Label format: `${label}` if no profile, or `${label} / ${shortDesignation(profile)}` if profile assigned

### Verification

1. Add member → canvas shows "M1" at midpoint ✅
2. Assign profile → canvas shows "M1 / H 150×75" ✅
3. Select member → label color changes to blue ✅
4. Zoom in/out → label size stays constant on screen ✅

## Member Label Rotation (parallel to member line)

### Overview

Member labels are now rotated to align with their member's angle instead of always rendering horizontally. Labels remain readable (never upside-down) and maintain proper perpendicular offset using SVG rotation transforms.

### Implementation (SVG transform-based)

```ts
.attr('transform', d => {
  const n1 = structure.nodeById(d.startNodeId)
  const n2 = structure.nodeById(d.endNodeId)
  const x1 = n1?.x ?? 0, y1 = -(n1?.y ?? 0)
  const x2 = n2?.x ?? 0, y2 = -(n2?.y ?? 0)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  let angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
  // Flip if text would be upside down
  if (angle > 90 || angle < -90) angle += 180
  return `translate(${mx},${my}) rotate(${angle})`
})
.attr('x', 0)
.attr('y', 0)
.attr('dy', -8 / viewport.value.k)  // perpendicular offset in rotated frame
```

**Why this works:**
1. `translate(mx, my)` — moves SVG origin to member midpoint
2. `rotate(angle)` — aligns coordinate system with member direction
3. `dy = -8/k` — in the rotated frame, negative dy shifts "above" the member

### Visual Result

- **Horizontal members**: labels stay horizontal (0° rotation)
- **Vertical members**: labels rotate 90°, still readable
- **Diagonal members**: labels follow member slope
- **All members**: consistent "above" offset perpendicular to line

## Tension-Only Members (Cable / Rod / Sling)

### Architecture

Adds support for **tension-only members** (cables, slingsสลิง, hanger rods, diagonal braces) that can resist tension but not compression. Uses **iterative solver** to handle slack members: if a tension-only member experiences compression, it's removed from the model and re-solved until convergence.

**Files Modified:** 5 files
1. `src/types/structure.ts` — Added `tensionOnly?: boolean` to Member interface
2. `src/solver/index.ts` — Iterative analysis loop (max 50 iterations)
3. `src/utils/designCheck.ts` — Skip compression/bending/shear checks for tension-only
4. `src/components/panels/MemberPanel.vue` — Checkbox UI
5. `src/components/canvas/StructureCanvas.vue` — Visual indicator (dashed orange line)

### Implementation

**1. Member Type (`src/types/structure.ts`)**

```ts
export interface Member {
  id: string
  startNodeId: string
  endNodeId: string
  steelProfileId: string | null
  E: number
  A: number
  I: number
  isTruss: boolean
  tensionOnly?: boolean    // ← new field
  label?: string
}
```

**2. Iterative Solver (`src/solver/index.ts`)**

Algorithm:
- **Iteration loop** (max 50): Filter active members (exclude removed ones)
- **Assemble & solve** K, F for active members → compute displacements
- **Check each tension-only member**: if N[0] < 0 (compression) → mark as removed
- **Convergence check**: if no new removals → DONE; else → next iteration
- **Result construction**: Active members + zero results for removed members (prevents UI crash)

**3. Design Check (`src/utils/designCheck.ts`)**

Tension-only members skip compression buckling, bending, and shear checks. Only compute tensile axial:

```ts
if (isTensionOnly) {
  const phi_t = 0.9
  const phi_Pn = phi_t * Fy * A
  UR_axial = (maxAbsN * 1000) / phi_Pn
  UR_bending = 0
  UR_shear = 0
  UR_combined = UR_axial
}
```

**4. UI Checkbox (`src/components/panels/MemberPanel.vue`)**

Checkbox toggles `tensionOnly` flag + warning message in Thai.

**5. Canvas Rendering (`src/components/canvas/StructureCanvas.vue`)**

Tension-only members render as dashed orange lines:

```ts
.attr('stroke', d => {
  if (structure.selectedMemberIds.includes(d.id)) return '#2563eb'
  if (d.tensionOnly) return '#f97316'  // orange for cable
  return '#475569'
})
.attr('stroke-dasharray', d => {
  if (d.tensionOnly) return `${6 / viewport.value.k},${4 / viewport.value.k}`
  return null as any
})
```

### Slack Member Handling

Members removed from solver get zero forces in the result:

```ts
const zeroResult = (m: Member) => ({
  memberId: m.id,
  stations: [0, 0.5, 1],
  N: [0, 0, 0],
  V: [0, 0, 0],
  M: [0, 0, 0],
  endForces: [0, 0, 0, 0, 0, 0],
})
```

This ensures:
- UI doesn't crash on missing member results
- Reports show slack members with no forces
- Design check shows PASS (UR_axial = 0)

### Verification

1. Add member, check tension-only → canvas shows dashed orange line ✅
2. Uncheck tension-only → canvas reverts to grey solid line ✅
3. Run analysis with tension-only member in tension (N > 0) → member stays in result ✅
4. Run analysis with tension-only member in compression (N < 0 initially) → member removed, re-solve until converged ✅
5. Design check → tension-only members show UR_axial only, UR_bending = UR_shear = 0 ✅
6. JSON import/export → `tensionOnly` field persists ✅
7. Undo/redo → `tensionOnly` flag reverts properly ✅

## Endpoint Reconnect (Member Drag)

### Architecture

Allows engineers to change which nodes a member connects to by dragging endpoint handles directly on canvas — CAD-style reconnect without deleting and redrawing.

**File Modified:** `src/components/canvas/StructureCanvas.vue` only

### Implementation

**1. Drag State (`endpointDrag` ref)**

```ts
const endpointDrag = ref<{
  memberId: string
  which: 'start' | 'end'
  fixedX: number     // SVG coords of the non-dragged endpoint
  fixedY: number
  mouseX: number     // current drag cursor in world/SVG space
  mouseY: number
  fixedNodeId: string
  snapNodeId: string | null  // nearest node within snap radius
} | null>(null)
```

**2. Computed single-member selection**

```ts
const singleSelectedMember = computed(() => {
  if (structure.selectedMemberIds.length !== 1) return null
  return structure.members.find(m => m.id === structure.selectedMemberIds[0]) ?? null
})
```

Handles only render when exactly 1 member is selected.

**3. SVG Layer**

New `#endpoint-layer` appended after `#support-layer` in onMounted — renders on top of all other layers.

**4. `drawEndpointHandles(g)` — called in `drawAll()`**

Three elements rendered:
- **`circle.ep-handle`** — white circle with blue stroke at each endpoint; `cursor: grab`; has D3 drag behavior attached
- **`line.ep-ghost`** — dashed blue line from fixed end to cursor during drag
- **`circle.ep-snap`** — semi-transparent blue highlight on nearest snappable node during drag

**5. D3 drag behavior (`createEndpointDragBehavior()`)**

- `start`: capture which end is being dragged, record fixed endpoint coords
- `drag`: convert `event.sourceEvent.clientX/Y` → world coords; find nearest node within 20px screen radius; update `endpointDrag`, call `drawAll()`
- `end`: if `snapNodeId` is set → `structure.updateMember(id, { startNodeId/endNodeId: snapNodeId })`; clear state

**6. Rubber-band exclusion**

`mousedown.select` now excludes `.ep-handle` from triggering rubber-band selection:
```ts
if (target.closest('.node, .member-hit, .ep-handle')) return
```

### Snap Radius

20 screen pixels, converted to world units: `snapPx = 20 / viewport.k`. Scales correctly at any zoom level.

### Verification

1. Add 3+ nodes, draw member between N1–N2, select in SELECT mode → handles appear at both endpoints ✅
2. Drag start handle toward N3, release → member reconnects to N3 ✅
3. Ghost line follows cursor during drag ✅
4. Snap highlight appears when cursor is within 20px of a valid node ✅
5. No snap (release in empty space) → member stays unchanged ✅
6. Undo → reverts to original connection ✅
7. Deselect member → handles disappear ✅
8. Switch to non-SELECT tool → handles do not render ✅

## Enhanced Print Report

**File:** `src/views/ReportView.vue`  
**Snapshot:** `src/components/canvas/StructureCanvas.vue` → `captureSnapshot()`  
**Store:** `solverStore.snapshotDataUrl`

### Structure Diagram Snapshot

After `▶ Run` succeeds, `WorkspaceView` watches `solver.result` and calls `canvasRef.captureSnapshot()`:

```ts
watch(() => solver.result, (res) => {
  if (res?.success) solver.snapshotDataUrl = canvasRef.value?.captureSnapshot() ?? ''
})
```

`captureSnapshot()` serializes the SVG with `XMLSerializer`, sets `viewBox` (responsive) instead of fixed pixel dimensions, and returns a base64 data URL:

```ts
clone.setAttribute('viewBox', `0 0 ${width} ${height}`)
clone.setAttribute('width', '100%')
clone.removeAttribute('height')
```

### Report Sections (12 total)

| # | Section | Notes |
|---|---------|-------|
| 1 | Structure Diagram | SVG snapshot; placeholder if no analysis run |
| 2 | Structure Summary | Includes design pass/fail count |
| 3 | Design Criteria | φ values (AISC 360), K=1, thresholds from `settings.urMarginal`/`urFail` |
| 4 | Nodes | X/Y in selected length unit |
| 5 | Members | Length, profile name, Type (Frame/Truss/Cable) |
| 6 | Steel Profile Parameters | d, bf, tf, tw, A, Ix, Iy, Sx, ry, Fy, mass — hidden if no profiles |
| 7 | Applied Loads | Uses member label for distributed loads (bug fix) |
| 8 | Support Reactions | Unit-converted |
| 9 | Nodal Displacements | ux/uy in selected length unit (÷1000 from internal mm) |
| 10 | Member End Forces | Uses member label (bug fix: was using `nodeName`) |
| 11 | Design Assessment | UR table, color-coded, status icons, suggestion notes |

### Print CSS

Resets App layout overflow constraints so all content renders in print dialog:

```css
@media print {
  html, body { overflow: visible !important; height: auto !important; }
  #app, main, .h-screen, .h-full, .overflow-hidden, .overflow-y-auto {
    overflow: visible !important; height: auto !important; max-height: none !important;
  }
}
```

### Bug Fixes

- **Member End Forces**: was calling `nodeName(mr.memberId)` — fixed to `memberName(mr.memberId)`
- **Distributed load location**: was showing `memberId.slice(0,6)` — fixed to use member label
- **Displacement units**: ux/uy were hardcoded in mm — now `settings.toLength(r.ux / 1000)`
- **UR thresholds**: design criteria and color coding now use `settings.urMarginal` / `settings.urFail`

