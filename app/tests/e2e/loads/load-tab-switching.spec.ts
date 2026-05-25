import { test, expect } from '@playwright/test'

async function waitForGrid(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#grid-layer line').first().waitFor({ state: 'attached', timeout: 5000 })
}

test.describe('Load Tab Auto-switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/')
    await page.waitForLoadState('networkidle')
    await waitForGrid(page)
  })

  test('clicking a point load switches to Loads tab', async ({ page }) => {
    // Add a node
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(100)

    // Add a point load via the tool
    await page.keyboard.press('l')
    const node = page.locator('circle.node').first()
    await node.click()
    await page.waitForTimeout(200)

    // The LoadPanel form should show now. Click "Add Load" with default values
    await page.click('button:has-text("Add Load")')
    await page.waitForTimeout(200)

    // Verify load appears on canvas (red arrow line)
    const loadArrow = page.locator('line[stroke="#dc2626"]')
    await loadArrow.waitFor({ state: 'attached', timeout: 5000 })

    // Switch to SELECT mode
    await page.keyboard.press('s')
    await page.waitForTimeout(100)

    // Click on the load arrow to select it (use force to bypass visibility check)
    await loadArrow.click({ force: true })
    await page.waitForTimeout(200)

    // The Load tab should now be active (show "Update Load" button instead of "Add Load")
    await expect(page.locator('button:has-text("Update Load")')).toBeVisible()
  })
})
