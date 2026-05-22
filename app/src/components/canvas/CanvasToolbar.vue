<script setup lang="ts">
import { useCanvasTool, type CanvasTool } from '@/composables/useCanvasTool'
import { useCanvasViewport } from '@/composables/useCanvasViewport'

const { activeTool, setTool } = useCanvasTool()
const { snapToGrid, toggleSnap } = useCanvasViewport()

const tools: { id: CanvasTool; label: string; name: string; key: string }[] = [
  { id: 'SELECT',         label: '↖',  name: 'Select / Move', key: 'S' },
  { id: 'PAN',            label: '✋',  name: 'Pan',           key: 'P' },
  { id: 'ADD_NODE',       label: '●',  name: 'Add Node',      key: 'N' },
  { id: 'ADD_MEMBER',     label: '╱',  name: 'Add Member',    key: 'M' },
  { id: 'ADD_POINT_LOAD', label: '↓F', name: 'Point Load',    key: 'L' },
  { id: 'ADD_DIST_LOAD',  label: '▤',  name: 'Dist. Load',    key: 'D' },
  { id: 'ADD_MOMENT',     label: '↻',  name: 'Moment',        key: 'R' },
]
</script>

<template>
  <div class="flex flex-col gap-1 p-1 bg-white border border-slate-200 rounded shadow">
    <div v-for="tool in tools" :key="tool.id" class="relative group">
      <button
        class="w-9 h-9 rounded text-sm font-mono transition-colors"
        :class="activeTool === tool.id
          ? 'bg-blue-600 text-white'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
        @click="setTool(tool.id)"
      >
        {{ tool.label }}
      </button>

      <!-- Tooltip -->
      <div
        class="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2
               flex items-center gap-1.5 px-2 py-1
               bg-slate-800 text-white text-xs rounded shadow-lg
               opacity-0 group-hover:opacity-100
               transition-opacity duration-100 whitespace-nowrap z-50"
      >
        {{ tool.name }}
        <kbd class="px-1 py-0.5 bg-slate-600 text-slate-200 rounded text-xs font-mono leading-none">
          {{ tool.key }}
        </kbd>
      </div>
    </div>

    <hr class="border-slate-200 my-1">

    <!-- Snap to Grid toggle -->
    <div class="relative group">
      <button
        class="w-9 h-9 rounded text-sm font-mono transition-colors"
        :class="snapToGrid
          ? 'bg-blue-600 text-white'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
        @click="toggleSnap"
      >
        ⊞
      </button>

      <!-- Tooltip -->
      <div
        class="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2
               flex items-center gap-1.5 px-2 py-1
               bg-slate-800 text-white text-xs rounded shadow-lg
               opacity-0 group-hover:opacity-100
               transition-opacity duration-100 whitespace-nowrap z-50"
      >
        Snap to Grid
        <kbd class="px-1 py-0.5 bg-slate-600 text-slate-200 rounded text-xs font-mono leading-none">
          G
        </kbd>
      </div>
    </div>
  </div>
</template>
