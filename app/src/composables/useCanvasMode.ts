import { ref } from 'vue'

const cameraMode = ref<'2d' | '3d'>('2d')
const workplaneZ = ref<number>(0)

export function useCanvasMode() {
  function setCameraMode(mode: '2d' | '3d') {
    cameraMode.value = mode
  }
  function setWorkplaneZ(z: number) {
    workplaneZ.value = z
  }
  return { cameraMode, setCameraMode, workplaneZ, setWorkplaneZ }
}
