import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGame } from '../../shared/game.mjs';
import { signIn } from './sign-in.mjs';

const json = (value) => ({ contentType: 'application/json', body: JSON.stringify(value) });

async function heroGeometry(page) {
  return page.locator('.landing-hero').evaluate((hero) => {
    const bounds = (element) => {
      const { x, y, width, height, bottom, right } = element.getBoundingClientRect();
      return { x, y, width, height, bottom, right };
    };
    const image = hero.querySelector('.landing-hero-art');
    const imageBox = bounds(image);
    const scale = Math.min(
      imageBox.width / image.naturalWidth,
      imageBox.height / image.naturalHeight,
    );
    return {
      hero: bounds(hero),
      image: imageBox,
      title: bounds(hero.querySelector('h1')),
      signIn: bounds(hero.querySelector('.landing-google')),
      fit: getComputedStyle(image).objectFit,
      paintedWidth: image.naturalWidth * scale,
      paintedHeight: image.naturalHeight * scale,
    };
  });
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1905, height: 910 },
  { width: 1920, height: 1080 },
]) {
  test(`complete hero and sign-in fit the first screen in both languages at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    let enabled = true;
    await page.setViewportSize(viewport);
    await page.route('**/api/auth/player/status', (route) =>
      route.fulfill(json({ enabled, emailEnabled: true, authenticated: false })),
    );
    await page.goto('/');
    await expect(page.locator('.landing-google')).toHaveCount(1);
    await expect(page.locator('.landing-google')).toHaveAttribute('href', '/api/auth/google/start');
    await expect
      .poll(() => page.locator('.landing-hero-art').evaluate((image) => image.naturalWidth))
      .toBeGreaterThan(0);
    const tr = await heroGeometry(page);
    await page.getByRole('button', { name: 'Switch to English' }).click();
    const en = await heroGeometry(page);

    for (const geometry of [tr, en]) {
      expect(geometry.hero.bottom).toBeLessThanOrEqual(viewport.height);
      expect(geometry.signIn.y).toBeGreaterThanOrEqual(geometry.hero.y);
      expect(geometry.signIn.bottom).toBeLessThanOrEqual(viewport.height);
      expect(geometry.signIn.right).toBeLessThanOrEqual(viewport.width);
      expect(geometry.fit).toBe('contain');
      expect(geometry.paintedWidth).toBeLessThanOrEqual(geometry.image.width + 0.1);
      expect(geometry.paintedHeight).toBeLessThanOrEqual(geometry.image.height + 0.1);
      expect(geometry.image.y).toBeGreaterThanOrEqual(geometry.hero.y);
      expect(geometry.image.bottom).toBeLessThanOrEqual(geometry.hero.bottom);
    }
    expect(en.hero).toEqual(tr.hero);
    expect(en.image).toEqual(tr.image);
    expect(Math.abs(en.title.height - tr.title.height)).toBeLessThan(1);
    await expect(page.locator('.landing-finale .landing-google')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({
      path: `artifacts/landing-fit-en-${viewport.width}x${viewport.height}.png`,
    });
    await page.getByRole('button', { name: 'Türkçeye geç' }).click();
    await page.screenshot({
      path: `artifacts/landing-fit-tr-${viewport.width}x${viewport.height}.png`,
    });
    enabled = false;
    await page.reload();
    await expect(page.locator('.landing-google')).toBeDisabled();
    await expect(page.locator('.landing-google-unavailable small')).toContainText(
      'E-posta ile giriş yapabilirsin.',
    );
    const unavailable = await heroGeometry(page);
    expect(unavailable.hero).toEqual(tr.hero);
    expect(unavailable.signIn.bottom).toBeLessThanOrEqual(viewport.height);
    expect(unavailable.signIn.y).toBeGreaterThanOrEqual(tr.hero.y);
  });
}

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
  await page.route('**/api/auth/player/status', (route) =>
    route.fulfill(
      json({
        enabled,
        emailEnabled: true,
        authenticated,
        ...(authenticated ? { user: { name: 'Player One', email: 'player@example.com' } } : {}),
      }),
    ),
  );
  await page.route('**/api/session', (route) => {
    sessionCalls++;
    return route.fulfill(json({ state: createGame(), revision: 0, mode: 'online' }));
  });
  await page.route('**/api/auth/player/logout', (route) => {
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
    'E-posta ile giriş yapabilirsin.',
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
  await expect(page.locator('.landing-google')).toHaveCount(1);
  await expect
    .poll(() => page.locator('.landing-hero-art').evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  const mobileImage = await page.locator('.landing-hero-art').evaluate((image) => {
    const bounds = image.getBoundingClientRect();
    return {
      x: bounds.x,
      width: bounds.width,
      height: bounds.height,
      ratio: image.naturalWidth / image.naturalHeight,
      fit: getComputedStyle(image).objectFit,
    };
  });
  expect(mobileImage.x).toBe(0);
  expect(mobileImage.width).toBe(390);
  expect(mobileImage.width / mobileImage.height).toBeCloseTo(mobileImage.ratio, 2);
  expect(mobileImage.fit).toBe('contain');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  const mobileEnImage = await page.locator('.landing-hero-art').boundingBox();
  expect(mobileEnImage.width).toBe(mobileImage.width);
  expect(mobileEnImage.height).toBeCloseTo(mobileImage.height, 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/landing-mobile-en.png', fullPage: true });
  await page.getByRole('button', { name: 'Türkçeye geç' }).click();
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
