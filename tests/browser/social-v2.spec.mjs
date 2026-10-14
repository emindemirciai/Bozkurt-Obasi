import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { signIn } from './sign-in.mjs';

test('accepted friends exchange private plaintext messages and materials, preserving receipts after reload', async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    const alice = await first.newPage();
    const bob = await second.newPage();
    await signIn(alice);
    await signIn(bob);
    const a = (await (await alice.request.get('/api/player/profile')).json()).user;
    const b = (await (await bob.request.get('/api/player/profile')).json()).user;
    await alice.goto('/#friends');
    await alice.getByLabel('Oyuncu koduyla arkadaş ekle').fill(b.userCode);
    await alice.getByRole('button', { name: 'İstek gönder', exact: true }).click();
    await expect(alice.locator('#notice')).toContainText('Arkadaş');
    await expect(alice.locator('.social-contacts [data-action="openConversation"]')).toHaveCount(0);
    await bob.goto('/#friends');
    await bob.getByRole('button', { name: 'Kabul et', exact: true }).click();
    await expect(bob.locator('.social-contacts [data-action="openConversation"]')).toHaveCount(1);
    await alice.reload();
    await alice.locator('.social-contacts [data-action="openConversation"]').click();
    const message = '<img src=x onerror="window.messageExecuted=true"> Merhaba, oban nasıl?';
    await alice.locator('.private-message-form textarea').fill(message);
    const sentRequest = alice.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/player/friends/messages',
    );
    await alice.locator('.private-message-form button').click();
    const messagePayload = (await sentRequest).postDataJSON();
    await expect(alice.locator('#notice')).toContainText('Mesaj gönderildi');
    await expect(alice.locator('.message-history li p')).toHaveText([message]);
    await expect(alice.locator('.message-history img')).toHaveCount(0);
    expect(await alice.evaluate(() => window.messageExecuted)).toBeUndefined();
    const repeatMessage = await alice.request.post('/api/player/friends/messages', {
      data: messagePayload,
    });
    expect(repeatMessage.status()).toBe(200);
    expect((await repeatMessage.json()).duplicate).toBe(true);

    await bob.locator('.social-contacts [data-action="openConversation"]').click();
    await expect(bob.locator('.message-history li.received p')).toHaveText(message);
    await bob.locator('.private-message-form textarea').fill('Muhafızlar hazır. Teşekkürler!');
    await bob.locator('.private-message-form button').click();
    await expect(bob.locator('#notice')).toContainText('Mesaj gönderildi');
    await alice.reload();
    await alice.locator('.social-contacts [data-action="openConversation"]').click();
    await expect(alice.locator('.message-history li p')).toHaveText([
      message,
      'Muhafızlar hazır. Teşekkürler!',
    ]);

    const sourceBefore = (await (await alice.request.get('/api/state')).json()).state.resources
      .wood;
    const targetBefore = (await (await bob.request.get('/api/state')).json()).state.resources.wood;
    await alice.locator('.asset-gift select').selectOption('resource:wood');
    await alice.locator('.asset-gift input[name="amount"]').fill('25');
    const giftRequest = alice.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/player/friends/gift',
    );
    await alice.locator('.asset-gift button').click();
    const giftPayload = (await giftRequest).postDataJSON();
    await expect(alice.locator('#notice')).toContainText('Hediye gönderildi');
    await expect(alice.locator('.gift-history li')).toContainText('25');
    const sourceAfter = (await (await alice.request.get('/api/state')).json()).state.resources.wood;
    const targetAfter = (await (await bob.request.get('/api/state')).json()).state.resources.wood;
    expect(sourceAfter).toBe(sourceBefore - 25);
    expect(targetAfter).toBe(targetBefore + 25);
    expect(
      (await (await alice.request.post('/api/player/friends/gift', { data: giftPayload })).json())
        .duplicate,
    ).toBe(true);
    expect((await (await alice.request.get('/api/state')).json()).state.resources.wood).toBe(
      sourceAfter,
    );
    await bob.reload();
    await expect(bob.locator('.gift-history li')).toContainText('25');
    await bob.locator('.social-contacts [data-action="openConversation"]').click();
    await bob.setViewportSize({ width: 390, height: 844 });
    expect(await bob.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(bob.locator('.private-message-form textarea')).toBeVisible();
    await mkdir('artifacts', { recursive: true });
    await bob.screenshot({ path: 'artifacts/social-v2-mobile.png', fullPage: true });
    await alice.screenshot({ path: 'artifacts/social-v2-desktop.png', fullPage: true });
    await bob.getByRole('button', { name: 'Arkadaşlıktan çıkar', exact: true }).click();
    await expect(bob.locator('.private-message-form')).toHaveCount(0);
    await expect(bob.locator('.asset-gift')).toHaveCount(0);
    const blocked = await alice.request.get(
      '/api/player/friends/messages?userCode=' + encodeURIComponent(b.userCode),
    );
    expect(blocked.status()).toBe(403);
  } finally {
    await first.close();
    await second.close();
  }
});

test('slow conversation selection wins over refresh and an in-flight state poll locks the outgoing draft', async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  let releaseContact, releaseState;
  try {
    const [alice, bob, charlie] = await Promise.all(contexts.map((context) => context.newPage()));
    for (const page of [alice, bob, charlie]) await signIn(page);
    const [a, b, c] = await Promise.all(
      [alice, bob, charlie].map(
        async (page) => (await (await page.request.get('/api/player/profile')).json()).user,
      ),
    );
    for (const [page, user] of [
      [bob, b],
      [charlie, c],
    ]) {
      expect(
        (
          await alice.request.post('/api/player/friends/request', {
            data: { userCode: user.userCode },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await page.request.post('/api/player/friends/accept', { data: { userCode: a.userCode } })
        ).status(),
      ).toBe(200);
    }
    const clockStart = new Date(Date.now() + 60_000);
    await alice.clock.install({ time: clockStart });
    await alice.clock.pauseAt(new Date(clockStart.getTime() + 1000));
    await alice.goto('/#friends');
    const contact = (userCode) =>
      alice
        .locator('.social-contacts [data-action="openConversation"]')
        .filter({ hasText: userCode });
    await contact(b.userCode).click();
    await expect(alice.locator('.social-conversation > small')).toHaveText(b.userCode);
    let blocked,
      held = false,
      previousContactRefreshes = 0;
    const contactBlocked = new Promise((resolve) => {
      blocked = resolve;
    });
    await alice.route('**/api/player/friends/messages?**', async (route) => {
      const code = new URL(route.request().url()).searchParams.get('userCode');
      if (code === c.userCode && !held) {
        held = true;
        const wait = new Promise((resolve) => {
          releaseContact = resolve;
        });
        blocked();
        await wait;
      } else if (code === b.userCode) previousContactRefreshes++;
      await route.continue();
    });
    await contact(c.userCode).click();
    await contactBlocked;
    for (let i = 0; i < 6; i++) {
      const polled = alice.waitForResponse(
        (response) => new URL(response.url()).pathname === '/api/state',
      );
      await alice.clock.fastForward(1000);
      await polled;
    }
    expect(previousContactRefreshes).toBe(0);
    releaseContact();
    await expect(alice.locator('.social-conversation > small')).toHaveText(c.userCode);
    await alice.locator('.private-message-form textarea').fill('Yanıtım korunmalı.');
    let stateStarted,
      heldState = false;
    const stateBlocked = new Promise((resolve) => {
      stateStarted = resolve;
    });
    await alice.route('**/api/state', async (route) => {
      if (!heldState) {
        heldState = true;
        const wait = new Promise((resolve) => {
          releaseState = resolve;
        });
        stateStarted();
        await wait;
      }
      await route.continue();
    });
    await alice.clock.fastForward(1000);
    await stateBlocked;
    await alice.locator('.private-message-form button').click();
    await expect(alice.locator('.private-message-form textarea')).toBeDisabled();
    await expect(alice.locator('.private-message-form textarea')).toHaveValue('Yanıtım korunmalı.');
    const outgoing = alice.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/player/friends/messages',
    );
    releaseState();
    expect((await outgoing).postDataJSON().body).toBe('Yanıtım korunmalı.');
    await expect(alice.locator('.message-history li p')).toHaveText(['Yanıtım korunmalı.']);
    await expect(alice.locator('.private-message-form textarea')).toBeEnabled();
    await expect(alice.locator('.private-message-form textarea')).toHaveValue('');

    // More than one page can arrive while a background tab is suspended.
    for (let i = 0; i < 16; i++) {
      for (const [page, recipient] of [
        [alice, c],
        [charlie, a],
      ]) {
        expect(
          (
            await page.request.post('/api/player/friends/messages', {
              data: {
                userCode: recipient.userCode,
                body: `Backlog ${i} ${recipient.userCode}`,
                requestId: randomUUID(),
              },
            })
          ).status(),
        ).toBe(200);
      }
    }
    const refreshed = alice.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/player/friends/messages',
    );
    await alice.clock.fastForward(6000);
    await refreshed;
    const earlier = alice.locator('[data-action="olderMessages"]');
    await expect(earlier).toBeVisible();
    await earlier.click();
    await expect(alice.locator('.message-history li p')).toHaveCount(33);
    await expect(alice.locator('.message-history li p').first()).toHaveText('Yanıtım korunmalı.');
  } finally {
    releaseContact?.();
    releaseState?.();
    for (const context of contexts) await context.close();
  }
});
