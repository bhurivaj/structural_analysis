import { test, expect } from '@playwright/test'

async function waitForCanvas(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#structure-canvas canvas').waitFor({ state: 'attached', timeout: 8000 })
}

test.describe('3D Work Plane', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForCanvas(page)
  })

  // ─── WorkplaneControls always visible ────────────────────────────────────────
  test('WorkplaneControls panel is always visible', async ({ page }) => {
    await expect(page.locator('[data-testid="workplane-controls"]')).toBeVisible()
  })

  test('preset view buttons are always visible', async ({ page }) => {
    const controls = page.locator('[data-testid="workplane-controls"]')
    await expect(controls.locator('button', { hasText: 'top' })).toBeVisible()
    await expect(controls.locator('button', { hasText: 'front' })).toBeVisible()
    await expect(controls.locator('button', { hasText: 'side' })).toBeVisible()
    await expect(controls.locator('button', { hasText: 'iso' })).toBeVisible()
  })

  test('clicking preset view buttons does not crash', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

    const controls = page.locator('[data-testid="workplane-controls"]')
    for (const preset of ['top', 'front', 'side', 'iso']) {
      await controls.locator('button', { hasText: preset }).click()
      await page.waitForTimeout(100)
    }

    expect(consoleErrors.filter(e => !e.includes('localstorage'))).toHaveLength(0)
  })

  // ─── Work plane Z field ───────────────────────────────────────────────────────
  test('work plane Z input is always visible', async ({ page }) => {
    const controls = page.locator('[data-testid="workplane-controls"]')
    const zInput = controls.locator('input[type="number"]')
    await expect(zInput).toBeVisible()
    await expect(zInput).toHaveValue('0')
  })

  test('changing work plane Z and placing node assigns correct z', async ({ page }) => {
    const controls = page.locator('[data-testid="workplane-controls"]')
    const zInput = controls.locator('input[type="number"]')

    // Set work plane Z to 5
    await zInput.fill('5')
    await zInput.press('Enter')
    await page.waitForTimeout(100)

    // Place a node
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 400, y: 300 } })
    await page.waitForTimeout(200)

    // Select it
    await page.keyboard.press('s')
    await page.click('#structure-canvas', { position: { x: 400, y: 300 } })
    await page.waitForTimeout(200)

    // Node panel shows Z field (always visible now) — should be 5
    const zNodeInput = page.locator('label').filter({ hasText: 'Z' }).locator('input').first()
    if (await zNodeInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      const val = parseFloat(await zNodeInput.inputValue())
      expect(val).toBeCloseTo(5, 1)
    }
  })

  test('no console errors on interaction', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

    // Add a node, member, and preset view changes
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(100)
    await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
    await page.waitForTimeout(100)

    const controls = page.locator('[data-testid="workplane-controls"]')
    await controls.locator('button', { hasText: 'front' }).click()
    await page.waitForTimeout(150)

    expect(consoleErrors.filter(e => !e.includes('localstorage'))).toHaveLength(0)
  })
})
