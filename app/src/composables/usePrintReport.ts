export function usePrintReport() {
  function print() {
    window.print()
  }
  return { print }
}
