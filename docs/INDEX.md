# Documentation Index

Complete guide to structural analysis web app documentation.

## Quick Start

Start here for project overview:
- **[SPEC.md](SPEC.md)** — Architecture, current features (20/20), data contracts, next steps

## Main References

### Core Implementation Guides

1. **[CANVAS_ARCHITECTURE.md](CANVAS_ARCHITECTURE.md)** (303 lines)
   - D3.js zoom/pan behavior
   - Grid, keyboard shortcuts
   - CAD-style UX (hit areas, rubber-band selection, ghost lines)

2. **[FEATURES.md](FEATURES.md)** (574 lines)
   - Session persistence & undo/redo
   - JSON import/export
   - Editable node labels
   - Grid snap & truss validation
   - Deformed shape visualization
   - Multi-select & batch delete
   - Auto-switch tab on select
   - Distributed load click fix
   - Friendly member & load labels
   - Canvas member label display
   - Member label rotation
   - **Tension-only members** (cable/sling/hanger rods)

3. **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** (234 lines)
   - LRFD (AISC 360) methodology
   - Axial, flexural, shear capacity checks
   - Bilinear interaction formula (H1-1)
   - Tension-only special cases
   - Status determination & suggestions
   - Unit reflection bug fixes

4. **[UNIT_SYSTEM.md](UNIT_SYSTEM.md)** (241 lines)
   - Settings store configuration
   - Unit conversion (force, length, stress)
   - Settings modal & persistence
   - Analysis diagrams & unit-aware results
   - Steel profile database (TIS 1228, 374 profiles)
   - Data contracts & internal units
   - FEM solver architecture
   - Iterative solver for tension-only

5. **[TESTING.md](TESTING.md)** (376 lines)
   - Vitest unit testing
   - Playwright E2E testing
   - Test coverage requirements (80% minimum)
   - Test organization & best practices
   - Current test suite (263 tests: 239 unit + 24 E2E)
   - Debugging & regression testing

## Project Files Overview

### Main Project Reference
- **[../CLAUDE.md](../CLAUDE.md)** (193 lines) — Quick reference, stack, rules, development commands

### Data & Documentation
- **SPEC.md** — Feature list, current state, architecture
- **docs/INDEX.md** — This file

## Development Workflow

### Before Starting Any Task

1. Read **SPEC.md** (feature overview, architecture, data contracts)
2. Check relevant guide above (CANVAS_ARCHITECTURE, FEATURES, DESIGN_SYSTEM, UNIT_SYSTEM, TESTING)
3. Review **TESTING.md** — understand test requirements before coding
4. Design test cases first, then implement

### After Completing Any Task

1. **Write test cases** (Vitest + Playwright)
   - Happy path, edge cases, errors, integration
   - Minimum 80% code coverage
2. **Run tests:** `npm run test` and `npm run test:e2e`
3. **Commit test files** (living documentation)
4. **Update docs:**
   - Add/update section in relevant guide (FEATURES, DESIGN_SYSTEM, UNIT_SYSTEM, etc.)
   - Update SPEC.md (feature count, "Next Steps")
   - Update CLAUDE.md (if new rule or architectural decision)
5. **Never claim done without:**
   - All tests passing ✅
   - Test files committed ✅
   - Docs updated ✅

## Development Commands

```bash
docker compose up              # Start dev server (http://localhost:5173)
npm run dev                    # Dev server (inside container)
npm run test                   # Run all Vitest unit tests
npm run test:e2e              # Playwright E2E tests
npm run test:e2e:ui           # Visual test runner
npm run build                  # Production build
```

## Key Metrics

- **Features:** 20/20 complete
- **Supported Units:**
  - Force: kN, N, tf
  - Length: m, cm, mm, ft
  - Stress: MPa, kPa, tf/cm², ksc
- **Steel Profiles:** 374 (TIS 1228 Thai standard)
- **Tests:** 264 (239 unit + 25 E2E)
- **Documentation:** 5 detailed guides + SPEC.md + CLAUDE.md

## Feature Checklist (20/20 Complete)

✅ Interactive Canvas Workspace  
✅ FEM Solver (Frame & Truss)  
✅ Steel Profile Database  
✅ Settings System  
✅ Analysis & Diagrams  
✅ Print Report  
✅ JSON Import/Export  
✅ E2E Testing (Playwright)  
✅ Bug Fixes (SVG, undo/redo)  
✅ Session Management  
✅ Undo/Redo  
✅ Design Assessment (LRFD)  
✅ Deformed Shape Visualization  
✅ Multi-select & Batch Delete  
✅ Load Tools UX Rework  
✅ Auto-switch Tab  
✅ Friendly Member & Load Labels  
✅ Canvas Member Label Display  
✅ Member Label Rotation  
✅ **Tension-Only Members** (Cable/Sling/Hanger)

## Next Steps (Optional Enhancements)

1. **Node/member label display by default** — currently only shown on hover/selection
2. **Combined load cases** — support multiple load scenarios with enveloping
3. **Capacity graphs** — plot utilization vs. member section improvements
4. **Automated member sizing** — suggest optimal profiles based on analysis results
