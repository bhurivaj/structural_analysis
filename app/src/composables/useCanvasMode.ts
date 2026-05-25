import { ref } from 'vue'

const cameraMode = ref<'2d' | '3d'>('2d')

export function useCanvasMode() {
  function setCameraMode(mode: '2d' | '3d') {
    cameraMode.value = mode
  }
  return { cameraMode, setCameraMode }
}
