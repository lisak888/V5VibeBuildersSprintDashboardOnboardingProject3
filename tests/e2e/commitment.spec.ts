
import { test, expect } from '@playwright/test';

test.describe('Sprint Commitment Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard page
    await page.goto('/');
    
    // Wait for the dashboard to load completely
    await expect(page.locator('h1')).toContainText('Sprint Dashboard');
    await expect(page.locator('[data-testid="future-sprints-section"]', { timeout: 10000 })).toBeVisible();
  });

  test('should prevent more than 2 PTO commitments and block save', async ({ page }) => {
    // Wait for future sprints to be loaded
    await page.waitForSelector('[data-testid="future-sprint-card"]');
    
    // Get all future sprint cards
    const futureSprints = page.locator('[data-testid="future-sprint-card"]');
    await expect(futureSprints).toHaveCount(6);

    // Step 1: Set first three sprints to PTO
    console.log('Setting first sprint to PTO...');
    await futureSprints.nth(0).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="pto"]').first().click();

    console.log('Setting second sprint to PTO...');
    await futureSprints.nth(1).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="pto"]').first().click();

    console.log('Setting third sprint to PTO...');
    await futureSprints.nth(2).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="pto"]').first().click();

    // Step 2: Wait for validation to trigger and check for error message
    console.log('Waiting for validation error to appear...');
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible({ timeout: 5000 });
    
    // Verify the specific error message about PTO maximum
    const errorMessage = page.locator('[data-testid="validation-error"]');
    await expect(errorMessage).toContainText('Maximum 2 PTO sprints allowed');

    // Step 3: Verify that the validation error is prominently displayed
    await expect(errorMessage).toHaveClass(/border-red/);
    await expect(errorMessage).toHaveClass(/bg-red/);

    // Step 4: Check that the save button is either disabled or blocked
    const saveButton = page.locator('[data-testid="save-commitments-btn"]');
    
    if (await saveButton.isVisible()) {
      // If save button is visible, it should be disabled
      await expect(saveButton).toBeDisabled();
      console.log('Save button is disabled as expected');
    } else {
      console.log('Save button is not visible, which is acceptable');
    }

    // Step 5: Try to click save button if it exists and verify it doesn't work
    if (await saveButton.isVisible() && !(await saveButton.isDisabled())) {
      console.log('Attempting to click save button...');
      await saveButton.click();
      
      // Verify that the error message persists after clicking save
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Maximum 2 PTO sprints allowed');
    }

    // Step 6: Verify that the stats section reflects the invalid state
    const statsSection = page.locator('[data-testid="stats-overview"]');
    await expect(statsSection.locator('[data-testid="pto-count"]')).toContainText('3');

    // Step 7: Fix the validation error by changing one PTO back to uncommitted
    console.log('Fixing validation error by removing one PTO...');
    await futureSprints.nth(2).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"]').filter({ hasText: 'Select type...' }).first().click();

    // Step 8: Verify that the validation error disappears
    console.log('Verifying validation error disappears...');
    await expect(errorMessage).not.toBeVisible({ timeout: 5000 });

    // Step 9: Verify that save button becomes enabled (if visible)
    if (await saveButton.isVisible()) {
      await expect(saveButton).toBeEnabled();
    }

    // Step 10: Verify stats are now valid
    await expect(statsSection.locator('[data-testid="pto-count"]')).toContainText('2');
  });

  test('should enforce minimum 2 Build sprints rule', async ({ page }) => {
    // Wait for future sprints to be loaded
    await page.waitForSelector('[data-testid="future-sprint-card"]');
    
    const futureSprints = page.locator('[data-testid="future-sprint-card"]');

    // Set all sprints to non-Build types (5 PTO + 1 Test, which should violate both rules)
    console.log('Setting all sprints to non-Build types...');
    
    // Set first 2 to PTO (maximum allowed)
    await futureSprints.nth(0).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="pto"]').first().click();

    await futureSprints.nth(1).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="pto"]').first().click();

    // Set next 4 to Test
    for (let i = 2; i < 6; i++) {
      await futureSprints.nth(i).locator('[data-testid="sprint-type-select"]').click();
      await page.locator('[role="option"][data-value="test"]').first().click();
    }

    // Verify validation error appears for minimum Build requirement
    const errorMessage = page.locator('[data-testid="validation-error"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText('Minimum 2 Build sprints required');

    // Verify stats show 0 build sprints
    const statsSection = page.locator('[data-testid="stats-overview"]');
    await expect(statsSection.locator('[data-testid="build-count"]')).toContainText('0');
  });

  test('should require descriptions for Build sprints', async ({ page }) => {
    // Wait for future sprints to be loaded
    await page.waitForSelector('[data-testid="future-sprint-card"]');
    
    const futureSprints = page.locator('[data-testid="future-sprint-card"]');

    // Set first sprint to Build without description
    console.log('Setting first sprint to Build...');
    await futureSprints.nth(0).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="build"]').first().click();

    // Set second sprint to Build without description
    console.log('Setting second sprint to Build...');
    await futureSprints.nth(1).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="build"]').first().click();

    // Leave descriptions empty and try to save
    const errorMessage = page.locator('[data-testid="validation-error"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText('All Build sprints require a description');

    // Add description to first Build sprint
    console.log('Adding description to first Build sprint...');
    const firstDescription = futureSprints.nth(0).locator('[data-testid="sprint-description"]');
    await firstDescription.fill('Test build description 1');

    // Error should still be visible because second Build sprint lacks description
    await expect(errorMessage).toBeVisible();

    // Add description to second Build sprint
    console.log('Adding description to second Build sprint...');
    const secondDescription = futureSprints.nth(1).locator('[data-testid="sprint-description"]');
    await secondDescription.fill('Test build description 2');

    // Now validation error should disappear
    await expect(errorMessage).not.toBeVisible({ timeout: 5000 });
  });

  test('should allow valid commitment configuration', async ({ page }) => {
    // Wait for future sprints to be loaded
    await page.waitForSelector('[data-testid="future-sprint-card"]');
    
    const futureSprints = page.locator('[data-testid="future-sprint-card"]');

    // Create a valid configuration: 2 Build, 2 Test, 2 PTO
    console.log('Setting up valid sprint configuration...');

    // First Build sprint
    await futureSprints.nth(0).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="build"]').first().click();
    await futureSprints.nth(0).locator('[data-testid="sprint-description"]').fill('Build sprint 1');

    // Second Build sprint  
    await futureSprints.nth(1).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="build"]').first().click();
    await futureSprints.nth(1).locator('[data-testid="sprint-description"]').fill('Build sprint 2');

    // First Test sprint
    await futureSprints.nth(2).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="test"]').first().click();

    // Second Test sprint
    await futureSprints.nth(3).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="test"]').first().click();

    // First PTO sprint
    await futureSprints.nth(4).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="pto"]').first().click();

    // Second PTO sprint
    await futureSprints.nth(5).locator('[data-testid="sprint-type-select"]').click();
    await page.locator('[role="option"][data-value="pto"]').first().click();

    // Verify no validation errors
    const errorMessage = page.locator('[data-testid="validation-error"]');
    await expect(errorMessage).not.toBeVisible();

    // Verify save button is enabled
    const saveButton = page.locator('[data-testid="save-commitments-btn"]');
    if (await saveButton.isVisible()) {
      await expect(saveButton).toBeEnabled();
      
      // Click save and verify success
      await saveButton.click();
      await expect(page.locator('[data-testid="save-success"]')).toBeVisible({ timeout: 10000 });
    }

    // Verify stats are correct
    const statsSection = page.locator('[data-testid="stats-overview"]');
    await expect(statsSection.locator('[data-testid="build-count"]')).toContainText('2');
    await expect(statsSection.locator('[data-testid="test-count"]')).toContainText('2');
    await expect(statsSection.locator('[data-testid="pto-count"]')).toContainText('2');
  });
});
