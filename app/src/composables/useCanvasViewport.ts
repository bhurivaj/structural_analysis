import { ref } from 'vue'

export interface Viewport {
  x: number
  y: number
  k: number
}

const viewport = ref<Viewport>({ x: 0, y: 0, k: 80 })
const snapToGrid = ref(false)

export function useCanvasViewport() {
  function setViewport(v: Viewport) {
    viewport.value = v
  }

  function screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - viewport.value.x) / viewport.value.k,
      y: -((sy - viewport.value.y) / viewport.value.k),
    }
  }

  function worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: wx * viewport.value.k + viewport.value.x,
      y: -wy * viewport.value.k + viewport.value.y,
    }
  }

  function toggleSnap() {
    snapToGrid.value = !snapToGrid.value
  }

  function snapPoint(x: number, y: number): { x: number; y: number } {
    if (!snapToGrid.value) return { x, y }
    return { x: Math.round(x), y: Math.round(y) }
  }

  return { viewport, setViewport, screenToWorld, worldToScreen, snapToGrid, toggleSnap, snapPoint }
}
