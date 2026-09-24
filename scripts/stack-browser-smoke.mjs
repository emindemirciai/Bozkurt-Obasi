import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const password = process.env.ADMIN_PASSWORD;
assert.ok(password, 'ADMIN_PASSWORD is required for the browser smoke');
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch();
try {
  const pageErrors = [];
  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  admin.on('pageerror', (error) => pageErrors.push(error.message));
  await admin.goto('http://127.0.0.1:3002/');
  await admin.locator('#email').fill(process.env.ADMIN_EMAIL || 'info@bozkurtobasi.com');
  await admin.locator('#password').fill(password);
  await admin.locator('#login-form button[type=submit]').click();
  await admin.locator('#dashboard:not(.hidden)').waitFor();
  assert.match(await admin.locator('#total').textContent(), /^[\d.,]+$/);
  await admin.locator('#language').click();
  assert.equal(await admin.locator('html').getAttribute('lang'), 'en');
  assert.match(await admin.locator('h1').textContent(), /Keep a watch/);
  await admin.screenshot({ path: 'artifacts/admin-dashboard-preview.png', fullPage: true });

  const analyze = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  analyze.on('pageerror', (error) => pageErrors.push(error.message));
  await analyze.goto('http://127.0.0.1:3003/login');
  await analyze.getByRole('button', { name: 'EN' }).click();
  assert.match(await analyze.locator('h1').textContent(), /Analyze Your Site/);
  await analyze
    .locator('input[type=email]')
    .fill(process.env.ADMIN_EMAIL || 'info@bozkurtobasi.com');
  await analyze.locator('input[type=password]').fill(password);
  await analyze.getByRole('button', { name: 'Sign in' }).click();
  await analyze.waitForURL('http://127.0.0.1:3003/');
  await analyze.locator('main').first().waitFor();
  await analyze.screenshot({ path: 'artifacts/analyze-dashboard-preview.png', fullPage: true });
  assert.deepEqual(pageErrors, []);
  console.log('Admin and analytics browser sign-in, language switch, and dashboard render passed.');
} finally {
  await browser.close();
}
