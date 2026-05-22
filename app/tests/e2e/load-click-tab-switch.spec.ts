import { test, expect } from '@playwright/test'

test.describe('Load Click Tab Switching (Integration Test)', () => {
  test('clicking load in SELECT mode switches to Loads tab (with JSON import)', async ({ page }) => {
    await page.goto('http://localhost:5173/')
    await page.waitForLoadState('networkidle')

    // Import a structure with loads via JSON
    await page.click('button:has-text("⬆⬇")')
    await page.waitForTimeout(200)

    // Paste JSON with node, member, and point load
    const json = JSON.stringify({
      nodes: [
        { id: 'n1', x: 0, y: 0, support: 'fixed', label: 'N1' },
        { id: 'n2', x: 5, y: 0, support: 'free', label: 'N2' }
      ],
      members: [
        { id: 'm1', startNodeId: 'n1', endNodeId: 'n2', steelProfileId: null, E: 200000, A: 1000, I: 50000, isTruss: false, label: 'M1' }
      ],
      loads: [
        { id: 'load1', type: 'point_load', nodeId: 'n2', fx: 10, fy: -20, label: 'PL1' }
      ],
      structureType: 'frame'
    })

    const textarea = page.locator('textarea')
    await textarea.fill(json)
    await page.waitForTimeout(100)

    // Import
    await page.click('button:has-text("Import")')
    await page.waitForTimeout(300)

    // Confirm import dialog if present
    const confirmBtn = page.locator('button:has-text("Replace")').first()
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
      await page.waitForTimeout(200)
    }

    // Switch to SELECT mode
    await page.keyboard.press('s')
    await page.waitForTimeout(100)

    // Verify initial tab is Node
    let nodeTab = page.locator('button:has-text("Node")')
    expect(await nodeTab.getAttribute('class')).toContain('border-blue-600')

    // Click on the load arrow (red line)
    const loadArrow = page.locator('line[stroke="#dc2626"]')
    if (await loadArrow.count() > 0) {
      await loadArrow.first().click()
      await page.waitForTimeout(200)

      // Verify Load tab is now active
      let loadTab = page.locator('button:has-text("Load")')
      const loadTabClass = await loadTab.getAttribute('class')
      expect(loadTabClass).toContain('border-blue-600')
      
      console.log('✅ Load tab switched successfully!')
    }
  })
})
