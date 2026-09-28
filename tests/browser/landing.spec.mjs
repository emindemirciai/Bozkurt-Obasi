import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGame } from '../../shared/game.mjs';
import { signIn } from './sign-in.mjs';

const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });

test('visual homepage gates game navigation until Google sign-in', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Obanı kur.*Sürünü koru/s })).toBeVisible();
  await expect(page.locator('.landing-header [data-action="play"]')).toHaveCount(0);
  await expect(page.locator('[data-action="play"]')).toHaveCount(0);
  await expect
    .poll(() => page.locator('.landing-hero-art').evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: 'Gizlilik politikası' })).toHaveAttribute(
    'href',
    '/privacy.html',
  );
  await expect(page.getByRole('link', { name: 'Kullanım şartları' })).toHaveAttribute(
    'href',
    '/terms.html',
  );
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/landing-desktop.png', fullPage: true });

  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(
    page.getByRole('heading', { name: /Build your camp.*Protect your herd/s }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.screenshot({ path: 'artifacts/landing-dark-desktop.png', fullPage: true });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/#village');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Welcome to your homeland.' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start playing' })).toHaveCount(0);
  await signIn(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start playing' }).first().click();
  await expect(page.getByRole('heading', { name: 'Welcome to your homeland.' })).toBeVisible();
  await expect(page).toHaveURL(/#village$/);
  await page.getByRole('button', { name: /BOZKURT OBASI/ }).click();
  await expect(
    page.getByRole('heading', { name: /Build your camp.*Protect your herd/s }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('Google sign-in is honest when unavailable and account logout works when configured', async ({
  page,
}) => {
  let authenticated = false;
  let enabled = false;
  let logoutCalls = 0;
  let sessionCalls = 0;
  await page.route('**/api/auth/google/status', (route) =>
    route.fulfill(
      json({
        enabled,
        authenticated,
        ...(authenticated ? { user: { name: 'Player One', email: 'player@example.com' } } : {}),
      }),
    ),
  );
  await page.route('**/api/session', (route) => {
    sessionCalls++;
    return route.fulfill(json({ state: createGame(), revision: 0, mode: 'online' }));
  });
  await page.route('**/api/auth/google/logout', (route) => {
    logoutCalls++;
    authenticated = false;
    return route.fulfill(json({ ok: true }));
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Google ile giriş yap' }).first()).toBeDisabled();
  await expect
    .poll(() =>
      page
        .locator('.google-g')
        .first()
        .evaluate((image) => image.naturalWidth),
    )
    .toBeGreaterThan(0);

  await expect(page.locator('.landing-google-unavailable').first()).toContainText(
    'Oyun için giriş gereklidir.',
  );
  enabled = true;
  authenticated = true;
  await page.goto('/?auth=success');
  await expect(page.getByText('Player One').first()).toBeVisible();
  await expect.poll(() => sessionCalls).toBe(1);
  await expect(page).not.toHaveURL(/auth=success/);
  await page.getByRole('button', { name: 'Hesabı yönet' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('player@example.com');
  await page.getByRole('button', { name: 'Çıkış yap' }).click();
  await expect(page.getByRole('link', { name: 'Google ile giriş yap' }).first()).toHaveAttribute(
    'href',
    '/api/auth/google/start',
  );
  expect(logoutCalls).toBe(1);
});

test('mobile homepage scroll survives passive game updates and offline preview shows the art', async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 844 });
  const saved = createGame();
  saved.resources.wood = 69;
  saved.resources.stone = 30;
  await page.addInitScript(
    (state) => localStorage.setItem('bozkurt.web.v1', JSON.stringify(state)),
    saved,
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Obanı kur.*Sürünü koru/s })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const before = await page.evaluate(() => window.scrollY);
  await page.clock.fastForward(6_100);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(3);
  await page.screenshot({ path: 'artifacts/landing-mobile.png', fullPage: true });

  await page.goto(pathToFileURL(resolve('preview/index.html')).href);
  await expect
    .poll(() => page.locator('.landing-hero-art').evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Google ile giriş yap' }).first()).toBeDisabled();
  await expect
    .poll(() =>
      page
        .locator('.google-g')
        .first()
        .evaluate((image) => image.naturalWidth),
    )
    .toBeGreaterThan(0);

  await expect(page.getByRole('button', { name: 'Oynamaya başla' })).toHaveCount(0);
  await page.goto(pathToFileURL(resolve('preview/index.html')).href + '#village');
  await expect(page.getByRole('heading', { name: /Obanı kur.*Sürünü koru/s })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Yurduna hoş geldin.' })).toHaveCount(0);
});
