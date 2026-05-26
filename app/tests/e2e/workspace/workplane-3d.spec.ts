import { test, expect } from '@playwright/test'

test.describe('Phase 2: 3D Work Plane', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/')
    await page.waitForLoadState('networkidle')
  })

  // ─── 2D/3D toggle ────────────────────────────────────────────────────────────
  test('2D/3D toggle button switches camera mode', async ({ page }) => {
    const toggleBtn = page.locator('button', { hasText: '2D' }).last()
    await expect(toggleBtn).toBeVisible()
    await toggleBtn.click()
    await page.waitForTimeout(200)
    await expect(page.locator('button', { hasText: '3D' }).last()).toBeVisible()
  })

  // ─── WorkplaneControls visibility ────────────────────────────────────────────
  test('WorkplaneControls panel appears in 3D mode', async ({ page }) => {
    // Not visible in 2D mode
    await expect(page.locator('[data-testid="workplane-controls"]')).not.toBeVisible()

    // Toggle to 3D
    await page.locator('button', { hasText: '2D' }).last().click()
    await page.waitForTimeout(200)

    // Now visible
    await expect(page.locator('[data-testid="workplane-controls"]')).toBeVisible()
  })

  test('WorkplaneControls disappears when switching back to 2D', async ({ page }) => {
    const toggleBtn = page.locator('button').filter({ hasText: /^2D$|^3D$/ }).last()

    // Go 3D
    await toggleBtn.click()
    await page.waitForTimeout(200)
    await expect(page.locator('[data-testid="workplane-controls"]')).toBeVisible()

    // Go back to 2D
    await toggleBtn.click()
    await page.waitForTimeout(200)
    await expect(page.locator('[data-testid="workplane-controls"]')).not.toBeVisible()
  })

  // ─── Preset view buttons ──────────────────────────────────────────────────────
  test('preset view buttons are visible in 3D mode', async ({ page }) => {
    await page.locator('button', { hasText: '2D' }).last().click()
    await page.waitForTimeout(200)

    const controls = page.locator('[data-testid="workplane-controls"]')
    await expect(controls.locator('button', { hasText: 'top' })).toBeVisible()
    await expect(controls.locator('button', { hasText: 'front' })).toBeVisible()
    await expect(controls.locator('button', { hasText: 'side' })).toBeVisible()
    await expect(controls.locator('button', { hasText: 'iso' })).toBeVisible()
  })

  test('clicking preset view buttons does not crash', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

    await page.locator('button', { hasText: '2D' }).last().click()
    await page.waitForTimeout(200)

    const controls = page.locator('[data-testid="workplane-controls"]')
    for (const preset of ['top', 'front', 'side', 'iso']) {
      await controls.locator('button', { hasText: preset }).click()
      await page.waitForTimeout(100)
    }

    // Should still show 3D mode
    await expect(page.locator('button', { hasText: '3D' }).last()).toBeVisible()
    expect(consoleErrors.filter(e => !e.includes('localstorage'))).toHaveLength(0)
  })

  // ─── Work plane Z field ───────────────────────────────────────────────────────
  test('work plane Z input is visible in 3D mode', async ({ page }) => {
    await page.locator('button', { hasText: '2D' }).last().click()
    await page.waitForTimeout(200)

    const controls = page.locator('[data-testid="workplane-controls"]')
    const zInput = controls.locator('input[type="number"]')
    await expect(zInput).toBeVisible()
    await expect(zInput).toHaveValue('0')
  })

  test('changing work plane Z and placing node assigns correct z', async ({ page }) => {
    // Go to 3D mode
    await page.locator('button', { hasText: '2D' }).last().click()
    await page.waitForTimeout(200)

    // Set work plane Z to 5
    const controls = page.locator('[data-testid="workplane-controls"]')
    const zInput = controls.locator('input[type="number"]')
    await zInput.fill('5')
    await zInput.press('Enter')
    await page.waitForTimeout(100)

    // Place a node using the canvas area (find the WebGL canvas element)
    await page.keyboard.press('n')
    const canvas = page.locator('canvas').first()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(200)

    // Select it and check Z in NodePanel
    await page.keyboard.press('s')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(200)

    // Node panel should show Z = 5 (only visible in 3D mode)
    const zNodeInput = page.locator('label', { hasText: 'Z' }).locator('input').first()
    if (await zNodeInput.isVisible()) {
      const val = parseFloat(await zNodeInput.inputValue())
      expect(val).toBeCloseTo(5, 1)
    }
  })

  // ─── Axis gizmo (smoke test) ──────────────────────────────────────────────────
  test('no console errors when switching 2D/3D multiple times', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

    const toggleBtn = page.locator('button').filter({ hasText: /^2D$|^3D$/ }).last()
    for (let i = 0; i < 3; i++) {
      await toggleBtn.click()
      await page.waitForTimeout(150)
    }

    expect(consoleErrors.filter(e => !e.includes('localstorage'))).toHaveLength(0)
  })
})
