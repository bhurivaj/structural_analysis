import { test, expect } from '@playwright/test'

async function waitForGrid(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#grid-layer line').first().waitFor({ state: 'attached', timeout: 5000 })
}

// Create two nodes and a member between them (nodes at (200,200) and (400,300))
async function createMember(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.keyboard.press('n')
  await page.click('svg', { position: { x: 200, y: 200 } })
  await page.waitForTimeout(100)
  await page.click('svg', { position: { x: 400, y: 300 } })
  await page.waitForTimeout(100)
  await page.keyboard.press('m')
  const circles = page.locator('circle.node')
  await circles.nth(0).click()
  await page.waitForTimeout(100)
  await circles.nth(1).click()
  await page.waitForTimeout(200)
}

// Select the member by clicking at its midpoint in SVG coordinates
async function selectMember(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.keyboard.press('s')
  await page.waitForTimeout(50)
  // Click at midpoint of member between (200,200) and (400,300)
  await page.click('svg', { position: { x: 300, y: 250 } })
  await page.waitForTimeout(200)
}

test.describe('Tension-Only Members Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForGrid(page)
  })

  test('add two nodes and create a normal member', async ({ page }) => {
    await page.keyboard.press('n')
    await page.click('svg', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(200)
    await page.click('svg', { position: { x: 400, y: 300 } })
    await page.waitForTimeout(200)

    await page.keyboard.press('m')
    const circles = page.locator('circle.node')
    await circles.nth(0).click()
    await page.waitForTimeout(100)
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    const memberLines = page.locator('line.member')
    expect(await memberLines.count()).toBeGreaterThanOrEqual(1)
  })

  test('toggle tension-only checkbox in MemberPanel', async ({ page }) => {
    await createMember(page)
    await selectMember(page)

    const checkbox = page.locator('input[type="checkbox"]').first()
    await expect(checkbox).toBeVisible()
    await checkbox.check()
    await page.waitForTimeout(200)

    await expect(checkbox).toBeChecked()
  })

  test('tension-only member displays as dashed orange line', async ({ page }) => {
    await createMember(page)
    await selectMember(page)

    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(300)

    const member = page.locator('line.member').first()
    const stroke = await member.getAttribute('stroke')
    const dasharray = await member.getAttribute('stroke-dasharray')

    expect(stroke).toMatch(/#f97316|rgb\(249,\s*115,\s*22\)/i)
    expect(dasharray).toBeTruthy()
  })

  test('warning message appears when tension-only is checked', async ({ page }) => {
    await createMember(page)
    await selectMember(page)

    let warningBox = page.locator('text=/Member รับได้เฉพาะแรงดึง/')
    await expect(warningBox).not.toBeVisible()

    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(200)

    warningBox = page.locator('text=/Member รับได้เฉพาะแรงดึง/')
    await expect(warningBox).toBeVisible()
  })

  test('tension-only member persists in JSON export/import', async ({ page }) => {
    await createMember(page)
    await selectMember(page)

    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(1000) // wait for auto-save (800ms debounce)

    // Verify tensionOnly is persisted in the auto-saved session
    const session = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('structcalc_session') || '') } catch { return null }
    })
    expect(session?.members?.[0]?.tensionOnly).toBe(true)
  })

  test('uncheck tension-only reverts to normal member appearance', async ({ page }) => {
    await createMember(page)
    await selectMember(page)

    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(300)

    let member = page.locator('line.member').first()
    let stroke = await member.getAttribute('stroke')
    expect(stroke).toMatch(/#f97316/)

    await checkbox.uncheck()
    await page.waitForTimeout(300)

    // Deselect member so it shows the default (non-selected) color
    await page.click('svg', { position: { x: 150, y: 400 } })
    await page.waitForTimeout(200)

    member = page.locator('line.member').first()
    stroke = await member.getAttribute('stroke')
    expect(stroke).toMatch(/#475569/)
  })

  test('analysis runs successfully with tension-only member under tension', async ({ page }) => {
    // Create structure: two nodes at same height (horizontal member)
    await page.keyboard.press('n')
    await page.click('svg', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(100)
    await page.click('svg', { position: { x: 400, y: 200 } })
    await page.waitForTimeout(100)

    // Add support (pinned) to first node
    await page.keyboard.press('s')
    const circle = page.locator('circle.node').first()
    await circle.click()
    await page.waitForTimeout(200)

    const supportSelect = page.locator('select').filter({ hasText: /Pinned/ }).first()
    if (await supportSelect.isVisible()) {
      await supportSelect.selectOption('fixed')
      await page.waitForTimeout(200)
    }

    // Create member
    await page.keyboard.press('m')
    const circles = page.locator('circle.node')
    await circles.nth(0).click()
    await page.waitForTimeout(100)
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    // Mark as tension-only — click at midpoint of horizontal member
    await page.keyboard.press('s')
    await page.waitForTimeout(50)
    await page.click('svg', { position: { x: 300, y: 200 } })
    await page.waitForTimeout(200)

    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(200)

    // Click canvas to deselect member, clear ep-handles, and restore keyboard focus
    await page.click('svg', { position: { x: 150, y: 400 } })
    await page.waitForTimeout(100)

    // Add downward load to second node
    await page.keyboard.press('l')
    await page.waitForTimeout(50)
    await circles.nth(1).click()
    await page.waitForTimeout(200)

    // Use default load values: Fx=0, Fy=-10 kN downward
    // A vertical load on a horizontal frame member creates bending, not axial compression,
    // so the tension-only member stays in the analysis (axial ≈ 0)

    const addLoadButton = page.locator('button:has-text("Add Load")').first()
    await addLoadButton.click()
    await page.waitForTimeout(300)

    const runButton = page.locator('button:has-text("Run")').first()
    await expect(runButton).toBeVisible()
    await runButton.click()
    await page.waitForTimeout(500)

    const analysisLink = page.locator('a:has-text("Analysis")').first()
    await expect(analysisLink).toBeVisible()
    await analysisLink.click()
    await page.waitForTimeout(500)

    const tables = page.locator('table')
    expect(await tables.count()).toBeGreaterThan(0)
  })
})
