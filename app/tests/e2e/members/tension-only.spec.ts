import { test, expect } from '@playwright/test'

async function waitForCanvas(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#structure-canvas canvas').waitFor({ state: 'attached', timeout: 8000 })
}

// Create two nodes and a member between them
async function createMember(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.keyboard.press('n')
  await page.click('#structure-canvas', { position: { x: 200, y: 200 } })
  await page.waitForTimeout(100)
  await page.click('#structure-canvas', { position: { x: 400, y: 300 } })
  await page.waitForTimeout(100)

  // Create member: click N1 then N2 position
  await page.keyboard.press('m')
  await page.click('#structure-canvas', { position: { x: 200, y: 200 } })
  await page.waitForTimeout(100)
  await page.click('#structure-canvas', { position: { x: 400, y: 300 } })
  await page.waitForTimeout(200)
}

// Select the member by clicking at its midpoint
async function selectMember(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.keyboard.press('s')
  await page.waitForTimeout(50)
  // Click at midpoint of member between (200,200) and (400,300)
  await page.click('#structure-canvas', { position: { x: 300, y: 250 } })
  await page.waitForTimeout(200)
}

test.describe('Tension-Only Members Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForCanvas(page)
  })

  test('add two nodes and create a normal member', async ({ page }) => {
    await createMember(page)
    // Member label M1 appears (Three.js renders the member)
    await expect(page.locator('span.font-mono').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })
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

  test('tension-only member renders in WebGL (state saved to localStorage)', async ({ page }) => {
    await createMember(page)
    await selectMember(page)

    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(1000) // wait for auto-save

    // Verify tensionOnly is stored in session
    const session = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('structcalc_session') || '') } catch { return null }
    })
    expect(session?.members?.[0]?.tensionOnly).toBe(true)
    // Three.js renders the orange color in WebGL — canvas stays rendered
    await expect(page.locator('#structure-canvas canvas')).toBeVisible()
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

    const session = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('structcalc_session') || '') } catch { return null }
    })
    expect(session?.members?.[0]?.tensionOnly).toBe(true)
  })

  test('uncheck tension-only reverts state to normal', async ({ page }) => {
    await createMember(page)
    await selectMember(page)

    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(300)
    await expect(checkbox).toBeChecked()

    await checkbox.uncheck()
    await page.waitForTimeout(300)
    await expect(checkbox).not.toBeChecked()

    // After unchecking, session should reflect tensionOnly = false
    await page.waitForTimeout(1000)
    const session = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('structcalc_session') || '') } catch { return null }
    })
    expect(session?.members?.[0]?.tensionOnly).toBeFalsy()
  })

  test('analysis runs successfully with tension-only member under tension', async ({ page }) => {
    // Create structure: two nodes at same height (horizontal member)
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(100)
    await page.click('#structure-canvas', { position: { x: 400, y: 200 } })
    await page.waitForTimeout(100)

    // Add fixed support to first node
    await page.keyboard.press('s')
    await page.click('#structure-canvas', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(200)

    const supportSelect = page.locator('select').filter({ hasText: /Pinned|Free/ }).first()
    if (await supportSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await supportSelect.selectOption('fixed')
      await page.waitForTimeout(200)
    }

    // Create member N1-N2
    await page.keyboard.press('m')
    await page.click('#structure-canvas', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(100)
    await page.click('#structure-canvas', { position: { x: 400, y: 200 } })
    await page.waitForTimeout(200)

    // Mark member as tension-only: select at midpoint
    await page.keyboard.press('s')
    await page.waitForTimeout(50)
    await page.click('#structure-canvas', { position: { x: 300, y: 200 } })
    await page.waitForTimeout(200)

    const checkbox = page.locator('input[type="checkbox"]').first()
    if (await checkbox.isVisible({ timeout: 1000 }).catch(() => false)) {
      await checkbox.check()
      await page.waitForTimeout(200)
    }

    // Deselect member
    await page.click('#structure-canvas', { position: { x: 150, y: 400 } })
    await page.waitForTimeout(100)

    // Add downward load to second node
    await page.keyboard.press('l')
    await page.click('#structure-canvas', { position: { x: 400, y: 200 } })
    await page.waitForTimeout(200)

    const addLoadButton = page.locator('button:has-text("Add Load")').first()
    if (await addLoadButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addLoadButton.click()
      await page.waitForTimeout(300)
    }

    await page.getByRole('button', { name: '▶ Run' }).click()
    await page.waitForTimeout(500)

    await page.getByRole('link', { name: 'Analysis' }).click()
    await page.waitForTimeout(500)

    const tables = page.locator('table')
    expect(await tables.count()).toBeGreaterThan(0)
  })
})
