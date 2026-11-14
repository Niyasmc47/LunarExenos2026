import { test, expect } from '@playwright/test';

// Deterministic imagery transport for UI tests. Live NASA connectivity is checked separately.
const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=', 'base64');
test.beforeEach(async ({ page }) => {
  await page.route('https://trek.nasa.gov/**', route => route.request().url().endsWith('.jpg') ? route.fulfill({ contentType: 'image/png', body: tile }) : route.abort());
});

test('manual coordinates validate, recenter map, and survive view switches', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('Latitude', { exact: false }).fill('91');
  await page.getByRole('button', { name: 'Apply coordinates' }).click();
  await expect(page.getByRole('alert')).toContainText('Latitude must be');
  await page.locator('#latitude').fill('');
  await page.getByRole('button', { name: 'Apply coordinates' }).click();
  await expect(page.getByRole('alert')).toContainText('valid numbers');
  await page.locator('#latitude').fill('-25'); await page.locator('#longitude').fill('125');
  await page.getByRole('button', { name: 'Apply coordinates' }).click();
  await expect(page.getByTestId('selected-coordinates')).toContainText('25.00000° S, 125.00000° E');
  for (const mode of ['2D MAP', '3D GLOBE', 'SPLIT VIEW']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(page.getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('selected-coordinates')).toContainText('125.00000° E');
  }
  await page.getByRole('button', { name: '2D MAP', exact: true }).click();
  const box = await page.locator('.map-canvas').boundingBox();
  await page.locator('.map-canvas').click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await expect.poll(async () => Number(await page.locator('#latitude').inputValue())).toBeCloseTo(-25, 1);
  await expect.poll(async () => Number(await page.locator('#longitude').inputValue())).toBeCloseTo(125, 1);
  expect(errors).toEqual([]);
});

test('catalogue search, filters, provenance, coverage and keyboard selection', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search places').fill('apollo');
  await expect(page.locator('.site-list button')).toHaveCount(3);
  await page.getByRole('button', { name: /Apollo 12/ }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByTestId('selected-coordinates')).toContainText('3.01280° S, 23.42190° W');
  await page.getByText('Coordinate source and accuracy').click();
  await expect(page.getByRole('link', { name: /NASA NSSDCA/ })).toHaveAttribute('href', /nssdc/);
  await page.getByLabel('Place type').selectOption('Study region');
  await expect(page.locator('.site-list button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await page.getByLabel('Search places').fill('Connecting Ridge');
  await page.locator('.site-list button').click();
  await expect(page.getByTestId('coverage')).toContainText('Inside Site01 terrain footprint');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('coverage')).toContainText('Imagery exploration only here');
  await expect(page.getByTestId('selected-coordinates')).toContainText('0.67416° N');
});

test('globe click updates shared selection; drag does not relocate', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3D GLOBE', exact: true }).click();
  await page.getByRole('button', { name: 'Prime meridian', exact: true }).click();
  const canvas = page.locator('.globe-canvas canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  await canvas.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  await expect.poll(async () => Number(await page.locator('#latitude').inputValue())).toBeCloseTo(0, 0);
  const before = await page.getByTestId('selected-coordinates').textContent();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds!.x + bounds!.width / 2 + 70, bounds!.y + bounds!.height / 2, { steps: 12 }); await page.mouse.up();
  await expect(page.getByTestId('selected-coordinates')).toHaveText(before!);
  await page.getByRole('button', { name: '2D MAP', exact: true }).click();
  await expect(page.getByTestId('map-coordinates')).toHaveText(before!);
});

test('mobile controls and canvases remain reachable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.locator('.map-canvas')).toBeVisible();
  await expect(page.locator('.globe-canvas')).toBeVisible();
  await page.locator('#latitude').fill('-90'); await page.locator('#longitude').fill('180');
  await page.getByRole('button', { name: 'Apply coordinates' }).click();
  await expect(page.getByTestId('selected-coordinates')).toContainText('90.00000° S, 180.00000° E');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Hide location controls' }).click();
  await expect(page.locator('#location-panel')).toBeHidden();
  await page.getByRole('button', { name: 'Show location controls' }).click();
  await expect(page.locator('#latitude')).toBeVisible();
});

test('failed imagery is reported, retry recovers, coordinate flow stays usable', async ({ page }) => {
  await page.unroute('https://trek.nasa.gov/**');
  await page.route('https://trek.nasa.gov/**', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Retry map imagery' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry globe imagery' })).toBeVisible();
  await page.locator('#latitude').fill('10'); await page.locator('#longitude').fill('20');
  await page.getByRole('button', { name: 'Apply coordinates' }).click();
  await expect(page.getByTestId('selected-coordinates')).toContainText('10.00000° N');
  await page.unroute('https://trek.nasa.gov/**');
  await page.route('https://trek.nasa.gov/**', route => route.request().url().endsWith('.jpg') ? route.fulfill({ contentType: 'image/png', body: tile }) : route.abort());
  await page.getByRole('button', { name: 'Retry map imagery' }).click();
  await expect(page.getByRole('button', { name: 'Retry map imagery' })).toBeHidden();
  await page.getByRole('button', { name: 'Retry globe imagery' }).click();
  await expect(page.getByRole('button', { name: 'Retry globe imagery' })).toBeHidden();
});
