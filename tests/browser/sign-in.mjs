import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';

// The browser test server signs mock Google tokens; production never uses this provider.
export async function signIn(page, { email, identity = randomUUID(), result = 'success' } = {}) {
  const start = await page.request.get('/api/auth/google/start', { maxRedirects: 0 });
  expect(start.status()).toBe(302);
  const authorization = new URL(start.headers().location);
  expect(authorization.origin).toBe('https://accounts.google.com');
  const state = authorization.searchParams.get('state');
  const nonce = authorization.searchParams.get('nonce');
  const code = [nonce, identity, ...(email ? [Buffer.from(email).toString('base64url')] : [])].join(
    '.',
  );
  const callback = await page.request.get(
    `/api/auth/google/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`,
    { maxRedirects: 0 },
  );
  expect(callback.status()).toBe(303);
  expect(callback.headers().location).toBe(`/?auth=${result}`);
}

export async function verificationCode(page, email) {
  const response = await page.request.get(
    'http://127.0.0.1:4174/?email=' + encodeURIComponent(email),
  );
  expect(response.status()).toBe(200);
  return (await response.json()).code;
}
export async function verifyEmail(page, email) {
  const code = await verificationCode(page, email);
  const response = await page.request.post('/api/auth/player/verify/confirm', { data: { code } });
  expect(response.status()).toBe(200);
}
