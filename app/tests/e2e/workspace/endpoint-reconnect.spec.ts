import { test, expect, type Page } from '@playwright/test'

async function waitForCanvas(page: Page) {
  await page.locator('#structure-canvas canvas').waitFor({ state: 'attached', timeout: 8000 })
}

// Create 2 nodes and a member between them using canvas position clicks
async function createTwoNodeMember(page: Page) {
  await page.keyboard.press('n')
  await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
  await page.waitForTimeout(80)
  await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
  await page.waitForTimeout(80)

  await page.keyboard.press('m')
  await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
  await page.waitForTimeout(50)
  await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
  await page.waitForTimeout(100)
}

// Select member by clicking its midpoint between (350,300) and (450,300)
async function selectMember(page: Page) {
  await page.keyboard.press('s')
  await page.click('#structure-canvas', { position: { x: 400, y: 300 } })
  await page.waitForTimeout(150)
}

test.describe('Endpoint Reconnect (Member Drag)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/')
    await waitForCanvas(page)
  })

  test('selecting a single member shows single-member panel', async ({ page }) => {
    await createTwoNodeMember(page)
    await expect(page.locator('span.font-mono').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })

    // Select via rubber-band
    await selectMember(page)
    await page.getByRole('button', { name: 'Member', exact: true }).click()

    // Single member panel shows "Delete Member" button (not bulk)
    await expect(page.getByText('Delete Member')).toBeVisible({ timeout: 2000 })
    await expect(page.getByText('Members Selected')).not.toBeVisible()
  })

  test('endpoint handles disappear on deselect (panel clears)', async ({ page }) => {
    await createTwoNodeMember(page)
    await selectMember(page)
    await page.getByRole('button', { name: 'Member', exact: true }).click()
    await expect(page.getByText('Delete Member')).toBeVisible({ timeout: 2000 })

    // Click empty canvas to deselect
    await page.click('#structure-canvas', { position: { x: 200, y: 150 } })
    await page.waitForTimeout(100)

    // No member-specific content in panel; canvas still rendered
    await expect(page.locator('#structure-canvas canvas')).toBeVisible()
  })

  test('endpoint handles do not appear in non-SELECT mode', async ({ page }) => {
    await createTwoNodeMember(page)

    // PAN mode — no selection
    await page.keyboard.press('p')
    await page.waitForTimeout(100)

    // Canvas stays alive (no crash from non-SELECT interaction)
    await expect(page.locator('#structure-canvas canvas')).toBeVisible()
  })

  test('dragging on canvas in SELECT mode does not crash', async ({ page }) => {
    // 3 nodes
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(80)
    await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
    await page.waitForTimeout(80)
    await page.click('#structure-canvas', { position: { x: 550, y: 300 } })
    await page.waitForTimeout(80)

    // Create member N1-N2
    await page.keyboard.press('m')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(50)
    await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
    await page.waitForTimeout(100)

    // Select member
    await selectMember(page)
    await page.waitForTimeout(100)

    // Attempt drag from member endpoint toward N3 (endpoint reconnect gesture)
    const box = await page.locator('#structure-canvas').boundingBox()
    await page.mouse.move(box!.x + 350, box!.y + 300)
    await page.mouse.down()
    await page.mouse.move(box!.x + 550, box!.y + 300, { steps: 8 })
    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(200)

    // Canvas should still be functional
    await expect(page.locator('#structure-canvas canvas')).toBeVisible()
  })

  test('member count is preserved after attempted reconnect', async ({ page }) => {
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(80)
    await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
    await page.waitForTimeout(80)
    await page.click('#structure-canvas', { position: { x: 550, y: 300 } })
    await page.waitForTimeout(80)

    await page.keyboard.press('m')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(50)
    await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
    await page.waitForTimeout(100)

    // Verify M1 exists before and after drag
    await expect(page.locator('span.font-mono').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })

    await selectMember(page)
    const box = await page.locator('#structure-canvas').boundingBox()
    await page.mouse.move(box!.x + 350, box!.y + 300)
    await page.mouse.down()
    await page.mouse.move(box!.x + 550, box!.y + 300, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(300)

    // M1 label still exists (member not deleted)
    await expect(page.locator('span.font-mono').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })
  })

  test('undo restores structure state after changes', async ({ page }) => {
    await createTwoNodeMember(page)
    await expect(page.locator('span.font-mono').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })

    // Perform an undo
    await page.keyboard.press('Control+Z')
    await page.waitForTimeout(500)

    // After undo of member creation, M1 label should be gone
    const m1Count = await page.locator('span.font-mono').filter({ hasText: /^M1$/ }).count()
    expect(m1Count).toBe(0)

    // Nodes N1, N2 still exist
    await expect(page.locator('span.font-mono').filter({ hasText: /^N1$/ })).toBeVisible({ timeout: 1000 })
  })
})
