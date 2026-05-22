import { test, expect } from '@playwright/test'

async function waitForGrid(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#grid-layer line').first().waitFor({ state: 'attached', timeout: 5000 })
}

test.describe('Tension-Only Members Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForGrid(page)
  })

  test('add two nodes and create a normal member', async ({ page }) => {
    // Click on canvas to add node A at (100, 100)
    await page.click('button:has-text("N")')
    await page.click('svg', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(200)

    // Add node B at (300, 200)
    await page.click('svg', { position: { x: 400, y: 300 } })
    await page.waitForTimeout(200)

    // Switch to ADD_MEMBER tool
    await page.click('button:has-text("M")')

    // Click node A then node B to create member
    const circles = page.locator('circle.node')
    await circles.nth(0).click()
    await page.waitForTimeout(100)
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    // Verify member exists on canvas
    const memberLines = page.locator('line.member')
    expect(await memberLines.count()).toBeGreaterThanOrEqual(1)
  })

  test('toggle tension-only checkbox in MemberPanel', async ({ page }) => {
    // Create a simple structure first
    await page.click('button:has-text("N")')
    await page.click('svg', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(100)
    await page.click('svg', { position: { x: 400, y: 300 } })
    await page.waitForTimeout(100)

    // Create member
    await page.click('button:has-text("M")')
    const circles = page.locator('circle.node')
    await circles.nth(0).click()
    await page.waitForTimeout(100)
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    // Switch to SELECT mode and click member
    await page.click('button:has-text("S")')
    const memberLines = page.locator('line.member')
    await memberLines.first().click()
    await page.waitForTimeout(200)

    // Find and check the tension-only checkbox
    const checkbox = page.locator('input[type="checkbox"]').filter({ hasText: /tension-only/i }).first()
    await expect(checkbox).toBeVisible()
    await checkbox.check()
    await page.waitForTimeout(200)

    // Verify checkbox is now checked
    await expect(checkbox).toBeChecked()
  })

  test('tension-only member displays as dashed orange line', async ({ page }) => {
    // Create a structure
    await page.click('button:has-text("N")')
    await page.click('svg', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(100)
    await page.click('svg', { position: { x: 400, y: 300 } })
    await page.waitForTimeout(100)

    // Create member
    await page.click('button:has-text("M")')
    const circles = page.locator('circle.node')
    await circles.nth(0).click()
    await page.waitForTimeout(100)
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    // Switch to SELECT and click member
    await page.click('button:has-text("S")')
    const memberLines = page.locator('line.member')
    await memberLines.first().click()
    await page.waitForTimeout(200)

    // Check the tension-only checkbox
    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(300)

    // Verify member line changed to orange and dashed
    const member = page.locator('line.member').first()
    const stroke = await member.getAttribute('stroke')
    const dasharray = await member.getAttribute('stroke-dasharray')

    // Orange color: #f97316 (or close to it)
    expect(stroke).toMatch(/#f97316|rgb\(249,\s*115,\s*22\)/i)
    // Should have dasharray for dashed effect
    expect(dasharray).toBeTruthy()
  })

  test('warning message appears when tension-only is checked', async ({ page }) => {
    // Create a structure
    await page.click('button:has-text("N")')
    await page.click('svg', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(100)
    await page.click('svg', { position: { x: 400, y: 300 } })
    await page.waitForTimeout(100)

    // Create member
    await page.click('button:has-text("M")')
    const circles = page.locator('circle.node')
    await circles.nth(0).click()
    await page.waitForTimeout(100)
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    // Switch to SELECT and click member
    await page.click('button:has-text("S")')
    const memberLines = page.locator('line.member')
    await memberLines.first().click()
    await page.waitForTimeout(200)

    // Warning should not be visible initially
    let warningBox = page.locator('text=/Member รับได้เฉพาะแรงดึง/')
    await expect(warningBox).not.toBeVisible()

    // Check tension-only checkbox
    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(200)

    // Warning should now be visible
    warningBox = page.locator('text=/Member รับได้เฉพาะแรงดึง/')
    await expect(warningBox).toBeVisible()
  })

  test('tension-only member persists in JSON export/import', async ({ page }) => {
    // Create a structure with tension-only member
    await page.click('button:has-text("N")')
    await page.click('svg', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(100)
    await page.click('svg', { position: { x: 400, y: 300 } })
    await page.waitForTimeout(100)

    await page.click('button:has-text("M")')
    const circles = page.locator('circle.node')
    await circles.nth(0).click()
    await page.waitForTimeout(100)
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    // Check tension-only
    await page.click('button:has-text("S")')
    const memberLines = page.locator('line.member')
    await memberLines.first().click()
    await page.waitForTimeout(200)

    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(200)

    // Export JSON
    await page.click('button:has-text("⬆⬇")')
    await page.waitForTimeout(300)

    const exportButton = page.locator('button:has-text("Download JSON")')
    await expect(exportButton).toBeVisible()

    // Get the textarea content
    const textarea = page.locator('textarea').first()
    const jsonText = await textarea.inputValue()

    // Verify JSON contains tensionOnly flag
    expect(jsonText).toContain('"tensionOnly":true')

    // Verify it can be parsed
    const jsonData = JSON.parse(jsonText)
    expect(jsonData.members).toBeDefined()
    expect(jsonData.members.length).toBeGreaterThan(0)
  })

  test('uncheck tension-only reverts to normal member appearance', async ({ page }) => {
    // Create and toggle to tension-only
    await page.click('button:has-text("N")')
    await page.click('svg', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(100)
    await page.click('svg', { position: { x: 400, y: 300 } })
    await page.waitForTimeout(100)

    await page.click('button:has-text("M")')
    const circles = page.locator('circle.node')
    await circles.nth(0).click()
    await page.waitForTimeout(100)
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    await page.click('button:has-text("S")')
    const memberLines = page.locator('line.member')
    await memberLines.first().click()
    await page.waitForTimeout(200)

    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(300)

    // Get orange stroke
    let member = page.locator('line.member').first()
    let stroke = await member.getAttribute('stroke')
    expect(stroke).toMatch(/#f97316/)

    // Uncheck
    await checkbox.uncheck()
    await page.waitForTimeout(300)

    // Verify reverted to grey
    member = page.locator('line.member').first()
    stroke = await member.getAttribute('stroke')
    expect(stroke).toMatch(/#475569/) // grey color
  })

  test('analysis runs successfully with tension-only member under tension', async ({ page }) => {
    // Create structure: fixed node -- cable -- free node with downward load
    await page.click('button:has-text("N")')
    await page.click('svg', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(100)
    await page.click('svg', { position: { x: 400, y: 200 } })
    await page.waitForTimeout(100)

    // Add support to first node
    await page.click('button:has-text("S")')
    const circle = page.locator('circle.node').first()
    await circle.click()
    await page.waitForTimeout(200)

    // Find support dropdown in right panel
    const supportSelect = page.locator('select').filter({ hasText: /support|pinned/ }).first()
    if (await supportSelect.isVisible()) {
      await supportSelect.selectOption('pinned')
      await page.waitForTimeout(200)
    }

    // Create cable member
    await page.click('button:has-text("M")')
    const circles = page.locator('circle.node')
    await circles.nth(0).click()
    await page.waitForTimeout(100)
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    // Mark as tension-only
    await page.click('button:has-text("S")')
    const memberLines = page.locator('line.member')
    await memberLines.first().click()
    await page.waitForTimeout(200)

    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(200)

    // Add downward load to second node
    await page.click('button:has-text("L")')
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    // Set load value (input for Fy)
    const inputs = page.locator('input[type="number"]')
    if (await inputs.count() > 0) {
      await inputs.nth(0).fill('-10')
      await page.waitForTimeout(100)
    }

    // Add load button
    const addLoadButton = page.locator('button:has-text("Add Load")').first()
    await addLoadButton.click()
    await page.waitForTimeout(300)

    // Run analysis
    const runButton = page.locator('button:has-text("Run")').first()
    await expect(runButton).toBeVisible()
    await runButton.click()
    await page.waitForTimeout(500)

    // Verify success (Analysis tab should show results)
    const analysisLink = page.locator('a:has-text("Analysis")').first()
    await expect(analysisLink).toBeVisible()
    await analysisLink.click()
    await page.waitForTimeout(500)

    // Verify tables are visible (sign of successful analysis)
    const tables = page.locator('table')
    expect(await tables.count()).toBeGreaterThan(0)
  })
})
