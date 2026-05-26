import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasKeys } from '@/composables/useCanvasKeys'
import { useCanvasTool } from '@/composables/useCanvasTool'

function fireKey(code: string, key: string, opts: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, ...opts }))
}

function releaseKey(code: string, key: string) {
  document.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true }))
}

describe('useCanvasKeys', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const { setTool } = useCanvasTool()
    setTool('SELECT')
    // detach any leftover listeners
    useCanvasKeys().detach()
  })

  describe('tool shortcuts', () => {
    it('S sets SELECT tool', () => {
      const keys = useCanvasKeys()
      const tool = useCanvasTool()
      tool.setTool('ADD_NODE')
      keys.attach({ getScene: () => null, onEscape: () => {} })
      fireKey('KeyS', 's')
      expect(tool.activeTool.value).toBe('SELECT')
      keys.detach()
    })

    it('N sets ADD_NODE tool', () => {
      const keys = useCanvasKeys()
      const tool = useCanvasTool()
      keys.attach({ getScene: () => null, onEscape: () => {} })
      fireKey('KeyN', 'n')
      expect(tool.activeTool.value).toBe('ADD_NODE')
      keys.detach()
    })

    it('M sets ADD_MEMBER tool', () => {
      const keys = useCanvasKeys()
      const tool = useCanvasTool()
      keys.attach({ getScene: () => null, onEscape: () => {} })
      fireKey('KeyM', 'm')
      expect(tool.activeTool.value).toBe('ADD_MEMBER')
      keys.detach()
    })

    it('P sets PAN tool', () => {
      const keys = useCanvasKeys()
      const tool = useCanvasTool()
      keys.attach({ getScene: () => null, onEscape: () => {} })
      fireKey('KeyP', 'p')
      expect(tool.activeTool.value).toBe('PAN')
      keys.detach()
    })
  })

  describe('Space key', () => {
    it('Space keydown sets isSpaceHeld to true', () => {
      const keys = useCanvasKeys()
      keys.attach({ getScene: () => null, onEscape: () => {} })
      fireKey('Space', ' ')
      expect(keys.isSpaceHeld.value).toBe(true)
      keys.detach()
    })

    it('Space keyup sets isSpaceHeld to false', () => {
      const keys = useCanvasKeys()
      keys.attach({ getScene: () => null, onEscape: () => {} })
      fireKey('Space', ' ')
      releaseKey('Space', ' ')
      expect(keys.isSpaceHeld.value).toBe(false)
      keys.detach()
    })
  })

  describe('Escape key', () => {
    it('calls onEscape callback', () => {
      const keys = useCanvasKeys()
      const onEscape = vi.fn()
      keys.attach({ getScene: () => null, onEscape })
      fireKey('Escape', 'Escape')
      expect(onEscape).toHaveBeenCalledOnce()
      keys.detach()
    })
  })

  describe('input element guard', () => {
    it('ignores key events when target is HTMLInputElement', () => {
      const keys = useCanvasKeys()
      const tool = useCanvasTool()
      tool.setTool('SELECT')
      keys.attach({ getScene: () => null, onEscape: () => {} })

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }))
      document.body.removeChild(input)

      expect(tool.activeTool.value).toBe('SELECT')
      keys.detach()
    })
  })

  describe('detach', () => {
    it('stops responding to key events after detach', () => {
      const keys = useCanvasKeys()
      const tool = useCanvasTool()
      keys.attach({ getScene: () => null, onEscape: () => {} })
      keys.detach()
      tool.setTool('SELECT')
      fireKey('KeyN', 'n')
      expect(tool.activeTool.value).toBe('SELECT')
    })
  })
})
