import { mkdir, writeFile } from 'node:fs/promises';
import { createMailService } from '../server/web/mail.mjs';
let message;
const mail = createMailService(
  { enabled: true, fromName: 'Bozkurtobasi.com', publicUrl: 'https://bozkurtobasi.com' },
  async (value) => {
    message = value;
  },
);
await mkdir(new URL('../preview/', import.meta.url), { recursive: true });
for (const [method, file] of [
  ['sendVerification', 'mail.html'],
  ['sendPasswordReset', 'password-reset.html'],
]) {
  await mail[method]('preview@example.com', '123456');
  const image = message.attachments[0].content.toString('base64');
  const html = message.html.replace('cid:ayyildiz@bozkurtobasi', `data:image/png;base64,${image}`);
  await writeFile(new URL(`../preview/${file}`, import.meta.url), html);
  console.log(`Offline illustrated email preview: preview/${file} (example code only).`);
}
