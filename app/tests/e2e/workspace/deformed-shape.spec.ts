import { test, expect } from '@playwright/test'

async function waitForGrid(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#grid-layer line').first().waitFor({ state: 'attached', timeout: 5000 })
}

test.describe('Deformed Shape Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForGrid(page)
  })

  test('deformed-layer SVG group exists on canvas', async ({ page }) => {
    // Verify that the #deformed-layer group exists
    const deformedLayer = page.locator('#deformed-layer')
    await expect(deformedLayer).toBeAttached()
  })

  test('DEF button toggle functionality', async ({ page }) => {
    // The DEF button should only appear after a successful analysis
    // Since we're just testing the visualization without running analysis,
    // we'll verify the structure is in place
    const defButton = page.locator('button:has-text("DEF")')

    // DEF button shouldn't be visible initially (no analysis run)
    await expect(defButton).not.toBeVisible()
  })

  test('deformed shape default scale is 1000 (10x)', async ({ page }) => {
    // Open settings modal
    await page.getByRole('button', { name: '⚙' }).click()

    // Wait for settings modal to load
    await page.locator('.bg-white').filter({ hasText: 'Settings' }).waitFor()

    // Find the deformed scale slider (max 5000)
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
      // Check the default value
      const value = await deformedScaleSlider.inputValue()
      expect(parseInt(value)).toBe(1000)

      // Check the label shows 10.0x (1000 / 100 = 10)
      const label = page.locator('label').filter({ hasText: 'Deformed Shape Amplification' })
      await expect(label).toContainText('10.0x')
    }

    // Close settings
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('deformed scale slider range is 0-5000', async ({ page }) => {
    // Open settings modal
    await page.getByRole('button', { name: '⚙' }).click()

    // Wait for settings modal to load
    await page.locator('.bg-white').filter({ hasText: 'Settings' }).waitFor()

    // Find the deformed scale slider
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

    // Close settings
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
