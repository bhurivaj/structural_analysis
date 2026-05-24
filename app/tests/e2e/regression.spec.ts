import { test, expect } from '@playwright/test'

async function dismissResume(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  const btn = page.getByRole('button', { name: 'Start New' })
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click()
  }
}

// Build a 3-node, 2-member structure using node locators for ADD_MEMBER
async function buildTwoMemberStructure(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.keyboard.press('n')
  await page.click('svg', { position: { x: 250, y: 300 } })
  await page.waitForTimeout(80)
  await page.click('svg', { position: { x: 450, y: 300 } })
  await page.waitForTimeout(80)
  await page.click('svg', { position: { x: 650, y: 300 } })
  await page.waitForTimeout(80)

  await page.keyboard.press('m')
  const nodes = page.locator('circle.node')
  await nodes.nth(0).click()
  await page.waitForTimeout(80)
  await nodes.nth(1).click()
  await page.waitForTimeout(80)
  await nodes.nth(1).click()
  await page.waitForTimeout(80)
  await nodes.nth(2).click()
  await page.waitForTimeout(100)

  await page.keyboard.press('s')
  await page.waitForTimeout(150)
}

// Get screen center coordinates of each member-hit element via getBoundingClientRect
// (member-hit has stroke:transparent so Playwright's boundingBox() may not detect it)
async function getMemberHitCenters(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never): Promise<{ x: number, y: number }[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('line.member-hit')).map(el => {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }),
  )
}

// ─── Bug 1: Multi-assign panel ───────────────────────────────────────────────

test.describe('Bug fix: multi-assign panel for member-only multi-select', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await dismissResume(page)
  })

  test('selecting a single member shows single-member panel', async ({ page }) => {
    await buildTwoMemberStructure(page)

    const [c0] = await getMemberHitCenters(page)
    await page.mouse.click(c0.x, c0.y)
    await page.waitForTimeout(150)

    await page.getByRole('button', { name: 'Member', exact: true }).click()
    await expect(page.getByText('Delete Member')).toBeVisible()
    await expect(page.getByText('Members Selected')).not.toBeVisible()
  })

  test('selecting 2 members shows "2 Members Selected" bulk-assign panel', async ({ page }) => {
    await buildTwoMemberStructure(page)

    // Verify 2 member-hit elements were created
    const centers = await getMemberHitCenters(page)
    expect(centers.length).toBe(2)

    // Click M1 then Shift+click M2 using actual screen coordinates
    await page.mouse.click(centers[0].x, centers[0].y)
    await page.waitForTimeout(150)
    await page.keyboard.down('Shift')
    await page.mouse.click(centers[1].x, centers[1].y)
    await page.keyboard.up('Shift')
    await page.waitForTimeout(150)

    await page.getByRole('button', { name: 'Member', exact: true }).click()

    await expect(page.getByText('2 Members Selected')).toBeVisible()
    await expect(page.getByText('Assign Profile to All')).toBeVisible()
    await expect(page.getByRole('button', { name: /Apply to 2 Members/ })).toBeVisible()
  })

  test('multi-selecting 2+ nodes shows generic selection panel (not bulk-assign)', async ({ page }) => {
    await buildTwoMemberStructure(page)

    // Click node 0 to select it
    const nodes = page.locator('circle.node')
    await nodes.nth(0).click()
    await page.waitForTimeout(100)

    // Shift+click node 1 — both nodes selected, no members — triggers generic panel
    await page.keyboard.down('Shift')
    await nodes.nth(1).click()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(150)

    // multiSelectActive = true (2 nodes, 0 members) → generic Selection panel
    // Verify the generic panel's buttons appear (not the member bulk-assign panel)
    await expect(page.getByRole('button', { name: 'Delete Selected' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clear Selection' })).toBeVisible()
    await expect(page.getByText('Members Selected')).not.toBeVisible()
  })
})

// ─── Bug 2: Session resume dialog only on fresh start ────────────────────────

test.describe('Bug fix: session resume dialog only on fresh start', () => {
  test('resume dialog does not appear when navigating back from another page', async ({ page }) => {
    await page.goto('/workspace')
    await dismissResume(page)

    // Place a node so structure is non-empty in memory
    await page.keyboard.press('n')
    await page.click('svg', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(100)

    // Navigate away and back
    await page.getByRole('link', { name: 'Analysis' }).click()
    await expect(page).toHaveURL('/analysis')
    await page.getByRole('link', { name: 'Workspace' }).click()
    await expect(page).toHaveURL('/workspace')

    // Resume dialog must NOT show — structure already in memory
    await expect(page.getByText('Resume Previous Work?')).not.toBeVisible()

    // Node must still be present (data not reset)
    await expect(page.locator('circle.node').first()).toBeVisible()
  })

  test('resume dialog appears on fresh page load when localStorage has saved data', async ({ page }) => {
    // Inject saved session before fresh navigation
    await page.goto('/workspace')
    await page.evaluate(() => {
      localStorage.setItem('structcalc_session', JSON.stringify({
        nodes: [{ id: 'n1', x: 0, y: 0, support: 'fixed', label: 'N1' }],
        members: [],
        structureType: 'frame',
        loads: [],
        savedAt: new Date().toISOString(),
      }))
    })

    // Fresh navigation — store is empty, localStorage has data → dialog must appear
    await page.goto('/workspace')
    await expect(page.getByText('Resume Previous Work?')).toBeVisible({ timeout: 3000 })
  })
})
