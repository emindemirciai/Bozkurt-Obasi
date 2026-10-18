import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writePreview } from '../scripts/write-preview.mjs';

test('preview writer preserves UTF-8 bytes and the exact requested file path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bozkurt-preview-'));
  const path = join(directory, 'Örnek önizleme.html');
  const html =
    '<!doctype html><meta charset="UTF-8"><p>Bozkurt Obası · Ay-Yıldız Nöbeti 🐺</p>\r\n';
  try {
    await writePreview(path, html, 'utf8');
    assert.deepEqual(await readFile(path), Buffer.from(html, 'utf8'));
  } finally {
    await unlink(path);
    await rmdir(directory);
  }
});

for (const code of ['UNKNOWN', 'EBUSY', 'EPERM']) {
  test(
    'preview writer retries transient ' + code + ' without changing the write arguments',
    async () => {
      const calls = [],
        delays = [];
      const error = Object.assign(new Error('temporarily locked'), { code, errno: -4094 });
      await writePreview('preview/Örnek.html', 'ay-yıldız', 'utf8', {
        writer: async (...args) => {
          calls.push(args);
          if (calls.length < 3) throw error;
        },
        wait: async (milliseconds) => {
          delays.push(milliseconds);
        },
      });
      assert.deepEqual(delays, [50, 100]);
      assert.equal(calls.length, 3);
      assert.ok(
        calls.every(
          (args) =>
            JSON.stringify(args) === JSON.stringify(['preview/Örnek.html', 'ay-yıldız', 'utf8']),
        ),
      );
    },
  );
}

test('preview writer stops after five transient failures and rethrows the original error', async () => {
  let attempts = 0;
  const delays = [];
  const error = Object.assign(new Error('still locked'), { code: 'UNKNOWN', errno: -4094 });
  await assert.rejects(
    writePreview('preview/index.html', 'html', 'utf8', {
      writer: async () => {
        attempts += 1;
        throw error;
      },
      wait: async (milliseconds) => {
        delays.push(milliseconds);
      },
    }),
    (actual) => actual === error,
  );
  assert.equal(attempts, 5);
  assert.deepEqual(delays, [50, 100, 200, 400]);
});

test('preview writer propagates permanent, unsupported and uncoded failures immediately', async () => {
  for (const code of ['ENOENT', 'ENOSPC', 'EACCES', 'EIO', undefined]) {
    const error = Object.assign(new Error('permanent failure'), code ? { code } : {});
    let attempts = 0,
      waits = 0;
    await assert.rejects(
      writePreview('preview/index.html', 'html', 'utf8', {
        writer: async () => {
          attempts += 1;
          throw error;
        },
        wait: async () => {
          waits += 1;
        },
      }),
      (actual) => actual === error,
    );
    assert.equal(attempts, 1);
    assert.equal(waits, 0);
  }
});
