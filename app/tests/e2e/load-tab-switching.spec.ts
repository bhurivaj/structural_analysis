import { test, expect } from '@playwright/test'

test.describe('Load Tab Auto-switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/')
    await page.waitForLoadState('networkidle')
  })

  test('clicking a point load in SELECT mode switches to Loads tab', async ({ page }) => {
    // Add node
    await page.keyboard.press('n')
    await page.click('svg', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(100)

    // Add point load via ADD_POINT_LOAD tool
    await page.keyboard.press('l')
    const node = page.locator('circle.node').first()
    await node.click()
    await page.waitForTimeout(100)

    // Click "Add Load" button in LoadPanel
    await page.click('button:has-text("Add Load")')
    await page.waitForTimeout(100)

    // Verify load appears on canvas (red arrow)
    const loadArrow = page.locator('line[stroke="#dc2626"]')
    await expect(loadArrow).toBeVisible()

    // Switch to SELECT mode
    await page.keyboard.press('s')
    await page.waitForTimeout(50)

    // Default tab should be "Node"
    let nodeTab = page.locator('button:has-text("Node")')
    let nodeTabActive = await nodeTab.getAttribute('class')
    expect(nodeTabActive).toContain('border-blue-600')

    // Click the load arrow
    await loadArrow.click()
    await page.waitForTimeout(100)

    // Loads tab should now be active
    let loadTab = page.locator('button:has-text("Load")')
    let loadTabActive = await loadTab.getAttribute('class')
    expect(loadTabActive).toContain('border-blue-600')

    // Form should show load data
    let fxInput = page.locator('input[placeholder="0"]').first()
    await expect(fxInput).toBeVisible()
  })
})
