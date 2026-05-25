# Testing Strategy & Coverage

Comprehensive guide to test organization, coverage requirements, and testing best practices.

## Testing Framework

- **Unit Tests:** Vitest (in `src/**/__tests__/*.test.ts`)
- **E2E Tests:** Playwright (in `tests/e2e/*.spec.ts`)
- **Coverage Goal:** Minimum 80% of new code paths exercised

## Running Tests

```bash
npm run test           # Run all Vitest unit tests
npm run test:unit     # Run single file: npx vitest run <path>
npm run test:e2e      # Playwright e2e tests (headless)
npm run test:e2e:ui   # Visual browser UI for tests
npm run test:e2e:debug # Debug mode
```

## Test Organization

### Unit Tests (Vitest)

Located in `src/**/__tests__/` alongside the code they test.

**Test file structure:**

```
src/
├── solver/
│   ├── index.ts
│   └── __tests__/
│       ├── tensionOnly.test.ts      ← Iterative solver tests
│       └── other.test.ts
├── utils/
│   ├── designCheck.ts
│   └── __tests__/
│       ├── tensionOnlyDesignCheck.test.ts  ← Design check tests
│       └── other.test.ts
└── ...
```

**Naming convention:** `*.test.ts` for unit tests

### E2E Tests (Playwright)

Located in `tests/e2e/`.

**Test file structure:**

```
tests/e2e/
├── navigation.spec.ts              ← Route and page access
├── steelProfiles.spec.ts           ← Steel profile features
├── workspace.spec.ts               ← Canvas and tools
├── tensionOnlyMembers.spec.ts      ← Tension-only feature
└── ...
```

**Naming convention:** `*.spec.ts` for E2E tests

## Test Coverage Requirements

### For Each Feature (MANDATORY)

**Before implementation:** Design test cases covering:

1. **Happy path** (normal usage)
   - Feature works as designed
   - All user workflows succeed
   - Data persists correctly

2. **Edge cases** (boundary conditions, unusual inputs)
   - Empty structures
   - Single-element structures
   - Maximum limits (50 members, many loads)
   - Zero values, negative values
   - Floating-point precision

3. **Error cases** (invalid states, failures)
   - Missing required inputs
   - Invalid configurations (e.g., no supports)
   - Solver convergence failures
   - File I/O errors

4. **Integration** (feature works with rest of system)
   - Undo/redo preserves feature state
   - JSON import/export handles feature data
   - Unit conversion applies correctly
   - Dependent features still work (no regressions)

### Test Case Example: Tension-Only Members

```
Unit Tests (Vitest):
  ✅ Simple cable under tension → converges, member in result
  ✅ Cable results have all required fields (N, V, M arrays, endForces)
  ✅ Multiple cables both included in results
  ✅ Convergence verification (max 50 iterations)

Design Check Tests:
  ✅ Cable with tensile force → UR_axial > 0, UR_bending/shear = 0
  ✅ Cable with zero force (slack) → UR_axial = 0, status PASS
  ✅ Cable vs normal truss member → same axial UR, different combined
  ✅ Cable with unexpected moment → moment ignored, UR_combined = UR_axial

E2E Tests (Playwright):
  ✅ Add nodes and create normal member
  ✅ Toggle tension-only checkbox in MemberPanel
  ✅ Tension-only member displays as dashed orange line
  ✅ Warning message appears when checked
  ✅ Tension-only flag persists in JSON export/import
  ✅ Uncheck reverts to normal member appearance
  ✅ Analysis runs successfully with tension-only member under tension
```

## Test Authoring Guidelines

### Unit Tests (Vitest)

**Structure:**
```ts
import { describe, it, expect } from 'vitest'
import { functionUnderTest } from '@/path'

describe('Feature Name', () => {
  describe('Specific scenario', () => {
    // Setup
    const input = { ... }
    
    // Execute
    const result = functionUnderTest(input)
    
    // Assert
    it('should produce expected output', () => {
      expect(result).toBe(expectedValue)
    })
    
    it('should handle edge case', () => {
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
```

**Best practices:**
- One logical assertion per test (or logically related assertions)
- Descriptive test names (don't use "should work correctly")
- Use beforeEach for common setup to avoid duplication
- Mock external dependencies (stores, API calls)
- Test both success and failure paths

### E2E Tests (Playwright)

**Structure:**
```ts
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and wait for initialization
    await page.goto('/workspace')
    await page.locator('#grid-layer line').first().waitFor()
  })

  test('user can interact with feature', async ({ page }) => {
    // Act
    await page.click('button:has-text("N")')
    await page.click('svg', { position: { x: 200, y: 200 } })
    
    // Assert
    const circles = page.locator('circle.node')
    expect(await circles.count()).toBeGreaterThan(0)
  })
  
  test('feature persists after reload', async ({ page }) => {
    // Setup data
    // ...
    
    // Reload
    await page.reload()
    
    // Verify persistence
    // ...
  })
})
```

**Best practices:**
- Use real user interactions (click, fill, select)
- Wait for elements with `.waitFor()` or `.isVisible()`
- Include visual feedback verification (stroke color, dashing, etc.)
- Test complete workflows (create → edit → export)
- Include persistence tests (reload, JSON import/export)

## Current Test Suite (305 tests)

### Unit Tests (239 tests)

- **solver/**: Matrix assembly, FEM calculations, boundary conditions, member forces
- **types/**: TypeScript type checking, interface compliance
- **stores/**: Pinia state mutations, computed properties, derived state
- **utils/**: Design checks, conversions, helpers
- **composables/**: Undo/redo, session cache, zoom calculations
- **components/**: Vue component logic (not DOM, use E2E for that)

### E2E Tests (66 tests)

**navigation.spec.ts** (2 tests):
- Default route loads workspace
- Navigation between pages

**steelProfiles.spec.ts** (4 tests):
- Seed data loading
- Profile filtering and search
- Detail view

**workspace.spec.ts** (10 tests):
- Canvas tools visibility and functionality
- Pan and zoom behavior
- Run/Fit buttons
- Error handling
- **Regression:** drag node with load attached → node moves AND loads follow (fix: `_isDragging` flag skips drag handler rebind in `drawNodes()` so D3 drag state persists while `drawAll()` still redraws forces/supports)

**unitConversion.spec.ts** (8 tests):
- Unit settings change reflects on canvas
- Force labels update with units
- Analysis values convert correctly
- Report exports in selected units

**tensionOnlyMembers.spec.ts** (7 tests):
- Add nodes and members
- Toggle tension-only checkbox
- Visual indication (dashed orange)
- Warning message
- JSON persistence
- Uncheck revert
- Full analysis workflow

**canvas-ux-improvements.spec.ts** (13 tests):
- Deselect on background click (1 test)
- ADD_MEMBER ghost line preview (2 tests)
- Directional rubber-band selection: window vs crossing (2 tests)
- Wider member hit area (1 test)
- Cursor feedback for tool modes (2 tests)
- Member label rotation: parallel to member line (5 tests)

## Debugging Tests

### Vitest

```bash
# Run single test file
npm run test:unit src/solver/__tests__/tensionOnly.test.ts

# Watch mode (reruns on file change)
npx vitest watch src/solver/__tests__/

# Debug with Node inspector
node --inspect-brk ./node_modules/vitest/vitest.mjs run <path>
```

### Playwright

```bash
# Visual UI with all tests
npm run test:e2e:ui

# Debug mode (opens browser, allows step-through)
npm run test:e2e:debug

# Run single file
npx playwright test tests/e2e/tensionOnlyMembers.spec.ts

# Run single test
npx playwright test -g "toggle tension-only"
```

## Test Quality Checklist

Before marking a feature as done:

- [ ] All unit tests pass (`npm run test`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] New tests cover happy path, edge cases, errors, integration
- [ ] Test file names follow convention (`*.test.ts` or `*.spec.ts`)
- [ ] Test files are committed to git
- [ ] New code paths have ≥80% coverage
- [ ] No test flakiness (no sleep, no arbitrary waits)
- [ ] Documentation updated (FEATURES.md or relevant CLAUDE.md guide)

## Pending Test Plans

Feature work in progress — test cases designed but not yet written:

- **[PHASE1D_TESTS.md](PHASE1D_TESTS.md)** — Grid, snap-to-grid, node Z (Three.js canvas Phase 1d); 28 tests planned (17 unit + 11 E2E)

---

## Regression Testing

When fixing a bug, always:

1. Add a test case that would have caught the bug
2. Verify the test fails on old code
3. Verify the test passes on new code
4. Commit the test with the fix

This prevents regressions from creeping back in future refactors.

## Continuous Integration

Local testing must pass before considering work done. The test suite is the source of truth for feature correctness — passing tests = working feature.
