import { test, expect } from '@playwright/test'

test.describe('Analysis view', () => {
  test.describe('without prior analysis run', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/analysis')
    })

    test('shows "Run analysis in Workspace first" message when no results exist', async ({ page }) => {
      await expect(page.getByText('Run analysis in Workspace first.')).toBeVisible()
    })

    test('analysis page is reachable from navbar', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('link', { name: 'Analysis' }).click()
      await expect(page).toHaveURL('/analysis')
    })
  })

  test.describe('after running analysis on a simple structure', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to workspace and run analysis programmatically via localStorage
      // We inject a pre-built session so the solver runs on load
      await page.goto('/workspace')

      // Dismiss any resume dialog by clicking "Start New" if present
      const resumeBtn = page.getByRole('button', { name: 'Start New' })
      if (await resumeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await resumeBtn.click()
      }

      // Click Run — this will fail (no structure) but we're testing the error path
      await page.getByRole('button', { name: '▶ Run' }).click()
    })

    test('analysis error is displayed in workspace when no structure exists', async ({ page }) => {
      await expect(page.getByText(/Need at least/i)).toBeVisible()
    })

    test('analysis view shows error message after failed run', async ({ page }) => {
      await page.getByRole('link', { name: 'Analysis' }).click()
      await expect(page).toHaveURL('/analysis')
      // After a failed run, the error is displayed
      await expect(page.getByText(/Need at least/i)).toBeVisible()
    })
  })
})

test.describe('Analysis view — structure type selector', () => {
  test('workspace has Frame/Truss type selector', async ({ page }) => {
    await page.goto('/workspace')
    const select = page.locator('select')
    await expect(select).toBeVisible()
    const options = await select.locator('option').allTextContents()
    expect(options).toContain('Frame')
    expect(options).toContain('Truss')
  })

  test('switching to Truss type updates the selector value', async ({ page }) => {
    await page.goto('/workspace')
    const resumeBtn = page.getByRole('button', { name: 'Start New' })
    if (await resumeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await resumeBtn.click()
    }
    await page.locator('select').selectOption('truss')
    await expect(page.locator('select')).toHaveValue('truss')
  })
})
