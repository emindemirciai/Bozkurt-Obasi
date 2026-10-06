import { mkdir, writeFile } from 'node:fs/promises';
import { createMailService } from '../server/web/mail.mjs';
let message;
const mail = createMailService(
  { enabled: true, fromName: 'Bozkurtobasi.com', publicUrl: 'https://bozkurtobasi.com' },
  async (value) => {
    message = value;
  },
);
await mail.sendVerification('preview@example.com', '123456');
const image = message.attachments[0].content.toString('base64');
const html = message.html.replace('cid:ayyildiz@bozkurtobasi', `data:image/png;base64,${image}`);
await mkdir(new URL('../preview/', import.meta.url), { recursive: true });
await writeFile(new URL('../preview/mail.html', import.meta.url), html);
console.log('Offline illustrated email preview: preview/mail.html (example code only).');
