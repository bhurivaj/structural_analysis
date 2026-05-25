# StructCalc — User Guide

A quick-start guide for structural engineers using StructCalc to model, analyze, and design 2D frame/truss structures.

---

## 1. Getting Started

Open the app at `http://localhost:5173`. The **Workspace** is your main modeling canvas.

**First-time flow:**
1. Set units: click **⚙ Settings** (top-right) → choose Force / Length / Stress units
2. Enter project name and engineer name in Settings (used in the printed report)
3. Start placing nodes on the canvas

If you have a previous session, a **Resume Session** dialog appears on fresh load — click Resume to restore it, or Discard to start clean.

---

## 2. Workspace Layout

```
┌─────────────────────────────────────────────────────┐
│  Navbar: StructCalc | Workspace | Steel Profiles |  │
│          Analysis | Report          [Import] [⚙]   │
├──────┬──────────────────────────────────┬───────────┤
│ Tool │                                  │  Right    │
│ bar  │         Canvas                   │  Panel    │
│      │                                  │  (Node /  │
│      │                                  │  Member / │
│      │                                  │  Load /   │
│ Undo │                                  │  Combo)   │
│ Redo │                                  │           │
│ Fit  │                                  │           │
│ Run  │                                  │           │
└──────┴──────────────────────────────────┴───────────┘
```

- **Left sidebar:** Tool selector, structure type, Undo/Redo/Fit/Run buttons
- **Canvas:** Interactive drawing area
- **Right panel:** Context-sensitive — changes based on selected element or active tool

---

## 3. Canvas Navigation

| Action | How |
|--------|-----|
| Pan | Scroll wheel drag, Middle-mouse drag, or Space+drag (any mode) |
| Zoom | Scroll wheel (up = zoom in) |
| Fit to view | Click **⊡ Fit** button, or press **F** |
| Toggle grid snap | Press **G** |

The origin crosshair marks world coordinate (0, 0). Grid lines appear at regular intervals and adapt to zoom level.

---

## 4. Keyboard Shortcuts

| Key | Tool / Action |
|-----|---------------|
| **S** | SELECT mode |
| **P** | PAN mode |
| **N** | Add Node |
| **M** | Add Member |
| **L** | Add Point Load |
| **D** | Add Distributed Load |
| **R** | Add Moment |
| **G** | Toggle snap-to-grid |
| **F** | Fit structure to view |
| **Delete / Backspace** | Delete selected element(s) |
| **Escape** | Cancel pending action (e.g. member drawing) |
| **Space (hold)** | Temporary pan mode |
| **Ctrl+Z** | Undo |
| **Ctrl+Shift+Z** or **Ctrl+Y** | Redo |

---

## 5. Defining Your Structure

### 5.1 Place Nodes

1. Press **N** (or click the Node tool)
2. Click on the canvas to place a node
3. Nodes auto-label as N1, N2, …
4. To rename: click the node (SELECT mode) → edit label in right panel

**Snap options:**
- Enable grid snap (G) to snap nodes to integer world units
- Hold **Shift** while dragging a node to snap to nearest grid position

### 5.2 Draw Members

1. Press **M** (or click the Member tool)
2. Click the **start node** — a dashed preview line follows your cursor
3. Click the **end node** to create the member
4. Press **Escape** to cancel mid-draw

Members auto-label as M1, M2, …

**Reconnect endpoints:** Select a single member in SELECT mode → drag the white circle handles at each end to a different node.

### 5.3 Assign Supports

1. Press **S** (SELECT), click a node
2. In the **Node panel** (right), choose Support type:
   - **None** — free node
   - **Pinned** — restrained Fx, Fy (triangle symbol on canvas)
   - **Fixed** — restrained Fx, Fy, M (bar symbol on canvas)
   - **Roller** — restrained in one direction; choose **X-axis** or **Y-axis**

### 5.4 Structure Type

Use the **Type** dropdown in the left sidebar:
- **Frame** — members carry axial, shear, and moment forces
- **Truss** — members carry axial forces only; moment loads are blocked

---

## 6. Steel Profiles

### 6.1 Browse Profiles

Navigate to **Steel Profiles** page — shows all 374 TIS 1228 profiles:
- H-Sections, I-Sections, Channels, Angles, RHS, Square Tubes, Round Pipes, Wide Flange, Light Lip Channel

Filter by class using the dropdown. Click any row to see cross-section properties.

### 6.2 Assign to Members

1. SELECT a member (or multiple members) on the Workspace canvas
2. In the **Member panel** (right), pick a profile from the dropdown
3. **Bulk assign:** Select 2+ members → MemberPanel shows bulk profile selector + "Apply to N Members" button

### 6.3 Remove Profile

In the Member panel, click **Remove Profile** to clear the assignment (member falls back to default E/A/I section properties).

---

## 7. Applying Loads

### 7.1 Point Load

1. Press **L**
2. Click a node — the right panel pre-fills the node field
3. Enter **Fx** and **Fy** components (in selected force unit)
4. Choose load case: Dead (D), Live (L), Wind (W), Seismic (E), or Snow (S)
5. Click **Add Load**

### 7.2 Distributed Load

1. Press **D**
2. Click a member — right panel pre-fills the member field
3. Enter **w1** (start intensity) and **w2** (end intensity) — set both equal for uniform load
4. Choose **direction**: global X, global Y, or local (along member axis)
5. Choose load case, then click **Add Load**

Distributed loads render on the canvas with perpendicular arrows and intensity labels.

### 7.3 Moment Load

1. Press **R** (only available in Frame structures)
2. Click a node — right panel pre-fills
3. Enter moment magnitude (positive = counter-clockwise)
4. Choose load case, then click **Add Load**

### 7.4 Self-weight

Click **⚖ Self-weight** in the left sidebar — automatically generates downward distributed Dead loads for all members with assigned steel profiles.

- Formula: `w = profile.mass × 9.81 / 1000 kN/m`
- Idempotent: re-clicking removes old self-weight loads and regenerates fresh ones
- Members without profiles are skipped

### 7.5 Edit / Delete Loads

In SELECT mode, click a load arrow on the canvas → right panel switches to Load tab with the load pre-filled for editing. Click **Update Load** to save, or **Delete** to remove.

---

## 8. Load Cases & Combinations

Click the **Combo** tab in the right panel to manage load combinations.

### 8.1 Pre-defined LRFD Combinations

| Name | Formula |
|------|---------|
| Service | 1.0D + 1.0L |
| 1.4D | 1.4D |
| 1.2D + 1.6L | 1.2D + 1.6L |
| 1.2D + 1.0W + 1.0L | 1.2D + 1.0W + 1.0L |
| 0.9D + 1.0W | 0.9D + 1.0W |

### 8.2 Custom Combinations

In the Combo tab, click **Add Combination** — enter a name and custom factors for each load case.

### 8.3 Active Combination

Select any combination to make it **active**. The active combo name appears above the Run button. All subsequent **Run** and **Design Check** results use the active combo's factors.

---

## 9. Running Analysis

Click **▶ Run** (left sidebar) or press the Run button after modeling is complete.

**The solver:**
1. Assembles the global stiffness matrix
2. Applies factored loads from the active load combination
3. Solves Kd = F for displacements
4. Computes reactions and member end forces

Results appear in the **Analysis** page automatically after a successful run.

**Iterative solver for tension-only members:** If a structure has cable/rod members (marked Tension-Only in MemberPanel), the solver iterates — removing members with compression and re-solving until convergence.

---

## 10. Envelope Analysis

Click **⊛ Envelope** in the left sidebar to run all load combinations in a single pass and find the worst-case forces per member.

- Results available in Analysis → DesignAssessmentPanel via the **Envelope** toggle button
- Each member row shows a badge indicating which combination governed
- Envelope N/V/M diagrams available in DiagramPanel with the Envelope toggle

---

## 11. Analysis Page

Navigate to **Analysis** after running the solver.

### Tabs

| Tab | Content |
|-----|---------|
| **Diagrams** | Interactive N/V/M force diagrams — select a member, toggle N/V/M |
| **Reactions** | Support reactions table (Fx, Fy, Mz per node) |
| **Displacements** | Nodal displacements (ux, uy, θz per node) |
| **Member Forces** | End forces per member (N, Vz, My at start and end) |
| **Design Assessment** | LRFD utilization ratios per member |

### Deformed Shape

Click **DEF** button in the Analysis diagrams view to overlay the deformed shape (dashed blue lines). Adjust amplification in Settings (0.0x – 50.0x).

---

## 12. Design Assessment (LRFD)

The **Design Assessment** table shows per-member utilization ratios under AISC 360 LRFD.

| Column | Description |
|--------|-------------|
| Member | Member label |
| Profile | Assigned steel profile |
| UR Axial | Axial force / axial capacity (φPn) |
| UR Bending | Bending / flexural capacity (φMn) |
| UR Shear | Shear / shear capacity (φVn) |
| UR Combined | H1-1 interaction (governs design) |
| Status | PASS / MARGINAL / FAIL |

**Color coding:** Green = PASS, Yellow = MARGINAL, Red = FAIL (thresholds set in Settings).

### Alternative Profiles

Click **▼** on any member row to expand the **Alternatives** panel:
- Shows other profiles in the same class sorted by mass
- Switch between **Table** (UR values) and **Graph** (D3 bar chart with color zones) views
- Click **Apply** to swap to a different profile instantly

### Auto-size All

Click **⚡ Auto-size All** (shown only when FAIL/MARGINAL members exist) — automatically finds the lightest passing profile for each failing member. Re-run analysis to confirm results.

---

## 13. Import / Export

Click **Import** in the navbar (top-right) to open the Import/Export modal.

### Export

Click **Export JSON** — downloads the current session as a `.json` file containing all nodes, members, loads, and settings.

### Import

Two methods:
1. **Paste JSON** — paste JSON text directly into the text area
2. **Upload file** — click "Choose file" and select a `.json` export file

A confirmation dialog appears before replacing the current session.

---

## 14. Print Report

Navigate to **Report** — a print-ready document is generated automatically.

**Report sections:**
1. Project header (name, engineer, units, code reference)
2. Structure diagram (SVG snapshot from last analysis run)
3. Structure summary (type, node/member/load counts, pass/fail summary)
4. Design criteria (AISC 360 φ values, LRFD thresholds)
5. Nodes & Members tables
6. Steel Profile Parameters
7. Applied Loads (with load case labels)
8. Load Combinations table
9. Reactions, Displacements, Member End Forces
10. Design Assessment (LRFD) with color-coded status

Use browser **Print** (Ctrl+P) and select **Save as PDF** or send to printer. The report is optimized for A4 paper.

---

## 15. Tips & Common Workflows

### Simple beam

1. Place 2 nodes (N key) — e.g. at (0,0) and (5,0)
2. Draw 1 member (M key) between them
3. Set left node = Pinned, right node = Roller (Y-axis)
4. Assign a steel profile
5. Add distributed load (D key), w1=w2=10 kN/m downward, Dead case
6. Set combo to "1.2D+1.6L", click Run
7. Check Design Assessment

### Multi-story frame

1. Place nodes at each floor level
2. Draw columns (vertical members) and beams (horizontal members)
3. Pin/Fix base nodes
4. Assign profiles (bulk-select columns → assign column profile; same for beams)
5. Add self-weight + live loads per floor
6. Run Envelope Analysis to find critical combo per member

### Cable/tension-only brace

1. Draw diagonal member
2. SELECT it → check **Tension-Only** in MemberPanel
3. Member shown in dashed orange on canvas
4. Solver automatically removes it if compression develops and re-solves

---

## 16. Settings Reference

Click **⚙** in the navbar.

| Setting | Options |
|---------|---------|
| Force unit | kN / N / tf |
| Length unit | m / cm / mm / ft |
| Stress unit | MPa / kPa / tf/cm² / ksc |
| Project name | Free text (appears in report) |
| Engineer name | Free text (appears in report) |
| Default E | Elastic modulus for members without profile (kN/m²) |
| Default Fy | Yield stress (MPa) |
| Default A | Cross-section area (m²) |
| Default I | Moment of inertia (m⁴) |
| Deformed scale | 0.0x – 50.0x amplification for deformed shape display |
| UR Marginal | Upper bound for MARGINAL status (default 1.0) |
| UR Fail | Threshold for FAIL status (default 1.0) |

All settings persist to localStorage and apply immediately to canvas, tables, and report.
