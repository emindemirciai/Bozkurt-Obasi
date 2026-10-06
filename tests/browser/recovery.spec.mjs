import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { signIn, verifyEmail, verificationCode } from './sign-in.mjs';

const originalPassword = 'Eski Bozkir sifresi 2026!';
const newPassword = 'Yeni Bozkir sifresi 2026!';
const extraHTTPHeaders = { 'X-Forwarded-For': '192.0.2.171' };
test.use({ extraHTTPHeaders });

test('password recovery signs out linked Google/email devices and keeps the same village and profile', async ({
  page,
  browser,
}) => {
  const email = `recover-${randomUUID()}@example.com`,
    identity = randomUUID();
  await page.request.post('/api/auth/player/register', {
    data: { email, password: originalPassword, name: 'Kurt Reisi' },
  });
  await verifyEmail(page, email);
  await page.goto('/#village');
  await page
    .locator('.buildings-grid')
    .getByRole('button', { name: 'İnşa et Taş Ocağı', exact: true })
    .click();
  await expect(page.locator('.map-chip')).toHaveText('5 yapı');
  await signIn(page, { email, identity });
  const profile = (await (await page.request.get('/api/player/profile')).json()).user;
  const emailDevice = await browser.newContext({ extraHTTPHeaders }),
    googleDevice = await browser.newContext({ extraHTTPHeaders });
  try {
    expect(
      (
        await emailDevice.request.post('/api/auth/player/login', {
          data: { email, password: originalPassword },
        })
      ).status(),
    ).toBe(200);
    await signIn(googleDevice, { email, identity });
    expect((await googleDevice.request.get('/api/state')).status()).toBe(200);
    await page.request.post('/api/auth/player/logout', { data: {} });
    await page.goto('/');
    await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
    await page.getByLabel('E-posta', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Şifremi unuttum', exact: true }).click();
    await expect(page.locator('#recovery-email')).toHaveValue(email);
    await page.getByRole('button', { name: 'Şifre yenileme kodu gönder' }).click();
    await expect(page.locator('#recovery-code')).toBeVisible();
    await page.locator('#recovery-code').fill(await verificationCode(page, email));
    await page.locator('#recovery-password').fill(newPassword);
    await page.locator('#recovery-confirm-password').fill(newPassword);
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({
      path: 'artifacts/password-recovery-light-desktop.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Şifreyi yenile', exact: true }).click();
    await expect(page.locator('#account-email')).toHaveValue(email);
    await expect(page.locator('#account-password')).toHaveValue('');
    await expect(page.locator('.game-shell')).toHaveCount(0);
    for (const device of [emailDevice, googleDevice]) {
      expect((await device.request.get('/api/state')).status()).toBe(401);
      expect(
        (await (await device.request.get('/api/auth/player/status')).json()).authenticated,
      ).toBe(false);
    }
    expect(
      (
        await page.request.post('/api/auth/player/login', {
          data: { email, password: originalPassword },
        })
      ).status(),
    ).toBe(401);
    await page.locator('#account-password').fill(newPassword);
    await page.getByRole('dialog').getByRole('button', { name: 'Giriş yap', exact: true }).click();
    await expect(page.locator('.map-chip')).toHaveText('5 yapı');
    const { provider, ...expectedProfile } = profile;
    expect((await (await page.request.get('/api/player/profile')).json()).user).toMatchObject(
      expectedProfile,
    );
    await page.reload();
    await expect(page.locator('.map-chip')).toHaveText('5 yapı');
    expect(
      await page.evaluate(
        (secret) => Object.values(localStorage).some((value) => value.includes(secret)),
        newPassword,
      ),
    ).toBe(false);
  } finally {
    await emailDevice.close();
    await googleDevice.close();
  }
});

test('mobile recovery preserves drafts across TR/EN themes, validates confirmation and handles an unknown email', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.getByRole('button', { name: 'Şifremi unuttum', exact: true }).click();
  await page.locator('#recovery-email').fill(`unknown-${randomUUID()}@example.com`);
  await page.getByRole('button', { name: 'Şifre yenileme kodu gönder' }).click();
  await page.locator('#recovery-code').fill('000000');
  await page.locator('#recovery-password').fill(newPassword);
  await page.locator('#recovery-confirm-password').fill('Different new password 2026!');
  await page.getByRole('button', { name: 'Şifreyi yenile', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('eşleşmiyor');
  await expect(page.locator('#recovery-confirm-password')).toBeFocused();
  await page.getByRole('dialog').getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  await page.getByRole('dialog').getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('#recovery-code')).toHaveValue('000000');
  await expect(page.locator('#recovery-password')).toHaveValue(newPassword);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#recovery-confirm-password').fill(newPassword);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('code could not be verified');
  await expect(page.locator('.game-shell')).toHaveCount(0);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/password-recovery-dark-mobile.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Forgot password', exact: true }).click();
  await expect(page.locator('#recovery-code')).toHaveCount(0);
  await expect(page.locator('#recovery-email')).toHaveValue('');
});

test('recovery explains missing mail configuration and keeps normal sign-in available', async ({
  page,
}) => {
  await page.route('**/api/auth/player/status', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        enabled: false,
        emailEnabled: true,
        mailEnabled: false,
        authenticated: false,
      }),
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
  await page.getByRole('button', { name: 'Şifremi unuttum', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Şifre yenileme kodu gönder' })).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('şu anda gönderilemiyor');
  await page.getByRole('button', { name: 'Giriş ekranına dön' }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Giriş yap', exact: true }),
  ).toBeEnabled();
});
