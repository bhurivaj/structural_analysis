# Canvas Architecture & UX

Detailed documentation of D3.js canvas behavior, interaction patterns, and viewport management.

## Keyboard Shortcuts

All shortcuts fire only when focus is NOT inside an `<input>` or `<textarea>`.

| Key                        | Action                      |
| -------------------------- | --------------------------- |
| S                          | SELECT tool                 |
| P                          | PAN tool                    |
| N                          | ADD_NODE tool               |
| M                          | ADD_MEMBER tool             |
| L                          | ADD_POINT_LOAD tool         |
| D                          | ADD_DIST_LOAD tool          |
| R                          | ADD_MOMENT tool             |
| Delete / Backspace         | Delete selected             |
| Escape                     | Cancel pending member start |
| Space (hold)               | Temporary pan mode          |
| Ctrl/Cmd+Z                 | Undo                        |
| Ctrl/Cmd+Shift+Z or Ctrl+Y | Redo                        |

## Canvas UX Features

### Rich Tooltips

Tool buttons in the left toolbar show instant tooltips on hover with the tool name and keyboard shortcut badge:

- Implemented in `CanvasToolbar.vue` using Tailwind's `group` pattern
- Tooltips appear to the right of buttons with no delay
- Each tool: SELECT (S), PAN (P), ADD_NODE (N), ADD_MEMBER (M), POINT_LOAD (L), DIST_LOAD (D), MOMENT (R)

### Pan and Zoom

D3 zoom behavior supports multiple modes:

- **Scroll wheel**: Zoom in/out in any tool mode
- **Middle-mouse drag**: Pan in any tool mode
- **Space + left-drag**: Temporary pan while Space is held (any mode)
- **PAN tool drag**: Left-drag pans when PAN tool is active
- **Fit button**: Centers structure in viewport (implemented in WorkspaceView)
- **Zoom indicator**: Displays current zoom % in bottom-right corner
- Space bar changes cursor to 'grabbing' for visual feedback

### D3 Zoom State Sync

- Initial viewport synced with D3 zoom transform on mount using `svg.call(zoomBehavior.transform, ...)`
- Prevents mismatch between Pinia viewport state (k=80) and D3 initial state (k=1)
- Grid rendering now accurate on first pan/zoom

## Canvas Architecture

### D3 Zoom Behavior

Zoom filter controls which events trigger panning/dragging:

- **Scroll wheel**: Always zoom (any mode)
- **Middle-mouse (button 1)**: Always pan (any mode)
- **Left-drag (button 0)**: Only in PAN mode OR when Space held
- **Space bar**: Temporary pan with "grabbing" cursor
- Cursor reflects state: grab (PAN), crosshair (ADD_NODE), default (SELECT)

### Grid Rendering

- Grid drawn via D3 lines with dynamic spacing (`gridPx = 80 * k`)
- Line count changes on zoom
- Grid transform synced via viewport state
- Skips rendering if `gridPx < 10` to prevent clutter

## Enhanced Click/Drag UX (CAD-style interactions)

### Overview

Improved canvas interaction UX to match CAD software (AutoCAD, Revit) conventions: wider hit areas, directional selection (window vs. crossing), ghost line previews, and better cursor feedback.

**File Modified:** `src/components/canvas/StructureCanvas.vue` only (single file)

### 1. Cursor Feedback for All Tool Modes

Updated `canvasCursor` computed property to show meaningful cursors:

- `PAN`: grab
- `ADD_NODE`: crosshair
- `ADD_MEMBER`: crosshair
- `ADD_POINT_LOAD`, `ADD_DIST_LOAD`, `ADD_MOMENT`: all show **crosshair** (was `default`)
- `SELECT`: default (except on hover: `pointer` for interactive elements)

Member lines only show `pointer` cursor when in SELECT mode, avoiding misleading cursor in other modes.

### 2. Wider Member Hit Area (14px invisible zone)

**Problem:** Members are 2px stroke — nearly impossible to click, especially when zoomed out.

**Solution:**

- Added `#member-hit-layer` SVG group on top of visible members
- Created invisible thick lines (14px) with `stroke: transparent`, `pointer-events: all`
- Same click handlers as visible lines (SELECT, ADD_DIST_LOAD)
- Visible member lines have `pointer-events: none` so hits pass through to invisible zone

Result: Members now easily clickable at any zoom level, with no visual clutter.

### 3. Deselect on Background Click

**Problem:** Clicking empty canvas in SELECT mode did not clear current selection.

**Solution:**

- Detect plain background click: `wasPlainClick = _selStart !== null && !_selDragging`
- Call `structure.clearSelection()` and `setEditingLoad(null)` on plain click
- Maintains rubber-band selection behavior (drag creates box, releases selects)

Result: Natural SELECT mode behavior matching CAD software.

### 4. ADD_MEMBER Ghost Line Preview

**Problem:** After clicking first node in ADD_MEMBER mode, no visual feedback about where member will connect.

**Solution:**

- Track `mouseCanvasPos` ref — mouse position in world coordinates
- Call `drawGhostLine()` on every `mousemove.ghost` event
- Ghost line: dashed blue (opacity 0.5), from start node to cursor, follows mouse in real-time
- Clears when mode changes or member is completed

**Files:**

- `#ghost-layer` SVG group
- `drawGhostLine()` function
- `mousemove.ghost` handler
- Ghost line included in `drawAll()` so it clears on state changes

Result: Crystal-clear visual feedback during member drawing.

### 5. Node Drag Coordinate Fix

**Problem:** Node drag used raw `event.sourceEvent.clientX`, which is wrong when SVG has left offset (e.g., left panel open).

**Fix:**

```ts
const rect = svgRef.value?.getBoundingClientRect()
const wPos = screenToWorld(
  event.sourceEvent.clientX - (rect?.left ?? 0),  // ← subtract left offset
  event.sourceEvent.clientY - (rect?.top ?? 0),
)
```

Result: Accurate node positioning regardless of canvas offset in viewport.

### 6. Directional Rubber-Band Selection (CAD window vs. crossing)

**Behavior (matches AutoCAD/Revit):**

- **Left→Right drag (window):** solid blue box — selects only fully-enclosed elements
- **Right→Left drag (crossing):** dashed green box — selects anything the box touches

**Implementation:**

1. **State tracking:** `const selectionMode = ref<'window' | 'crossing' | null>(null)`
2. **Direction detection (in mousemove.select):**

   ```ts
   selectionMode.value = cx >= _selStart.sx ? 'window' : 'crossing'
   ```
3. **Visual feedback:** Template div changes border/fill style based on mode:

   - Window: solid #3b82f6 (blue) border, light blue fill
   - Crossing: dashed #22c55e (green) border, light green fill
4. **Selection logic:**

   - Nodes: always select if inside box (same for both modes)
   - Members:
     - **Window**: both endpoints must be inside box (strict containment)
     - **Crossing**: member line touches/intersects box (uses `memberTouchesRect()` helper)
5. **Helper functions:**

   - `segmentsIntersect()`: standard line-segment intersection test
   - `memberTouchesRect()`: checks if member line intersects rectangle (either endpoint inside OR crosses an edge)

Result: Professional, intuitive selection behavior that engineers recognize from CAD software.

### Verification

✅ Unit tests: 239 pass (TypeScript compilation clean)
✅ E2E tests: 53 workspace tests pass
✅ All interactions verified:

1. Member hit area: zoom out, click member — responds reliably
2. Deselect: click node → click empty canvas → selection clears
3. Ghost line: M → click node → move mouse → dashed line follows
4. Cursor: L/D/R → cursor changes to crosshair; hover member in non-SELECT → default cursor
5. Node drag: right panel open, drag node → accurate position (rect.left correction)
6. Directional selection: left→right drag → blue box, window selection; right→left → green box, crossing selection
