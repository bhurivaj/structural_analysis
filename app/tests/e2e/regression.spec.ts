import { test, expect } from '@playwright/test'

async function dismissResume(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  const btn = page.getByRole('button', { name: 'Start New' })
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click()
  }
}

async function waitForCanvas(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#structure-canvas canvas').waitFor({ state: 'attached', timeout: 8000 })
}

// Build a 3-node, 2-member structure using canvas position clicks
// Node positions: N1@(250,300), N2@(450,300), N3@(650,300)
// Member midpoints: M1@(350,300), M2@(550,300)
async function buildTwoMemberStructure(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.keyboard.press('n')
  await page.click('#structure-canvas', { position: { x: 250, y: 300 } })
  await page.waitForTimeout(80)
  await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
  await page.waitForTimeout(80)
  await page.click('#structure-canvas', { position: { x: 650, y: 300 } })
  await page.waitForTimeout(80)

  // Create M1: click N1@(250,300) → N2@(450,300)
  await page.keyboard.press('m')
  await page.click('#structure-canvas', { position: { x: 250, y: 300 } })
  await page.waitForTimeout(80)
  await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
  await page.waitForTimeout(80)

  // Create M2: click N2@(450,300) → N3@(650,300)
  await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
  await page.waitForTimeout(80)
  await page.click('#structure-canvas', { position: { x: 650, y: 300 } })
  await page.waitForTimeout(100)

  await page.keyboard.press('s')
  await page.waitForTimeout(150)
}

// Member midpoint positions for click-based selection
const MEMBER_MIDPOINTS = [
  { x: 350, y: 300 }, // M1 midpoint
  { x: 550, y: 300 }, // M2 midpoint
]

// ─── Bug 1: Multi-assign panel ───────────────────────────────────────────────

test.describe('Bug fix: multi-assign panel for member-only multi-select', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForCanvas(page)
    await dismissResume(page)
  })

  test('selecting a single member shows single-member panel', async ({ page }) => {
    await buildTwoMemberStructure(page)

    // Verify M1 and M2 labels appeared
    await expect(page.locator('span.font-mono').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })
    await expect(page.locator('span.font-mono').filter({ hasText: /^M2$/ })).toBeVisible({ timeout: 2000 })

    // Click M1 midpoint to select it
    await page.click('#structure-canvas', { position: MEMBER_MIDPOINTS[0] })
    await page.waitForTimeout(150)

    await page.getByRole('button', { name: 'Member', exact: true }).click()
    await expect(page.getByText('Delete Member')).toBeVisible()
    await expect(page.getByText('Members Selected')).not.toBeVisible()
  })

  test('selecting 2 members shows "2 Members Selected" bulk-assign panel', async ({ page }) => {
    await buildTwoMemberStructure(page)

    await expect(page.locator('span.font-mono').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })
    await expect(page.locator('span.font-mono').filter({ hasText: /^M2$/ })).toBeVisible({ timeout: 2000 })

    // Get canvas bounding box for absolute coords
    const box = await page.locator('#structure-canvas').boundingBox()

    // Click M1
    await page.mouse.click(box!.x + MEMBER_MIDPOINTS[0].x, box!.y + MEMBER_MIDPOINTS[0].y)
    await page.waitForTimeout(150)
    // Shift+click M2
    await page.keyboard.down('Shift')
    await page.mouse.click(box!.x + MEMBER_MIDPOINTS[1].x, box!.y + MEMBER_MIDPOINTS[1].y)
    await page.keyboard.up('Shift')
    await page.waitForTimeout(150)

    await page.getByRole('button', { name: 'Member', exact: true }).click()

    await expect(page.getByText('2 Members Selected')).toBeVisible()
    await expect(page.getByText('Assign Profile to All')).toBeVisible()
    await expect(page.getByRole('button', { name: /Apply to 2 Members/ })).toBeVisible()
  })

  test('multi-selecting 2+ nodes shows generic selection panel (not bulk-assign)', async ({ page }) => {
    await buildTwoMemberStructure(page)

    const box = await page.locator('#structure-canvas').boundingBox()

    // Click N1@(250,300) to select first node
    await page.mouse.click(box!.x + 250, box!.y + 300)
    await page.waitForTimeout(100)

    // Shift+click N2@(450,300)
    await page.keyboard.down('Shift')
    await page.mouse.click(box!.x + 450, box!.y + 300)
    await page.keyboard.up('Shift')
    await page.waitForTimeout(150)

    // multiSelectActive = true (2 nodes, 0 members) → generic Selection panel
    await expect(page.getByRole('button', { name: 'Delete Selected' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clear Selection' })).toBeVisible()
    await expect(page.getByText('Members Selected')).not.toBeVisible()
  })
})

// ─── Bug 2: Session resume dialog only on fresh start ────────────────────────

test.describe('Bug fix: session resume dialog only on fresh start', () => {
  test('resume dialog does not appear when navigating back from another page', async ({ page }) => {
    await page.goto('/workspace')
    await waitForCanvas(page)
    await dismissResume(page)

    // Place a node so structure is non-empty in memory
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(100)

    // Verify N1 label appeared
    await expect(page.locator('span.font-mono').filter({ hasText: /^N1$/ })).toBeVisible({ timeout: 2000 })

    // Navigate away and back
    await page.getByRole('link', { name: 'Analysis' }).click()
    await expect(page).toHaveURL('/analysis')
    await page.getByRole('link', { name: 'Workspace' }).click()
    await expect(page).toHaveURL('/workspace')

    // Resume dialog must NOT show — structure already in memory
    await expect(page.getByText('Resume Previous Work?')).not.toBeVisible()

    // Node label must still be present (data not reset)
    await expect(page.locator('span.font-mono').filter({ hasText: /^N1$/ })).toBeVisible({ timeout: 2000 })
  })

  test('resume dialog appears on fresh page load when localStorage has saved data', async ({ page }) => {
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
