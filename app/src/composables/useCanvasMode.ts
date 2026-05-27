import { ref } from 'vue'

const workplaneZ = ref<number>(0)

export function useCanvasMode() {
  function setWorkplaneZ(z: number) {
    workplaneZ.value = z
  }
  return { workplaneZ, setWorkplaneZ }
}
