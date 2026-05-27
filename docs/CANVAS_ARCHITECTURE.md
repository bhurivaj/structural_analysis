# Canvas Architecture

The canvas is a Three.js WebGL scene rendered inside `StructureCanvas.vue`. D3 was fully replaced in Phase 1.

## Scene Setup (`SceneManager.ts`)

`SceneManager` owns the renderer, cameras, and animation loop:

- **Renderer:** `THREE.WebGLRenderer` — fills the container div, antialiased, `preserveDrawingBuffer: true` (enables snapshot)
- **2D camera:** `THREE.OrthographicCamera` — top-down view, zoom via frustum scaling
- **3D camera:** `THREE.PerspectiveCamera` — perspective view, `OrbitControls` for pan/orbit/zoom
- **Animation loop:** `requestAnimationFrame`; frame callbacks registered via `addFrameCallback(fn)` (labels, grid update)
- **Mode switch:** `setMode('2d' | '3d')` — swaps active camera, resets controls
- **Preset views:** `setPresetView('top' | 'front' | 'side' | 'iso')` — repositions camera
- **Fit to view:** `fitToView(xMin, xMax, yMin, yMax)` — adjusts zoom/frustum to contain structure
- **Snapshot:** `snapshot()` — returns `renderer.domElement.toDataURL('image/png')` for print report

## Renderers

Each renderer owns its Three.js objects and disposes them cleanly.

| Renderer | File | Objects |
|----------|------|---------|
| `StructureRenderer` | `three/StructureRenderer.ts` | `Points` (nodes), `LineSegments` (members, deformed), `Line` (ghost/ep-ghost), `Points` (snap ring, ep-handles) |
| `GridRenderer` | `three/GridRenderer.ts` | `LineSegments` (world-unit grid, adaptive spacing) |
| `LoadsRenderer` | `three/LoadsRenderer.ts` | `ArrowHelper` objects for Fx, Fy, Fz; trapezoidal distributed load lines |
| `SupportRenderer` | `three/SupportRenderer.ts` | Pin triangle, fixed bar, roller wheels — 2D/3D mode aware |

### StructureRenderer

`update(nodes, members, selectedNodeIds, selectedMemberIds, deformedMap?, scale)` — called on every store change.

- **Nodes:** `THREE.Points` with `vertexColors` — selected nodes render in blue (`0x2563eb`), others in slate
- **Members:** `THREE.LineSegments` with `vertexColors` — selected = blue, tension-only = orange (`0xf97316`), normal = slate
- **Deformed shape:** `THREE.LineSegments` with `LineDashedMaterial` (blue dashed) — positions = `(node.x + ux*scale, node.y + uy*scale, node.z + uz*scale)`
- **Ghost line:** dashed blue `THREE.Line` shown during ADD_MEMBER (follows mouse) or endpoint drag
- **Snap ring:** large `THREE.Points` dot highlighting the nearest snap target
- **EP handles:** cyan `THREE.Points` at each endpoint of a selected member (endpoint reconnect)

### GridRenderer

Adaptive world-unit grid: spacing doubles/halves as zoom changes to stay between 20–200px on screen. Updated every frame via `SceneManager.addFrameCallback`.

## Coordinate System

- **World space:** X = right, Y = up, Z = out-of-plane (toward viewer)
- **Stored coordinates:** `node.x`, `node.y` in metres; `node.z` defaults to `0` (workplane)
- **Three.js positions:** directly use `(x, y, z)` — no Y negation needed (unlike old D3/SVG where Y was negated)

## Interaction (`useThreeInteraction.ts`)

Composable that attaches pointer event listeners to the WebGL canvas DOM element.

### Hit Testing (`threeHitTest.ts`)

- `hitTestNode(x, y, camera, nodes, rect)` — Raycaster against a `THREE.Points` object; returns nearest node within screen-pixel threshold
- `hitTestMember(x, y, camera, members, nodes, rect)` — projects member segments to screen, finds nearest within threshold
- `projectToScreen(wx, wy, wz, camera, rect)` — world → screen pixel (used for HTML label overlay)

### Mouse Interactions

| Action | Behavior |
|--------|----------|
| Click node (SELECT) | `structure.selectNode()` |
| Click member (SELECT) | `structure.selectMember()` |
| Click load arrow (SELECT) | `setEditingLoad(id)` |
| Click canvas background (SELECT) | `structure.clearSelection()` |
| Click canvas (ADD_NODE) | `structure.addNode()` at world position (snapped if grid-snap on) |
| Click node (ADD_MEMBER) | Set start node; second click → `structure.addMember()` |
| Click member (ADD_DIST_LOAD) | `setEditingLoad(null)` + open LoadPanel |
| Left drag (SELECT) | Rubber-band selection (see below) |
| Left drag node (SELECT) | Node drag → `structure.updateNode()` |
| Drag ep-handle (SELECT) | Endpoint reconnect → `structure.updateMember()` |
| Scroll wheel | Zoom (all modes) |
| Middle-mouse drag | Pan (all modes) |
| Space + left drag | Temporary pan |

### Rubber-Band Selection

- **Left→Right (window):** solid blue box — selects fully enclosed elements only
- **Right→Left (crossing):** dashed green box — selects any element touching the box
- Detection: `cx >= startSx ? 'window' : 'crossing'`

### Grid Snap

`useCanvasKeys.ts` tracks snap state (toggled by G key). When active, `ADD_NODE` clicks snap to nearest integer world unit: `Math.round(worldX)`, `Math.round(worldY)`. Shift+drag node also snaps.

### Endpoint Reconnect

When exactly 1 member is selected, cyan handle dots appear at each endpoint. Dragging a handle:
1. Shows dashed ghost line from fixed end to cursor
2. Highlights nearest node within 20 screen-pixel snap radius
3. On release with snap target: `structure.updateMember({ startNodeId/endNodeId: snapNodeId })`

## Camera Mode (`useCanvasMode.ts`)

| Mode | Camera | Controls | Grid |
|------|--------|----------|------|
| `'2d'` | OrthographicCamera | Scroll zoom, middle-mouse pan, Space+drag | XY plane grid |
| `'3d'` | PerspectiveCamera | OrbitControls (orbit + pan + zoom) | XY plane at `workplaneZ` |

Toggle button (top-right of canvas) calls `sceneMan.setMode(next)`. `WorkplaneControls.vue` (visible in 3D mode) provides preset view buttons and workplane Z input.

## Label Overlay

Node and member labels are HTML `<span>` elements positioned absolutely over the canvas — not SVG text. Updated every frame via `updateLabels()` inside `SceneManager.addFrameCallback`:

1. For each node: `projectToScreen(n.x, n.y, n.z)` → CSS `left/top`
2. For each member: project midpoint → CSS `left/top`

Font: `font-mono text-[10px]` — nodes slate-500, members slate-400.

## Canvas Snapshot

`captureSnapshot()` in `StructureCanvas.vue` calls `sceneMan.snapshot()`:

```ts
snapshot(): string {
  return this.renderer.domElement.toDataURL('image/png')
}
```

`preserveDrawingBuffer: true` on the renderer is required — otherwise the buffer is cleared after each frame and `toDataURL` returns blank.

Called by `WorkspaceView` after a successful analysis run, stored in `solverStore.snapshotDataUrl` for the print report.

## Keyboard Shortcuts

All shortcuts fire only when focus is NOT inside an `<input>` or `<textarea>` (`useCanvasKeys.ts`).

| Key                        | Action                      |
| -------------------------- | --------------------------- |
| S                          | SELECT tool                 |
| P                          | PAN tool                    |
| N                          | ADD_NODE tool               |
| M                          | ADD_MEMBER tool             |
| L                          | ADD_POINT_LOAD tool         |
| D                          | ADD_DIST_LOAD tool          |
| R                          | ADD_MOMENT tool             |
| G                          | Toggle grid snap            |
| Delete / Backspace         | Delete selected             |
| Escape                     | Cancel pending member start |
| Space (hold)               | Temporary pan mode          |
| Ctrl/Cmd+Z                 | Undo                        |
| Ctrl/Cmd+Shift+Z or Ctrl+Y | Redo                        |
