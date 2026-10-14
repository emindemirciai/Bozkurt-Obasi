import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const adminUrl = 'http://127.0.0.1:4175';

test('offline admin preview is responsive, read-only and makes no network requests', async ({
  page,
}) => {
  const errors = [],
    network = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  await page.goto(pathToFileURL(resolve('preview/admin.html')).href);
  await expect(page.locator('#offline-banner')).toContainText('Salt okunur');
  await expect(page.locator('#dashboard')).toBeVisible();
  await page.locator('#tab-users').click();
  await expect(page.locator('#users-list tr')).toHaveCount(20);
  await expect(page.locator('#add-user')).toBeDisabled();
  await page.locator('#users-next').click();
  await expect(page.locator('#users-list tr')).toHaveCount(4);
  await page.locator('#users-list tr').first().getByRole('button').click();
  await expect(page.locator('#admin-dialog .danger')).toBeDisabled();
  await page.locator('#dialog-close').click();
  for (const theme of ['dark', 'light']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page.locator('#theme').click();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const locale of ['en', 'tr']) {
        if ((await page.locator('html').getAttribute('lang')) !== locale)
          await page.locator('#language').click();
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width);
      }
    }
  }
  await page.locator('#tab-logs').click();
  await page.locator('#logs-action').selectOption('player.login');
  await page.locator('#logs-filter button[type=submit]').click();
  await expect(page.locator('#logs-list tr')).toHaveCount(16);
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});

async function signIn(page) {
  await page.goto(adminUrl);
  await page.locator('#email').fill('admin@example.com');
  await page.locator('#password').fill('e2e-admin-password-2026');
  await page.locator('#login-form button[type=submit]').click();
  await expect(page.locator('#dashboard')).toBeVisible();
}

test('administrator can create, inspect, verify and permanently delete a real player with clear logs', async ({
  page,
  request,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = `admin-player-${randomUUID()}@example.com`;
  const password = 'smoke-player-password-2026';
  await signIn(page);
  await page.locator('#tab-users').click();
  await page.locator('#add-user').click();
  const dialog = page.locator('#admin-dialog');
  await dialog.locator('input[name=name]').fill('Smoke Player');
  await dialog.locator('input[name=email]').fill(email);
  await dialog.locator('input[name=password]').fill(password);
  await dialog.locator('button[type=submit]').click();
  await expect(dialog).not.toBeVisible();
  await page.locator('#users-query').fill(email);
  await page.locator('#users-filter button[type=submit]').click();
  const row = page.locator('#users-list tr').filter({ hasText: email });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Smoke Player');
  await expect(row.locator('.badge')).toHaveText('Bekliyor');
  const code = await row.locator('code').innerText();
  await row.getByRole('button').click();
  await expect(dialog).toContainText(code);
  await expect(dialog).toContainText('Kayıt tarihi');
  await expect(dialog).toContainText('Son giriş');
  await expect(dialog).toContainText('350');
  await page.locator('#dialog-close').click();
  const login = await request.post('/api/auth/player/login', { data: { email, password } });
  expect(login.status()).toBe(200);
  expect((await login.json()).verificationRequired).toBe(true);
  expect((await request.get('/api/state')).status()).toBe(403);
  const inbox = await request.get(`http://127.0.0.1:4174/?email=${encodeURIComponent(email)}`);
  const { code: verificationCode } = await inbox.json();
  expect(
    (
      await request.post('/api/auth/player/verify/confirm', { data: { code: verificationCode } })
    ).status(),
  ).toBe(200);
  expect((await request.get('/api/state')).status()).toBe(200);
  await page.locator('#refresh').click();
  await expect(row.locator('.badge')).toHaveText('Doğrulanmış');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/admin-users-desktop.png', fullPage: true });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const locale of ['en', 'tr']) {
      if ((await page.locator('html').getAttribute('lang')) !== locale)
        await page.locator('#language').click();
      await expect(row).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
    }
  }
  await page.screenshot({ path: 'artifacts/admin-users-mobile.png', fullPage: true });
  await row.getByRole('button').click();
  await dialog.getByRole('button', { name: 'Kullanıcıyı kalıcı sil', exact: true }).click();
  const erase = dialog.locator('button[type=submit]');
  await expect(erase).toBeDisabled();
  await dialog.locator('input[name=confirmation]').fill('wrong#0000');
  await expect(erase).toBeDisabled();
  await dialog.locator('input[name=confirmation]').fill(code);
  await expect(erase).toBeEnabled();
  await erase.click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toHaveCount(0);
  expect((await request.get('/api/state')).status()).toBe(401);
  expect(
    (await request.post('/api/auth/player/login', { data: { email, password } })).status(),
  ).toBe(401);
  await page.locator('#tab-logs').click();
  await page.locator('#logs-action').selectOption('admin.user.delete');
  await page.locator('#logs-filter button[type=submit]').click();
  await expect(page.locator('#logs-list')).toContainText('Kullanıcı silindi');
  await expect(page.locator('#logs-list')).not.toContainText(code);
  await expect(page.locator('#logs-list')).not.toContainText(email);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/admin-logs-mobile.png', fullPage: true });
  await page.locator('#logout').click();
  await expect(page.locator('#login-panel')).toBeVisible();
  await expect(page.locator('#dashboard')).not.toBeVisible();
  expect(errors).toEqual([]);
});
