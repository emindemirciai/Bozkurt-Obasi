import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { projectRoot } from './project-files.mjs';

// Never load a local secret file, print resolved Compose JSON, or use real credentials.
const temporary = await mkdtemp(path.join(tmpdir(), 'bozkurt-compose-env-'));
const environmentFile = path.join(temporary, 'empty.env');
try {
  await writeFile(environmentFile, '');
  const baseEnvironment = {
    ...process.env,
    ADMIN_EMAIL: '',
    ADMIN_PASSWORD: '',
    ADMIN_BOOTSTRAP_EMAIL: '',
    ADMIN_BOOTSTRAP_PASSWORD: '',
    ANALYZE_AUTH_API_URL: '',
    SMTP_PASSWORD: '',
    GOOGLE_CLIENT_SECRET: '',
  };
  const cases = [
    { input: {}, email: 'info@bozkurtobasi.com', password: '' },
    {
      input: {
        ADMIN_BOOTSTRAP_EMAIL: 'bootstrap@example.test',
        ADMIN_BOOTSTRAP_PASSWORD: 'bootstrap-test-secret',
      },
      email: 'bootstrap@example.test',
      password: 'bootstrap-test-secret',
    },
    {
      input: {
        ADMIN_EMAIL: 'primary@example.test',
        ADMIN_PASSWORD: 'primary-test-secret',
        ADMIN_BOOTSTRAP_EMAIL: 'bootstrap@example.test',
        ADMIN_BOOTSTRAP_PASSWORD: 'bootstrap-test-secret',
      },
      email: 'primary@example.test',
      password: 'primary-test-secret',
    },
  ];
  for (const file of ['compose.yml', 'docker-compose.yml']) {
    for (const { input, email, password } of cases) {
      const output = execFileSync(
        'docker',
        ['compose', '--env-file', environmentFile, '-f', file, 'config', '--format', 'json'],
        {
          cwd: projectRoot,
          env: { ...baseEnvironment, ...input },
          encoding: 'utf8',
          timeout: 30_000,
          maxBuffer: 2 * 1024 * 1024,
        },
      );
      const services = JSON.parse(output).services;
      assert.equal(services.api.environment.ADMIN_EMAIL, email);
      assert.equal(services.api.environment.ADMIN_PASSWORD, password);
      assert.equal(services.analyze.environment.ANALYZE_AUTH_API_URL, 'http://api:3000');
      assert.equal(services.analyze.environment.ANALYZE_AUTH_MODE, 'platform-admin');
      for (const service of ['web', 'api', 'admin', 'analyze'])
        assert.ok(services[service].expose.includes('3000'));
    }
  }
  console.log(
    'Compose environment smoke passed: empty credentials stay disabled, bootstrap aliases map to API, canonical values take priority, internal auth URL and all service ports are 3000.',
  );
} finally {
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(tmpdir()));
  assert.ok(path.basename(temporary).startsWith('bozkurt-compose-env-'));
  await rm(temporary, { recursive: true, force: true });
}
