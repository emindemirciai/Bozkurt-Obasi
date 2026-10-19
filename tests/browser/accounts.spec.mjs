import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { signIn, verifyEmail, verificationCode } from './sign-in.mjs';

test('email registration, village progress and login survive logout and reload', async ({
  page,
}) => {
  const email = `village-${randomUUID()}@example.com`;
  const password = '  Bozkırda Ay-Yıldız 2026  ';
  await page.goto('/');
  await page.getByRole('button', { name: 'Kayıt ol', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('E-posta', { exact: true })).toBeFocused();
  await dialog.getByLabel('E-posta', { exact: true }).fill(email.toUpperCase());
  await dialog.getByLabel('Oyuncu adı (isteğe bağlı)').fill('Bozkır Yolcusu');
  await dialog.getByLabel('Şifre', { exact: true }).fill(password);
  await expect(dialog.getByLabel('Şifre', { exact: true })).toHaveAttribute(
    'autocomplete',
    'new-password',
  );
  await dialog.getByRole('button', { name: 'Kayıt ol', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'E-postanı doğrula' })).toBeVisible();
  await page
    .getByLabel('Doğrulama kodu', { exact: true })
    .fill(await verificationCode(page, email));
  await page.getByRole('button', { name: 'Doğrula ve obaya gir' }).click();
  await expect(page.getByRole('heading', { name: 'Yurduna hoş geldin.' })).toBeVisible();
  await page.locator('[data-plot="p0"]').click();
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await page.locator('.profile').click();
  await expect(page.getByLabel('Takma ad', { exact: true })).toHaveValue('Bozkır Yolcusu');
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await expect(page.locator('.game-shell')).toHaveCount(0);
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.getByLabel('E-posta', { exact: true }).fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await expect(page.getByLabel('Şifre', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await page.reload();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  expect(await page.evaluate(() => localStorage.getItem('bozkurt.web.v1'))).toBeNull();
  expect(
    await page.evaluate(
      (secret) => Object.values(localStorage).some((value) => value.includes(secret)),
      password,
    ),
  ).toBe(false);
});

test('account forms remain accessible on mobile and report bilingual errors without exposing a village', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Kayıt ol', exact: true });
  await opener.click();
  await page.getByLabel('E-posta', { exact: true }).fill(`new-${randomUUID()}@example.com`);
  await page.getByLabel('Şifre', { exact: true }).fill('short');
  await page.getByRole('dialog').getByRole('button', { name: 'Kayıt ol', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('12–128 karakter');
  await expect(page.getByLabel('Şifre', { exact: true })).toBeFocused();
  await page.getByRole('dialog').getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('alert')).toContainText('12–128 characters');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('short');
  await page.getByRole('dialog').getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('short');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(`unknown-${randomUUID()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password');
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('email or password is incorrect');
  await expect(page.locator('.game-shell')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Terms of use', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }),
  ).toBeFocused();
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/account-login-dark-mobile.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('.landing-email-actions').getByRole('button', { name: 'Register', exact: true }),
  ).toBeFocused();
  await page
    .locator('.landing-email-actions')
    .getByRole('button', { name: 'Register', exact: true })
    .click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
});

test('email controls work while Google is disabled and the file preview keeps forms offline', async ({
  page,
}) => {
  await page.route('**/api/auth/player/status', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ enabled: false, emailEnabled: true, authenticated: false }),
    }),
  );
  await page.goto('/');
  await expect(page.locator('.landing-google')).toBeDisabled();
  await page.getByRole('button', { name: 'Kayıt ol', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Kayıt ol', exact: true }),
  ).toBeEnabled();
  await page.goto(pathToFileURL(resolve('preview/index.html')).href);
  await page.getByRole('button', { name: 'Kayıt ol', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Kayıt ol', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('yerel sunucuyu veya canlı siteyi aç');
  await expect(page.locator('.game-shell')).toHaveCount(0);
});

test('linking matching Google and email sign-in preserves one village across both methods', async ({
  page,
}) => {
  const email = `linked-${randomUUID()}@example.com`;
  const password = 'Bozkir account shared 2026!';
  const identity = randomUUID();
  const registered = await page.request.post('/api/auth/player/register', {
    data: { email, password, name: 'Shared Player' },
  });
  expect(registered.status()).toBe(201);
  await verifyEmail(page, email);
  await page.goto('/#village');
  await page.locator('[data-plot="p0"]').click();
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await page.locator('.profile').click();
  await expect(
    page.getByRole('link', { name: 'Google hesabını bağla', exact: true }),
  ).toHaveAttribute('href', '/api/auth/google/start');
  await signIn(page, { email, identity });
  await page.goto('/?auth=success#village');
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await page.locator('.profile').click();
  await expect(page.getByRole('dialog')).toContainText('aynı hesaba ve köye bağlı');
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await signIn(page, { email, identity });
  await page.goto('/?auth=success#village');
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await page.locator('.profile').click();
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.getByLabel('E-posta', { exact: true }).fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await page.reload();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
});

test('a Google player can add a password and resume the same village through email sign-in', async ({
  page,
}) => {
  const email = `google-password-${randomUUID()}@example.com`;
  const password = 'Google and password 2026!';
  await signIn(page, { email });
  await page.goto('/#village');
  await page.locator('[data-plot="p0"]').click();
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-action="theme"]')).toHaveCount(0);
  await page.locator('.profile').click();
  await page.getByRole('button', { name: 'Şifre belirle', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('E-posta', { exact: true })).toHaveAttribute('readonly', '');
  await expect(dialog.getByLabel('Şifre', { exact: true })).toBeFocused();
  await dialog.getByLabel('Şifre', { exact: true }).fill(password);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/account-password-dark-desktop.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Şifre belirle', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('aynı hesaba ve köye bağlı');
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.getByLabel('E-posta', { exact: true }).fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
});

test('a matching Google sign-in guides the player through password proof before linking', async ({
  page,
}) => {
  const email = `proof-${randomUUID()}@example.com`;
  const password = 'Matching password proof 2026!';
  const identity = randomUUID();
  const registered = await page.request.post('/api/auth/player/register', {
    data: { email, password },
  });
  expect(registered.status()).toBe(201);
  await verifyEmail(page, email);
  await page.goto('/#village');
  await page.locator('[data-plot="p0"]').click();
  await page.locator('.placement-dialog [data-building-type="quarry"]').click();
  await page.locator('.profile').click();
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await expect(page.locator('.game-shell')).toHaveCount(0);
  await signIn(page, { email, identity, result: 'account_link_required' });
  await page.goto('/?auth=account_link_required');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText(
    'Önce mevcut e-posta hesabına şifrenle giriş yap',
  );
  await expect(page.locator('.game-shell')).toHaveCount(0);
  await dialog.getByLabel('E-posta', { exact: true }).fill(email);
  await dialog.getByLabel('Şifre', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await page.locator('.profile').click();
  await expect(
    page.getByRole('link', { name: 'Google hesabını bağla', exact: true }),
  ).toBeVisible();
  await signIn(page, { email, identity });
  await page.goto('/?auth=success#village');
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
  await page.locator('.profile').click();
  await expect(page.getByRole('dialog')).toContainText('aynı hesaba ve köye bağlı');
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.getByLabel('E-posta', { exact: true }).fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await expect(page.locator('.map-chip')).toHaveText('1 yapı');
});

test('a pending email login requires the emailed code and never places it in a URL', async ({
  page,
}) => {
  const email = `verify-${randomUUID()}@example.com`,
    password = 'Verification example 2026!';
  const registration = await page.request.post('/api/auth/player/register', {
    data: { email, password },
  });
  expect(registration.status()).toBe(201);
  expect((await page.request.get('/api/state')).status()).toBe(403);
  await page.goto('/#village');
  await expect(page.locator('.game-shell')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'E-postanı doğrula' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'E-postanı doğrula' })).toBeVisible();
  const code = await verificationCode(page, email);
  await page.getByLabel('Doğrulama kodu', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Doğrula ve obaya gir' }).click();
  await expect(page.locator('.game-shell')).toBeVisible();
  expect(page.url()).not.toContain(code);
  await page.locator('.profile').click();
  await expect(page.getByLabel('E-posta', { exact: true })).toHaveAttribute('readonly', '');
});
