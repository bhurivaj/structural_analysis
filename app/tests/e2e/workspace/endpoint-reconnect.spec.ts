import { test, expect, type Page } from '@playwright/test'

// Convert SVG-relative coords to absolute page coords for page.mouse.*
async function svgAbs(page: Page, svgX: number, svgY: number) {
  const box = await page.locator('#structure-canvas').boundingBox()
  return { x: box!.x + svgX, y: box!.y + svgY }
}

// Rubber-band select: drag from (x1,y1) to (x2,y2) in SVG coords
async function rubberBand(page: Page, x1: number, y1: number, x2: number, y2: number) {
  const start = await svgAbs(page, x1, y1)
  const end   = await svgAbs(page, x2, y2)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y)
  await page.mouse.up()
  await page.waitForTimeout(150)
}

// Create 2 nodes at SVG (350,300) and (450,300), draw member between them
async function createTwoNodeMember(page: Page) {
  await page.keyboard.press('n')
  await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
  await page.waitForTimeout(100)

  await page.keyboard.press('n')
  await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
  await page.waitForTimeout(100)

  await page.keyboard.press('m')
  await page.locator('circle.node').nth(0).click()
  await page.waitForTimeout(50)
  await page.locator('circle.node').nth(1).click()
  await page.waitForTimeout(100)
}

// Window-select the member by rubber-band containing both nodes
async function selectMember(page: Page) {
  await page.keyboard.press('s')
  await rubberBand(page, 320, 280, 480, 320)
}

test.describe('Endpoint Reconnect (Member Drag)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/')
    await page.waitForLoadState('networkidle')
  })

  test('endpoint handles appear when single member is selected', async ({ page }) => {
    await createTwoNodeMember(page)

    // No handles before selection
    expect(await page.locator('circle.ep-handle').count()).toBe(0)

    // Select via rubber-band
    await selectMember(page)

    // Handles should appear at both endpoints
    expect(await page.locator('circle.ep-handle').count()).toBe(2)
  })

  test('endpoint handles disappear on deselect', async ({ page }) => {
    await createTwoNodeMember(page)
    await selectMember(page)

    expect(await page.locator('circle.ep-handle').count()).toBe(2)

    // Click empty canvas to deselect
    await page.click('#structure-canvas', { position: { x: 200, y: 200 } })
    await page.waitForTimeout(100)

    expect(await page.locator('circle.ep-handle').count()).toBe(0)
  })

  test('handles do not appear in non-SELECT mode', async ({ page }) => {
    await createTwoNodeMember(page)

    // PAN mode — no handles
    await page.keyboard.press('p')
    await page.waitForTimeout(100)

    expect(await page.locator('circle.ep-handle').count()).toBe(0)
  })

  test('drag endpoint shows ghost line and snap highlight', async ({ page }) => {
    // 3 nodes: N1@350,300 | N2@450,300 | N3@550,300
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(100)

    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
    await page.waitForTimeout(100)

    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 550, y: 300 } })
    await page.waitForTimeout(100)

    // Create member N1-N2
    await page.keyboard.press('m')
    const nodes = page.locator('circle.node')
    await nodes.nth(0).click()
    await page.waitForTimeout(50)
    await nodes.nth(1).click()
    await page.waitForTimeout(100)

    // Select via rubber-band over N1 and N2 only
    await page.keyboard.press('s')
    await rubberBand(page, 320, 280, 480, 320)

    const handles = page.locator('circle.ep-handle')
    expect(await handles.count()).toBe(2)

    // Get first handle, drag toward N3
    const handle = handles.nth(0)
    const handleBox = await handle.boundingBox()
    expect(handleBox).toBeTruthy()

    const n3 = await svgAbs(page, 550, 300)

    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(n3.x, n3.y, { steps: 8 })
    await page.waitForTimeout(100)

    // Ghost line and snap highlight should appear during drag
    expect(await page.locator('line.ep-ghost').count()).toBeGreaterThan(0)
    expect(await page.locator('circle.ep-snap').count()).toBeGreaterThan(0)

    await page.mouse.up()
    await page.waitForTimeout(200)

    // Gone after release
    expect(await page.locator('line.ep-ghost').count()).toBe(0)
    expect(await page.locator('circle.ep-snap').count()).toBe(0)
  })

  test('dragging endpoint to new node reconnects member', async ({ page }) => {
    // Nodes: N1@350,300 | N2@450,300 | N3@550,300
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(100)

    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
    await page.waitForTimeout(100)

    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 550, y: 300 } })
    await page.waitForTimeout(100)

    // Create member N1-N2
    await page.keyboard.press('m')
    const nodes = page.locator('circle.node')
    await nodes.nth(0).click()
    await page.waitForTimeout(50)
    await nodes.nth(1).click()
    await page.waitForTimeout(100)

    // Select via rubber-band over N1 and N2
    await page.keyboard.press('s')
    await rubberBand(page, 320, 280, 480, 320)

    const memberLine = page.locator('line.member').first()
    const x1Before = parseFloat((await memberLine.getAttribute('x1')) ?? '0')

    // Drag start handle to N3
    const startHandle = page.locator('circle.ep-handle').nth(0)
    const handleBox = await startHandle.boundingBox()
    expect(handleBox).toBeTruthy()

    const n3 = await svgAbs(page, 550, 300)

    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(n3.x, n3.y, { steps: 10 })
    await page.waitForTimeout(200)
    await page.mouse.up()
    await page.waitForTimeout(300)

    // x1 should have changed
    const x1After = parseFloat((await memberLine.getAttribute('x1')) ?? '0')
    expect(x1After).not.toBeCloseTo(x1Before, 2)
  })

  test('undo restores original endpoint after reconnect', async ({ page }) => {
    // Nodes: N1@350,300 | N2@450,300 | N3@550,300
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(100)

    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
    await page.waitForTimeout(100)

    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 550, y: 300 } })
    await page.waitForTimeout(100)

    // Create member N1-N2
    await page.keyboard.press('m')
    const nodes = page.locator('circle.node')
    await nodes.nth(0).click()
    await page.waitForTimeout(50)
    await nodes.nth(1).click()
    await page.waitForTimeout(100)

    // Select via rubber-band
    await page.keyboard.press('s')
    await rubberBand(page, 320, 280, 480, 320)

    const memberLine = page.locator('line.member').first()
    const x1Original = parseFloat((await memberLine.getAttribute('x1')) ?? '0')

    // Drag start handle to N3
    const startHandle = page.locator('circle.ep-handle').nth(0)
    const handleBox = await startHandle.boundingBox()
    const n3 = await svgAbs(page, 550, 300)

    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(n3.x, n3.y, { steps: 10 })
    await page.waitForTimeout(200)
    await page.mouse.up()
    await page.waitForTimeout(400)

    const x1Modified = parseFloat((await memberLine.getAttribute('x1')) ?? '0')
    expect(x1Modified).not.toBeCloseTo(x1Original, 2)

    // Undo
    await page.keyboard.press('Control+Z')
    await page.waitForTimeout(500)

    const x1AfterUndo = parseFloat((await memberLine.getAttribute('x1')) ?? '0')
    expect(x1AfterUndo).toBeCloseTo(x1Original, 1)
  })
})
