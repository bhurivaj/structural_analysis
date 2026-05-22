# Design Assessment System — LRFD (AISC 360)

Detailed documentation of Load and Resistance Factor Design methodology, member capacity checks, and utilization ratio calculations.

## Overview

File: `src/utils/designCheck.ts`

Calculates per-member utilization ratios (UR) using Load and Resistance Factor Design (LRFD) methodology with resistance factors φ and AISC interaction formulas. Computes UR_axial, UR_bending, UR_shear, and UR_combined (max of bilinear interaction and shear).

## Key Calculations

### 1. Member Length

Computed from node coordinates (m → mm)

### 2. Axial Capacity (AISC E3 column curve)

**Compression:** Use LRFD column curve with KL/ry slenderness
  - If KL/ry ≤ 4.71√(E/Fy): Fcr = 0.658^(Fy/Fe) × Fy
  - Else: Fcr = 0.877 × Fe
  - φc×Pn = 0.9 × Fcr × A (N)

**Tension:** Direct yield
  - φt×Pn = 0.9 × Fy × A (N)

**UR_axial** = (|N|×1000) / (φ×Pn)

### 3. Flexural Capacity (AISC F2 with LTB)

- Compute ry = √(Iy/A) from profile (or √(I/A) for manual members)
- Compute Lp = 1.76 × ry × √(E/Fy) — limiting unbraced length for plastic behavior
- If Lb ≤ Lp: φb×Mn = 0.9 × Fy × Sx (zone 1: full elastic capacity)
- If Lb > Lp: φb×Mn = 0.63 × Fy × Sx (conservative lower bound at Lr)
  - Lb defaults to full member length (conservative assumption)

**UR_bending** = (|M|×1e6) / (φb×Mn)

### 4. Shear Capacity (AISC G2)

- Av = d × tw for I/H sections; else Av = 0.6 × A
- φv×Vn = 1.0 × 0.6 × Fy × Av (N)

**UR_shear** = (|V|×1000) / (φv×Vn)

### 5. LRFD Bilinear Interaction (H1-1)

- If UR_axial ≥ 0.2: UR_interaction = UR_axial + (8/9)×UR_bending (H1-1a)
- Else: UR_interaction = UR_axial/2 + UR_bending (H1-1b)

**UR_combined** = max(UR_interaction, UR_shear)

### 6. Tension-Only Members (Special Case)

For cables, slingsสลิง, hanger rods:

- Skip compression column buckling (AISC E3)
- Skip bending capacity check (AISC F2)
- Skip shear capacity check (AISC G2)
- **Only compute tensile axial:** φt×Pn = 0.9 × Fy × A
- **UR_combined** = UR_axial only (no interaction formula)

## Status Determination

- **PASS:** UR_combined < urMarginalThreshold (default 0.8)
- **MARGINAL:** urMarginalThreshold ≤ UR_combined < urFailThreshold (default 0.8–1.0)
- **FAIL:** UR_combined ≥ urFailThreshold (default 1.0)

## Suggestions

getSuggestion() in designCheck.ts provides Thai-language guidance per failure mode:

- If **PASS**: "โครงสร้างอยู่ในเกณฑ์ปลอดภัย" (within safe limits)
- If **MARGINAL**: "ใกล้ถึงขีดจำกัด — ตรวจสอบ load combination อื่นให้ดี" (near limit, check other combinations)
- If **FAIL (shear governs)**: "เพิ่ม web thickness (tw) หรือเลือก profile ที่มี area ใหญ่ขึ้น"
- If **FAIL (axial governs)**: "เพิ่ม Cross-section Area (A) หรือเลือกหน้าตัดที่ใหญ่ขึ้น"
- If **FAIL (bending governs)**: "เลือกหน้าตัด H-beam หรือ profile ที่มี Sx สูงกว่า"

## Display

Component: `src/components/analysis/DesignAssessmentPanel.vue`

Table shows: Member | Profile | UR_axial | UR_bending | UR_shear | UR_combined | Status | Suggestion

- UR values color-coded: green (< 1.0), red (≥ 1.0)
- Status icons: ✓ (PASS), ⚠ (MARGINAL), ✗ (FAIL)
- Summary line: "X/Y members pass"

## Utility Function Reference

### performDesignCheck()

Located at `src/utils/designCheck.ts`

**Function:** `performDesignCheck(memberResults, members, nodes, steelProfiles, defaultFy)`

**Output:** Array of `DesignCheckResult` per member:

```ts
{
  memberId: string,
  memberLabel: string,
  profileId: string | null,
  profileName?: string,
  UR_axial: number,      // Utilization ratio: axial
  UR_bending: number,    // Utilization ratio: bending
  UR_shear: number,      // Utilization ratio: shear
  UR_combined: number,   // Sum of axial + bending
  status: 'PASS' | 'MARGINAL' | 'FAIL',
  suggestion: string     // Thai-language improvement hint
}
```

### Conversion Factors

- **UR_axial:** |N_max| × 1000 / (A × Fy)
  - N in kN, A in mm², Fy in MPa
  - kN→N: ×1000; result in N/mm² = MPa

- **UR_bending:** |M_max| × 1e6 / (Sx × Fy)
  - M in kN·m, Sx in mm³, Fy in MPa
  - kN·m→N·mm: ×1e6; result in N/mm² = MPa

## Bug Fixes: Unit Reflection

### Issue

Changing unit settings in Settings modal did NOT update values displayed on canvas or in analysis tables.

### Root Causes & Fixes

**1. Canvas Force Labels (StructureCanvas.vue)**
- **Was:** hardcoded `.text(\`${mag.toFixed(1)} kN\`)`
- **Now:** `.text(\`${settings.toForce(mag).toFixed(1)} ${settings.forceUnit}\`)`

**2. Canvas Watch Array (StructureCanvas.vue)**
- **Was:** watch array did not include `settings.forceUnit` or `settings.lengthUnit`
- **Now:** Added both to dependency list → canvas redraws on unit change

**3. Member End Forces Conversion (AnalysisView.vue, ReportView.vue)**
- **Was:** loop condition `idx % 3 === 1` only converted shear force (V); skipped axial (N) and moment (M)
- **Now:** `idx % 3 === 2 ? settings.toMoment(v) : settings.toForce(v)` converts all indices

**4. Reaction Moment Conversion (ReactionTable.vue, ReportView.vue)**
- **Was:** used `settings.toForce()` for moment values (wrong conversion factor)
- **Now:** uses `settings.toMoment()` (applies both force and length unit conversion)

**5. Load Values in Report (ReportView.vue)**
- **Was:** hardcoded `" kN"`, `" kN/m"`, `" kN·m"` with no value conversion
- **Now:** uses `settings.toForce()`, `settings.distForceLabel`, `settings.toMoment()` with proper formatting

**6. New Method: settingsStore.toMoment()**
- Converts moment from internal kN·m to display unit (e.g., N·cm, tf·m, etc.)
- Formula: `toForce(kNm) * toLength(1)`
- Exported in settingsStore return object
