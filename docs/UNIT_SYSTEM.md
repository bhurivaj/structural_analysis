# Unit System & Settings

Detailed documentation of the settings system, unit conversion, and data contracts.

## Settings & Unit System

The app supports configurable display units for forces, lengths, and stresses. All internal calculations store values in base units (kN, m, MPa); display conversion happens at component level.

### Stores and Configuration

File: `src/stores/settingsStore.ts`

Manages units, project info, and default member parameters:

- `forceUnit`: 'kN' | 'N' | 'tf'
- `lengthUnit`: 'm' | 'cm' | 'mm' | 'ft'
- `stressUnit`: 'MPa' | 'kPa' | 'tf/cm²' | 'ksc' (kg/cm², Thai standard)
- `projectName`, `engineerName` — displayed in report header
- `defaultE`, `defaultFy`, `defaultA`, `defaultI` — defaults for new members
- `deformedScale` — scale factor for deformed shape visualization (0–5000, displayed as 0.0x–50.0x, default 1000 = 10.0x)

### Unit Conversion

The settings store provides conversion methods:

- `toForce(kN)` — convert base kN → display unit
- `toLength(m)` — convert base m → display unit
- `toStress(mpa)` — convert base MPa → display unit
- `fromForce(v)` — convert display input → base kN
- `fromLength(v)` — convert display input → base m
- `momentLabel` — computed label combining units (e.g., "kN·m", "N·cm", "tf·m")
- `distForceLabel` — computed label for distributed loads (e.g., "kN/m", "N/mm")

Used in: NodePanel, LoadPanel, ReactionTable, AnalysisView, ReportView

### Settings Modal

- Accessible via gear icon (⚙) in AppNavbar
- Three sections: Project Info, Display Units, Default Parameters
- Changes persisted to localStorage (key `structcalc_settings`)
- Loaded on app startup in `main.ts`

## Analysis & Diagrams

### DiagramPanel Component

Location: `src/components/analysis/DiagramPanel.vue`

- Member selector dropdown and N/V/M toggle buttons
- SVG visualization of axial force, shear force, and bending moment diagrams
- Displays min/max values with annotations
- Automatically applies unit conversions from settingsStore

Added to `AnalysisView.vue` between reaction/displacement tables and member end forces table.

### Unit-Aware Results

All result tables (Reactions, Displacements, Member End Forces) display values in the selected units:

- **Reactions**: rx, ry in `forceUnit`; mz in `momentLabel`
- **Displacements**: ux, uy in mm; θz in radians (absolute units)
- **Member End Forces**: N/V in `forceUnit`; M in `momentLabel`

## Steel Profile Database

**TIS 1228 Thai Standard** (374 profiles with all thickness variants):

- **H-Sections** (73 profiles): Complete set with variants
- **Channels** (16 profiles): All sizes with thickness variants
- **Equal Angles** (46 profiles): All angles with variants
- **Rectangular Tubes (RHS)** (26 profiles): All sizes with thickness variants
- **Square Tubes (CHS)** (32 profiles): All sizes with thickness variants
- **I-Sections** (20): Various configurations
- **Round Pipes** (35): Various sizes

**Data Source:** `docs/steels_tis/steel.xlsx` (single source of truth)

**Generated Files:** `src/data/steelProfiles/tis1228_*.ts`

Each profile stores: designation, dimensions (d, bf, tf, tw, r), properties (A, Ix, Iy, Sx, Zx), material (E, Fy), mass.

## Data Contract

### Internal Units (always stored as)

- **Force:** kN
- **Length:** m
- **Stress:** MPa
- **Moments:** kN·m

### Data Flow

```
User Input (canvas tools, panels) 
  → convert via fromLength(), fromForce() 
  → store in internal units
  → Pinia stores (always kN/m/MPa)
  → Display via toLength(), toForce(), toStress() using settingsStore.unitLabel
  → User sees selected units
```

### Key Types

Located in `src/types/`:

- **StructureNode**: { id, x, y, support, rollerAxis?, label }
- **Member**: { id, startNodeId, endNodeId, steelProfileId, E, A, I, isTruss, tensionOnly?, label? }
- **Load**: PointLoad | DistributedLoad | MomentLoad
- **SteelProfile**: { id, standard, profileClass, d, bf, tf, tw, A, Ix, Iy, Sx, E, Fy, ... }
- **SolverResult**: { success, nodeResults, reactions, memberResults, error? }

### Settings Store State

```ts
{
  projectName: string,
  engineerName: string,
  forceUnit: 'kN' | 'N' | 'tf',
  lengthUnit: 'm' | 'cm' | 'mm' | 'ft',
  stressUnit: 'MPa' | 'kPa' | 'tf/cm²' | 'ksc',
  defaultE: number,        // MPa
  defaultFy: number,       // MPa
  defaultA: number,        // mm²
  defaultI: number,        // mm⁴
  deformedScale: number    // 0-5000 (displayed as 0.0x-50.0x)
}
```

### LocalStorage Keys

- `structcalc_session` — node/member/load snapshots + structure type
- `structcalc_settings` — unit choices, project info, defaults

## FEM Solver Architecture

### Matrix Stiffness Method

File: `src/solver/index.ts`

**Steps:**
1. Assemble global stiffness matrix K (6×6 per member in frame, 3×3 in truss)
2. Assemble force vector F (from nodes, members, distributed loads)
3. Apply boundary conditions (fixed/pinned/roller supports)
4. Solve system: Kbc × d = Fbc (using mathjs lusolve)
5. Compute displacements, reactions, member end forces

### Iterative Solver for Tension-Only Members

When tension-only members are present:

```
For iteration = 0 to MAX_ITERATIONS (50):
  Filter active members (exclude removed ones)
  Assemble K, F with active members
  Solve Kd = F
  For each tension-only member:
    If N[0] < 0 (compression):
      Mark as removed
  If no new removals:
    Converged - add zero results for removed members
    Break
If not converged after MAX_ITERATIONS:
  Throw "Tension-only iteration did not converge" error
```

### Slack Member Handling

Tension-only members removed from solver get zero forces:

```ts
{
  memberId: string,
  stations: [0, 0.5, 1],
  N: [0, 0, 0],
  V: [0, 0, 0],
  M: [0, 0, 0],
  endForces: [0, 0, 0, 0, 0, 0],
}
```

This ensures:
- UI doesn't crash on missing member results
- Reports show slack members with no forces
- Design check shows PASS (UR_axial = 0)

### Supports

- **Fixed:** All 3 DOF constrained (frame: 6 DOF, 3 rotation angles)
- **Pinned:** Vertical & horizontal translation constrained, rotation free
- **Roller:** One axis constrained (with optional rollerAxis for 45° or custom angles)
- **Free:** No constraints (cantilever, free node)

### Frame vs Truss

- **Frame:** 6 DOF per node (ux, uy, θz + 3 reaction components Rx, Ry, Mz)
- **Truss:** 3 DOF per node (ux, uy only, no bending + 2 reaction components Rx, Ry)
