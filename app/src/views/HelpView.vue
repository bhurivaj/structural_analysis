<script setup lang="ts">
const shortcuts = [
  { key: 'S', action: 'SELECT mode' },
  { key: 'P', action: 'PAN mode' },
  { key: 'N', action: 'Add Node' },
  { key: 'M', action: 'Add Member' },
  { key: 'L', action: 'Add Point Load' },
  { key: 'D', action: 'Add Distributed Load' },
  { key: 'R', action: 'Add Moment' },
  { key: 'G', action: 'Toggle grid snap' },
  { key: 'F', action: 'Fit structure to view' },
  { key: 'Delete / Backspace', action: 'Delete selected element(s)' },
  { key: 'Escape', action: 'Cancel pending action' },
  { key: 'Space (hold)', action: 'Temporary pan mode' },
  { key: 'Ctrl+Z', action: 'Undo' },
  { key: 'Ctrl+Shift+Z / Ctrl+Y', action: 'Redo' },
]

const lrfdCombos = [
  { name: 'Service', formula: '1.0D + 1.0L' },
  { name: '1.4D', formula: '1.4D' },
  { name: '1.2D + 1.6L', formula: '1.2D + 1.6L' },
  { name: '1.2D + 1.0W + 1.0L', formula: '1.2D + 1.0W + 1.0L' },
  { name: '0.9D + 1.0W', formula: '0.9D + 1.0W' },
]

const sections = [
  { id: 'start', label: 'Getting Started' },
  { id: 'nav', label: 'Canvas Navigation' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts' },
  { id: 'structure', label: 'Defining Structure' },
  { id: 'profiles', label: 'Steel Profiles' },
  { id: 'loads', label: 'Applying Loads' },
  { id: 'combos', label: 'Load Combinations' },
  { id: 'analysis', label: 'Running Analysis' },
  { id: 'envelope', label: 'Envelope Analysis' },
  { id: 'design', label: 'Design Assessment' },
  { id: 'importexport', label: 'Import / Export' },
  { id: 'report', label: 'Print Report' },
  { id: 'tips', label: 'Tips & Workflows' },
]
</script>

<template>
  <div class="flex h-full overflow-hidden bg-white">
    <!-- Sidebar nav -->
    <aside class="w-52 shrink-0 border-r border-slate-200 overflow-y-auto py-4 px-3 bg-slate-50">
      <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">Contents</p>
      <nav class="space-y-0.5">
        <a
          v-for="s in sections"
          :key="s.id"
          :href="`#${s.id}`"
          class="block px-2 py-1 text-sm text-slate-600 rounded hover:bg-slate-200 hover:text-slate-900 transition-colors"
        >{{ s.label }}</a>
      </nav>
    </aside>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto px-10 py-8 max-w-3xl">
      <h1 class="text-2xl font-bold text-slate-800 mb-1">StructCalc User Guide</h1>
      <p class="text-sm text-slate-500 mb-8">Quick reference for structural modeling, analysis, and design.</p>

      <!-- Getting Started -->
      <section id="start" class="mb-10">
        <h2 class="section-heading">Getting Started</h2>
        <p class="text-sm text-slate-600 mb-2">Open the app at <code class="code">http://localhost:5173</code>. The <strong>Workspace</strong> is your main modeling canvas.</p>
        <ol class="list-decimal list-inside text-sm text-slate-600 space-y-1 ml-1">
          <li>Set units: click <strong>⚙ Settings</strong> (top-right navbar) → choose Force / Length / Stress units</li>
          <li>Enter project name and engineer name in Settings (used in the printed report)</li>
          <li>Start placing nodes on the canvas with the <strong>N</strong> key</li>
        </ol>
        <p class="text-sm text-slate-500 mt-2">If you have a previous session, a <em>Resume Session</em> dialog appears on fresh load.</p>
      </section>

      <!-- Canvas Navigation -->
      <section id="nav" class="mb-10">
        <h2 class="section-heading">Canvas Navigation</h2>
        <table class="data-table">
          <thead><tr><th>Action</th><th>How</th></tr></thead>
          <tbody>
            <tr><td>Pan</td><td>Scroll-wheel drag, Middle-mouse drag, or Space+drag</td></tr>
            <tr><td>Zoom</td><td>Scroll wheel (up = zoom in)</td></tr>
            <tr><td>Fit to view</td><td><strong>⊡ Fit</strong> button in left sidebar, or press <strong>F</strong></td></tr>
            <tr><td>Toggle grid snap</td><td>Press <strong>G</strong></td></tr>
          </tbody>
        </table>
        <p class="text-sm text-slate-500 mt-2">The crosshair at world (0, 0) marks the origin. Grid lines adapt to zoom level automatically.</p>
      </section>

      <!-- Keyboard Shortcuts -->
      <section id="shortcuts" class="mb-10">
        <h2 class="section-heading">Keyboard Shortcuts</h2>
        <table class="data-table">
          <thead><tr><th>Key</th><th>Action</th></tr></thead>
          <tbody>
            <tr v-for="s in shortcuts" :key="s.key">
              <td><kbd class="kbd">{{ s.key }}</kbd></td>
              <td>{{ s.action }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Defining Structure -->
      <section id="structure" class="mb-10">
        <h2 class="section-heading">Defining Your Structure</h2>

        <h3 class="sub-heading">Nodes</h3>
        <p class="help-text">Press <kbd class="kbd">N</kbd> → click canvas to place nodes. Nodes auto-label N1, N2, … Rename in the right panel after selecting.</p>
        <p class="help-text mt-1">Hold <kbd class="kbd">Shift</kbd> while dragging a node to snap to the nearest grid position.</p>

        <h3 class="sub-heading">Members</h3>
        <p class="help-text">Press <kbd class="kbd">M</kbd> → click start node → click end node. Press <kbd class="kbd">Escape</kbd> to cancel. Members auto-label M1, M2, …</p>
        <p class="help-text mt-1">To reconnect endpoints: SELECT a single member → drag the white circle handles at each end to a different node.</p>

        <h3 class="sub-heading">Supports</h3>
        <p class="help-text">SELECT a node → choose Support type in the right panel:</p>
        <ul class="list-disc list-inside text-sm text-slate-600 space-y-1 ml-2 mt-1">
          <li><strong>None</strong> — free node</li>
          <li><strong>Pinned</strong> — restrained Fx, Fy (triangle symbol)</li>
          <li><strong>Fixed</strong> — restrained Fx, Fy, M (bar symbol)</li>
          <li><strong>Roller</strong> — restrained in one direction; choose X-axis or Y-axis</li>
        </ul>

        <h3 class="sub-heading">Structure Type</h3>
        <p class="help-text">Use the <strong>Type</strong> dropdown in the left sidebar: <em>Frame</em> (axial + shear + moment) or <em>Truss</em> (axial only — moment loads blocked).</p>
      </section>

      <!-- Steel Profiles -->
      <section id="profiles" class="mb-10">
        <h2 class="section-heading">Steel Profiles</h2>
        <p class="help-text mb-2">374 TIS 1228 profiles available: H, I, Channel, Angle, RHS, Square Tube, Round Pipe, Wide Flange, Light Lip Channel.</p>
        <ol class="list-decimal list-inside text-sm text-slate-600 space-y-1 ml-1">
          <li>Navigate to <strong>Steel Profiles</strong> page to browse and filter by class</li>
          <li>In Workspace, SELECT a member → pick profile from the dropdown in the right panel</li>
          <li><strong>Bulk assign:</strong> Select 2+ members → "Apply to N Members" button</li>
        </ol>
      </section>

      <!-- Loads -->
      <section id="loads" class="mb-10">
        <h2 class="section-heading">Applying Loads</h2>

        <h3 class="sub-heading">Point Load (L)</h3>
        <p class="help-text">Press <kbd class="kbd">L</kbd> → click a node → enter Fx, Fy → choose load case (D/L/W/E/S) → Add Load.</p>

        <h3 class="sub-heading">Distributed Load (D)</h3>
        <p class="help-text">Press <kbd class="kbd">D</kbd> → click a member → enter w1 (start) and w2 (end) — set equal for uniform load → choose direction and load case → Add Load.</p>

        <h3 class="sub-heading">Moment (R)</h3>
        <p class="help-text">Press <kbd class="kbd">R</kbd> (Frame only) → click a node → enter magnitude (+ = CCW) → Add Load.</p>

        <h3 class="sub-heading">Self-weight</h3>
        <p class="help-text">Click <strong>⚖ Self-weight</strong> in left sidebar. Generates Dead loads automatically from assigned member profiles using <code class="code">w = mass × 9.81 / 1000 kN/m</code>. Idempotent — safe to re-click.</p>

        <h3 class="sub-heading">Editing Loads</h3>
        <p class="help-text">In SELECT mode, click any load arrow on canvas → right panel pre-fills for editing → click Update Load or Delete.</p>
      </section>

      <!-- Combinations -->
      <section id="combos" class="mb-10">
        <h2 class="section-heading">Load Cases &amp; Combinations</h2>
        <p class="help-text mb-2">Open the <strong>Combo</strong> tab in the right panel. Pick one combination as <em>active</em> — all Run and Design Check results use its factors.</p>
        <table class="data-table">
          <thead><tr><th>Preset</th><th>Formula</th></tr></thead>
          <tbody>
            <tr v-for="c in lrfdCombos" :key="c.name">
              <td>{{ c.name }}</td>
              <td><code class="code">{{ c.formula }}</code></td>
            </tr>
          </tbody>
        </table>
        <p class="help-text mt-2">Add custom combinations with any D/L/W/E/S factors via the "Add Combination" button.</p>
      </section>

      <!-- Analysis -->
      <section id="analysis" class="mb-10">
        <h2 class="section-heading">Running Analysis</h2>
        <p class="help-text">Click <strong>▶ Run</strong> in the left sidebar. The solver assembles the stiffness matrix, applies factored loads from the active combination, and solves for displacements, reactions, and member forces.</p>
        <p class="help-text mt-2">Results appear in the <strong>Analysis</strong> page: Diagrams (N/V/M), Reactions, Displacements, Member End Forces, and Design Assessment tabs.</p>
        <p class="help-text mt-2">Toggle <strong>DEF</strong> in the Analysis diagrams view to see the deformed shape (amplification adjustable in Settings, 0.0x–50.0x).</p>
      </section>

      <!-- Envelope -->
      <section id="envelope" class="mb-10">
        <h2 class="section-heading">Envelope Analysis</h2>
        <p class="help-text">Click <strong>⊛ Envelope</strong> in the left sidebar to run all load combinations in one pass and find worst-case forces per member.</p>
        <ul class="list-disc list-inside text-sm text-slate-600 space-y-1 ml-2 mt-2">
          <li>Design Assessment shows <strong>Envelope</strong> toggle — each member row shows which combination governed (indigo badge)</li>
          <li>DiagramPanel also has Envelope toggle — shows min/max band across all combinations</li>
          <li>Auto-size All uses envelope forces when in envelope mode</li>
        </ul>
      </section>

      <!-- Design Assessment -->
      <section id="design" class="mb-10">
        <h2 class="section-heading">Design Assessment (LRFD)</h2>
        <p class="help-text mb-2">AISC 360 LRFD utilization ratios per member — visible in the Analysis page Design Assessment tab.</p>
        <table class="data-table">
          <thead><tr><th>Column</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td>UR Axial</td><td>Axial force / axial capacity (φPn) — compression column curve, tension φt·Fy</td></tr>
            <tr><td>UR Bending</td><td>Moment / flexural capacity (φMn) with LTB check</td></tr>
            <tr><td>UR Shear</td><td>Shear / shear capacity (φVn = 0.6·Fy·Av)</td></tr>
            <tr><td>UR Combined</td><td>H1-1 interaction — governs design; color-coded PASS/MARGINAL/FAIL</td></tr>
          </tbody>
        </table>
        <p class="help-text mt-2">Click <strong>▼</strong> on any member row to expand <em>Alternatives</em> — browse other profiles in the same class, switch to Graph tab for D3 bar chart view, and click Apply to swap instantly.</p>
        <p class="help-text mt-2">Click <strong>⚡ Auto-size All</strong> (shown when FAIL/MARGINAL members exist) to auto-assign the lightest passing profile to each failing member.</p>
      </section>

      <!-- Import/Export -->
      <section id="importexport" class="mb-10">
        <h2 class="section-heading">Import / Export</h2>
        <p class="help-text">Click <strong>Import</strong> in the navbar (top-right) to open the Import/Export modal.</p>
        <ul class="list-disc list-inside text-sm text-slate-600 space-y-1 ml-2 mt-2">
          <li><strong>Export:</strong> downloads current session as a <code class="code">.json</code> file</li>
          <li><strong>Import by paste:</strong> paste JSON text directly into the text area</li>
          <li><strong>Import by file:</strong> click "Choose file" and select a <code class="code">.json</code> export file</li>
        </ul>
        <p class="help-text mt-2">A confirmation dialog appears before replacing the current session.</p>
      </section>

      <!-- Report -->
      <section id="report" class="mb-10">
        <h2 class="section-heading">Print Report</h2>
        <p class="help-text mb-2">Navigate to <strong>Report</strong> — a print-ready A4 document is generated automatically from the last analysis run.</p>
        <p class="help-text">Sections: Project header · Structure diagram · Summary · Design criteria · Nodes & Members · Steel profiles · Applied loads · Load combinations · Reactions · Displacements · Member end forces · Design Assessment (LRFD).</p>
        <p class="help-text mt-2">Use browser <strong>Print</strong> (Ctrl+P) → Save as PDF or print directly.</p>
      </section>

      <!-- Tips -->
      <section id="tips" class="mb-10">
        <h2 class="section-heading">Tips &amp; Common Workflows</h2>

        <h3 class="sub-heading">Simple beam</h3>
        <ol class="list-decimal list-inside text-sm text-slate-600 space-y-1 ml-1">
          <li>Place 2 nodes (N) at (0,0) and (5,0)</li>
          <li>Draw 1 member (M) between them</li>
          <li>Left node = Pinned, right node = Roller (Y-axis)</li>
          <li>Assign a steel profile</li>
          <li>Add distributed load (D) w1=w2=10 kN/m, Dead case</li>
          <li>Set combo to 1.2D+1.6L, click Run</li>
          <li>Check Design Assessment</li>
        </ol>

        <h3 class="sub-heading">Multi-story frame</h3>
        <ol class="list-decimal list-inside text-sm text-slate-600 space-y-1 ml-1">
          <li>Place nodes at each floor level, draw columns and beams</li>
          <li>Pin/Fix base nodes</li>
          <li>Bulk-select columns → assign column profile; same for beams</li>
          <li>Add self-weight + live loads per floor</li>
          <li>Run Envelope Analysis to find critical combination per member</li>
        </ol>

        <h3 class="sub-heading">Tension-only brace (cable/rod)</h3>
        <ol class="list-decimal list-inside text-sm text-slate-600 space-y-1 ml-1">
          <li>Draw diagonal member</li>
          <li>SELECT it → check <strong>Tension-Only</strong> in MemberPanel — shown as dashed orange</li>
          <li>Solver removes it automatically if compression develops and re-solves</li>
        </ol>
      </section>

      <div class="border-t border-slate-200 pt-4 mt-4">
        <p class="text-xs text-slate-400">For detailed architectural notes see <code class="code">docs/CANVAS_ARCHITECTURE.md</code>, <code class="code">docs/DESIGN_SYSTEM.md</code>, and <code class="code">docs/FEATURES.md</code>.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.section-heading {
  @apply text-base font-semibold text-slate-800 mb-3 pb-1 border-b border-slate-200;
}
.sub-heading {
  @apply text-sm font-semibold text-slate-700 mt-4 mb-1;
}
.help-text {
  @apply text-sm text-slate-600;
}
.data-table {
  @apply w-full text-sm border-collapse;
}
.data-table th {
  @apply text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-1 pr-4;
}
.data-table td {
  @apply py-1.5 pr-4 text-slate-700 border-b border-slate-100 align-top;
}
.code {
  @apply font-mono text-xs bg-slate-100 text-slate-700 px-1 py-0.5 rounded;
}
.kbd {
  @apply font-mono text-xs bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded;
}
</style>
