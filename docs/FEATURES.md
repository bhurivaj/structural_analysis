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
- Labels render as HTML `<span>` elements positioned over the WebGL canvas (not SVG text)
- `updateLabels()` called every frame via `SceneManager.addFrameCallback` — projects world coords to screen via `projectToScreen()`
- Offset 8px right, 14px above node; font-mono 10px; node labels = slate-500, member labels = slate-400

### Verification

1. Add node → auto-labeled N1 ✅
2. Select node → label appears in NodePanel input ✅
3. Edit label → press Enter → canvas updates ✅
4. Reload page → label persists ✅
5. Undo/redo → label reverts/restores ✅

## Grid Snap Toggle & Truss Validation

### Grid Snap Toggle

Implemented in `useCanvasKeys.ts` as `snapEnabled` ref (default true):

- G key toggles snap; toolbar button shows current state
- When active, ADD_NODE clicks snap to nearest world unit: `Math.round(worldX)`, `Math.round(worldY)`
- Shift+drag node also snaps to nearest integer world unit
- Grid visual (GridRenderer) uses the same world-unit spacing

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

Analysis results include displacements (ux, uy, uz per node). Deformed shape overlays member positions after applying amplified displacements, including out-of-plane (Z) deflection.

**In `solverStore.ts`:**
- `showDeformed` ref (boolean) — toggles deformed overlay
- `deformedScale` ref (0–500%, default 100) — in `settingsStore`

**In `StructureCanvas.vue`:**
- `buildDeformedMap()` — builds `Map<nodeId, {ux, uy, uz}>` from `solver.result.nodeResults`
- Passed to `structRend.update(...)` which calls `updateDeformed()`

**In `StructureRenderer.ts` (`updateDeformed()`):**
- Creates `THREE.LineSegments` with `LineDashedMaterial` (blue dashed, `0x3b82f6`)
- Deformed position: `(node.x + ux*scale, node.y + uy*scale, node.z + uz*scale)` — full 3D
- `computeLineDistances()` required for dashed material to render correctly

**In `WorkspaceView.vue`:**
- DEF button in diagram overlay (only shows when analysis successful)
- Positioned bottom-right with separator line and toggle styling

### Verification

1. Run analysis → DEF button appears ✅
2. Click DEF → deformed members render over structure ✅
3. Adjust deformedScale slider → deformation amplification changes in real-time ✅
4. With Fz load in 3D mode → members deflect in Z direction ✅
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

## Distributed Load Click Interaction

Distributed load arrows are Three.js `ArrowHelper` objects rendered by `LoadsRenderer.ts`. Click detection uses screen-space proximity — `useThreeInteraction` projects load arrow positions to screen and checks pointer distance. Selecting a distributed load calls `setEditingLoad(id)`, which switches the right panel to the Load tab and pre-fills the form.

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

Node and member labels are HTML `<span>` elements in `StructureCanvas.vue`, positioned absolutely over the WebGL canvas. Updated every animation frame via `updateLabels()` registered as a `SceneManager` frame callback.

### Implementation

```ts
function updateLabels() {
  if (!sceneMan || !containerRef.value) return
  const cr = containerRef.value.getBoundingClientRect()
  const items: LabelItem[] = []
  for (const n of structure.nodes) {
    const { sx, sy } = projectToScreen(n.x, n.y, n.z ?? 0, sceneMan.camera, cr)
    items.push({ key: `n-${n.id}`, text: n.label ?? '', x: sx - cr.left + 8, y: sy - cr.top - 14 })
  }
  for (const m of structure.members) {
    // midpoint of member → projectToScreen
    items.push({ key: `m-${m.id}`, text: m.label ?? '', x: ..., y: ... })
  }
  labels.value = items
}
```

- Node labels: slate-500, offset +8px right, -14px up from node center
- Member labels: slate-400, offset at midpoint
- No rotation (HTML spans don't rotate in sync with camera)
- Labels update every frame — always in sync with pan/zoom/orbit

### Verification

1. Add member → canvas shows "M1" near midpoint ✅
2. Assign profile → member label updates ✅
3. Pan/zoom/orbit → labels follow geometry ✅

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

**5. Canvas Rendering (`src/components/canvas/three/StructureRenderer.ts`)**

Tension-only members render in orange via `vertexColors` in `updateMembers()`:

```ts
const c = sel.has(m.id) ? C_MEMBER_SEL : m.tensionOnly ? C_TENSION : C_MEMBER
// C_TENSION = 0xf97316 (orange)
```

No dashing — the orange color alone distinguishes tension-only from normal members.

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

**Files:** `src/composables/useThreeInteraction.ts`, `src/components/canvas/three/StructureRenderer.ts`

### Implementation

**1. Trigger condition**

When exactly 1 member is selected, `useThreeInteraction` calls `structRend.setEpHandles([start, end])` to render cyan endpoint handles in the Three.js scene.

**2. Three.js objects (StructureRenderer)**

- **`epHandles`** — `THREE.Points` with cyan material (`0x22d3ee`), size 14px non-attenuated; rendered at each endpoint (z + 0.1 for depth)
- **`epGhost`** — `THREE.Line` with `LineDashedMaterial` from fixed endpoint to drag cursor

**3. Pointer event handling (useThreeInteraction)**

- `pointerdown` on canvas → if hit-test hits an ep-handle point → enter endpoint drag mode
- `pointermove` during drag → update ghost line via `structRend.setEpGhost(fixed, cursor)`; show snap ring via `structRend.setSnapRing(nearestNode)` if within 20px screen radius
- `pointerup` → if snap target found → `structure.updateMember(id, { startNodeId/endNodeId: snapNodeId })`; clear handles

**4. Snap radius**

20 screen pixels — converted to world distance using camera projection. Snap ring (large blue dot) highlights the target node.

### Verification

1. Add 3+ nodes, draw member N1–N2, select in SELECT mode → cyan handles appear at both endpoints ✅
2. Drag start handle toward N3, release → member reconnects to N3 ✅
3. Ghost line follows cursor during drag ✅
4. Snap ring appears when cursor is within 20px of a valid node ✅
5. No snap (release in empty space) → member stays unchanged ✅
6. Undo → reverts to original connection ✅
7. Deselect member → handles disappear ✅

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

`captureSnapshot()` calls `sceneMan.snapshot()` which returns a base64 PNG from the WebGL canvas:

```ts
snapshot(): string {
  return this.renderer.domElement.toDataURL('image/png')
}
```

`preserveDrawingBuffer: true` is required on `WebGLRenderer` — otherwise the framebuffer is cleared after each frame and `toDataURL` returns blank.

### Report Sections (12 total)

| # | Section | Notes |
|---|---------|-------|
| 1 | Structure Diagram | WebGL canvas PNG snapshot; placeholder if no analysis run |
| 2 | Structure Summary | Includes design pass/fail count |
| 3 | Design Criteria | φ values (AISC 360), K=1, thresholds from `settings.urMarginal`/`urFail` |
| 4 | Nodes | X/Y/Z in selected length unit |
| 5 | Members | Length, profile name, Type (Frame/Truss/Cable) |
| 6 | Steel Profile Parameters | d, bf, tf, tw, A, Ix, Iy, Sx, ry, Fy, mass — hidden if no profiles |
| 7 | Applied Loads | Uses member label for distributed loads |
| 8 | Support Reactions | Rx, Ry, Rz, Mx, My, Mz — unit-converted |
| 9 | Nodal Displacements | ux, uy, uz (length unit), rx, ry, θz (rad) |
| 10 | Member End Forces | N₁/V₁/M₁/N₂/V₂/M₂ per member |
| 11 | Design Assessment | UR table, color-coded, status icons, suggestion notes |
| 12 | (reserved) | — |

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

