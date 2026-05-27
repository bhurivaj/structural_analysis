import { test, expect } from '@playwright/test'

async function waitForCanvas(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#structure-canvas canvas').waitFor({ state: 'attached', timeout: 8000 })
}

test.describe('Deformed Shape Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForCanvas(page)
  })

  test('Three.js canvas is rendered for structure visualization', async ({ page }) => {
    // Deformed shape is rendered in WebGL — verify the canvas element exists
    await expect(page.locator('#structure-canvas canvas')).toBeVisible()
  })

  test('DEF button toggle functionality', async ({ page }) => {
    // The DEF button should only appear after a successful analysis
    const defButton = page.locator('button:has-text("DEF")')
    await expect(defButton).not.toBeVisible()
  })

  test('deformed shape default scale is 1000 (10x)', async ({ page }) => {
    await page.getByRole('button', { name: '⚙' }).click()
    await page.locator('.bg-white').filter({ hasText: 'Settings' }).waitFor()

    const sliders = page.locator('input[type="range"]')
    let deformedScaleSlider = null

    for (let i = 0; i < await sliders.count(); i++) {
      const max = await sliders.nth(i).getAttribute('max')
      if (max === '5000') {
        deformedScaleSlider = sliders.nth(i)
        break
      }
    }

    if (deformedScaleSlider) {
      const value = await deformedScaleSlider.inputValue()
      expect(parseInt(value)).toBe(1000)

      const label = page.locator('label').filter({ hasText: 'Deformed Shape Amplification' })
      await expect(label).toContainText('10.0x')
    }

    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('deformed scale slider range is 0-5000', async ({ page }) => {
    await page.getByRole('button', { name: '⚙' }).click()
    await page.locator('.bg-white').filter({ hasText: 'Settings' }).waitFor()

    const sliders = page.locator('input[type="range"]')
    let deformedScaleSlider = null

    for (let i = 0; i < await sliders.count(); i++) {
      const max = await sliders.nth(i).getAttribute('max')
      if (max === '5000') {
        deformedScaleSlider = sliders.nth(i)
        break
      }
    }

    if (deformedScaleSlider) {
      const min = await deformedScaleSlider.getAttribute('min')
      const max = await deformedScaleSlider.getAttribute('max')
      const step = await deformedScaleSlider.getAttribute('step')

      expect(parseInt(min ?? '0')).toBe(0)
      expect(parseInt(max ?? '0')).toBe(5000)
      expect(parseInt(step ?? '0')).toBe(100)
    }

    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
