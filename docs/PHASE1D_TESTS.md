# Phase 1d — Pending Test Cases

Tests to write after Phase 1d implementation is complete (grid, snap, node Z, load arrows, support symbols, labels).

**Run when:** all Phase 1d items marked ✅ in SPEC.md — **all items now done**

---

## Unit Tests (`src/**/__tests__/*.test.ts`)

| # | File | Describe | Test case | Expected |
|---|------|----------|-----------|----------|
| 1 | `three/GridRenderer.test.ts` | GridRenderer | `update()` in 2D mode | creates LineSegments, adds to scene |
| 2 | `three/GridRenderer.test.ts` | GridRenderer | `update()` in 3D mode | creates GridHelper (XY plane), adds to scene |
| 3 | `three/GridRenderer.test.ts` | GridRenderer | adaptive step — zoom out (large visH) | step = larger power of 2 |
| 4 | `three/GridRenderer.test.ts` | GridRenderer | adaptive step — zoom in (small visH) | step = smaller power of 2 |
| 5 | `three/GridRenderer.test.ts` | GridRenderer | origin marker on construct | LineSegments added at (0,0) |
| 6 | `three/GridRenderer.test.ts` | GridRenderer | `dispose()` | removes all objects from scene |
| 7 | `composables/useCanvasMode.test.ts` | useCanvasMode | default value | cameraMode === '2d' |
| 8 | `composables/useCanvasMode.test.ts` | useCanvasMode | `setCameraMode('3d')` | shared ref updates across callers |
| 9 | `composables/useCanvasViewport.test.ts` | snapPoint | snap=off | returns original x,y unchanged |
| 10 | `composables/useCanvasViewport.test.ts` | snapPoint | snap=on | rounds to nearest integer |
| 11 | `composables/useCanvasViewport.test.ts` | toggleSnap | called twice | returns to original state |
| 12 | `stores/structureStore.test.ts` | addNode | with z value | z persisted in node |
| 13 | `stores/structureStore.test.ts` | updateNode | z field | z updated correctly |
| 14 | `stores/structureStore.test.ts` | addNode | without z | z is undefined (not 0) |
| 15 | `three/StructureRenderer.test.ts` | node positions | z provided | pos buffer uses n.z |
| 16 | `three/StructureRenderer.test.ts` | node positions | z undefined | pos buffer uses 0 |
| 17 | `three/StructureRenderer.test.ts` | member endpoints | n1.z, n2.z set | buffer uses correct z for both ends |
| 29 | `three/SupportRenderer.test.ts` | SupportRenderer | free node | no geometry added |
| 30 | `three/SupportRenderer.test.ts` | SupportRenderer | pinned node | LineSegments with triangle + hatch verts added |
| 31 | `three/SupportRenderer.test.ts` | SupportRenderer | fixed node | LineSegments with bar + hatch verts |
| 32 | `three/SupportRenderer.test.ts` | SupportRenderer | roller y-axis | triangle + circle wheels verts |
| 33 | `three/SupportRenderer.test.ts` | SupportRenderer | roller x-axis | left-pointing triangle + vertical wheel verts |
| 34 | `three/SupportRenderer.test.ts` | SupportRenderer | `update()` twice | disposes old geometry before rebuild |
| 35 | `three/SupportRenderer.test.ts` | SupportRenderer | `dispose()` | removes LineSegments from scene |

## E2E Tests (`tests/e2e/phase1d.spec.ts`)

| # | Describe | Test case | Steps | Expected |
|---|----------|-----------|-------|----------|
| 18 | Grid | grid visible on load | open workspace | canvas has grid lines |
| 19 | Grid | grid adapts on zoom out | scroll out | fewer, larger grid cells |
| 20 | Grid | grid shows in 3D mode | click 3D button | GridHelper visible in XY plane |
| 21 | Grid | grid returns on 2D mode | toggle back to 2D | adaptive LineSegments grid reappears |
| 22 | Snap | G key toggles snap | press G | toolbar snap button highlights |
| 23 | Snap | node snaps to integer | snap on → ADD_NODE → click near (1.3, 2.7) | node placed at (1, 3) |
| 24 | Snap | node no snap | snap off → ADD_NODE → click near (1.3, 2.7) | node placed at ~(1.3, 2.7) |
| 25 | Node Z | Z input hidden in 2D | select node in 2D mode | no Z field visible |
| 26 | Node Z | Z input visible in 3D | toggle 3D → select node | Z field appears |
| 27 | Node Z | edit Z updates member | set Z=3 on node → check member | member renders in 3D space |
| 28 | Node Z | Z persists in JSON | set Z → export → import | Z value preserved |
| 36 | Support symbols | pinned support visible | add pinned node → canvas | triangle symbol appears below node |
| 37 | Support symbols | fixed support visible | add fixed node → canvas | bar+hatch symbol appears |
| 38 | Support symbols | roller support visible | add roller node → canvas | roller triangle+wheels appear |
| 39 | Labels | node label visible | add node → canvas | "N1" text appears near node |
| 40 | Labels | member label visible | add 2 nodes + member → canvas | "M1" text appears at midpoint |
| 41 | Labels | labels track pan | pan canvas | labels move with structure |
| 42 | Labels | labels update count | add 3rd node | "N3" appears for new node |

---

## Status

- [ ] Unit tests written (SupportRenderer: #29–35)
- [ ] E2E tests written (support symbols: #36–38; labels: #39–42)
- [ ] All tests passing (`npm run test` + `npm run test:e2e`)
- [ ] TESTING.md current test count updated
- [x] SPEC.md Phase 1d status updated — all items ✅
