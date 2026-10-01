import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { signIn } from './sign-in.mjs';

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
  await expect(page.getByRole('heading', { name: 'Yurduna hoş geldin.' })).toBeVisible();
  await page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true })
    .click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.locator('.profile').click();
  await expect(page.getByRole('dialog')).toContainText('Bozkır Yolcusu');
  await expect(page.getByRole('dialog')).toContainText('E-posta hesabı');
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
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.reload();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
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
  await page.goto('/#village');
  await page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true })
    .click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.locator('.profile').click();
  await expect(
    page.getByRole('link', { name: 'Google hesabını bağla', exact: true }),
  ).toHaveAttribute('href', '/api/auth/google/start');
  await signIn(page, { email, identity });
  await page.goto('/?auth=success#village');
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.locator('.profile').click();
  await expect(page.getByRole('dialog')).toContainText('aynı hesaba ve köye bağlı');
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await signIn(page, { email, identity });
  await page.goto('/?auth=success#village');
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.locator('.profile').click();
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.getByLabel('E-posta', { exact: true }).fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.reload();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
});

test('a Google player can add a password and resume the same village through email sign-in', async ({
  page,
}) => {
  const email = `google-password-${randomUUID()}@example.com`;
  const password = 'Google and password 2026!';
  await signIn(page, { email });
  await page.goto('/#village');
  await page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true })
    .click();
  await page.locator('[data-action="theme"]').click();
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
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
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
  await page.goto('/#village');
  await page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true })
    .click();
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
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.locator('.profile').click();
  await expect(
    page.getByRole('link', { name: 'Google hesabını bağla', exact: true }),
  ).toBeVisible();
  await signIn(page, { email, identity });
  await page.goto('/?auth=success#village');
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await page.locator('.profile').click();
  await expect(page.getByRole('dialog')).toContainText('aynı hesaba ve köye bağlı');
  await page.getByRole('button', { name: 'Çıkış yap', exact: true }).click();
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.getByLabel('E-posta', { exact: true }).fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
});

test('a verification link clears its token from the URL and refreshes the account profile', async ({
  page,
}) => {
  const exposed = [];
  page.on('request', (request) => {
    if (request.url().includes('verify=')) exposed.push(request.url());
    const referrer = request.headers().referer;
    if (referrer?.includes('verify=')) exposed.push(referrer);
  });
  const email = `verify-${randomUUID()}@example.com`;
  const password = 'Verification example 2026!';
  let confirmed = false;
  await page.route('**/api/auth/player/status', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      response,
      contentType: 'application/json',
      body: JSON.stringify({
        ...body,
        mailEnabled: true,
        ...(body.user ? { user: { ...body.user, emailVerified: confirmed } } : {}),
      }),
    });
  });
  await page.route('**/api/auth/player/verify/request', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, sent: true }),
    }),
  );
  await page.route('**/api/auth/player/verify/confirm', (route) => {
    confirmed = true;
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ verified: true }),
    });
  });
  const registered = await page.request.post('/api/auth/player/register', {
    data: { email, password },
  });
  expect(registered.status()).toBe(201);
  await page.goto('/#village');
  await page.locator('.profile').click();
  const resend = page.getByRole('button', { name: 'Doğrulama e-postasını yeniden gönder' });
  await expect(resend).toBeVisible();
  await resend.click();
  await expect(page.getByRole('status')).toContainText('Doğrulama bağlantısı e-postana gönderildi');
  await page.goto(`/#verify=${'v'.repeat(43)}`);
  await expect(page).toHaveURL(/\/$/);
  expect(exposed).toEqual([]);
  await expect(page.getByRole('status')).toContainText('E-posta adresin doğrulandı');
  await page.getByRole('button', { name: 'Hesabı yönet' }).click();
  await expect(
    page.getByRole('button', { name: 'Doğrulama e-postasını yeniden gönder' }),
  ).toHaveCount(0);
  await expect(page.getByRole('dialog')).not.toContainText('E-posta adresi henüz doğrulanmadı');
});
