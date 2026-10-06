import { readFileSync } from 'node:fs';
const ADDRESS = 'info@bozkurtobasi.com';
const DEFAULT_NAME = 'Bozkurtobasi.com';
const DEFAULT_FROM = `${DEFAULT_NAME} <${ADDRESS}>`;

function setting(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Outgoing mail is optional locally; a partially configured production SMTP is an error. */
export function mailConfig({
  provider = process.env.MAIL_PROVIDER,
  from = process.env.MAIL_FROM,
  host = process.env.SMTP_HOST,
  port = process.env.SMTP_PORT,
  secure = process.env.SMTP_SECURE,
  user = process.env.SMTP_USER,
  password = process.env.SMTP_PASSWORD,
  publicUrl = process.env.PUBLIC_URL,
} = {}) {
  const values = [host, port, secure, user, password].map(setting);
  const mailProvider = setting(provider);
  if (mailProvider && mailProvider !== 'smtp') throw new Error('MAIL_PROVIDER must be smtp.');
  const requestedFrom = setting(from);
  let validatedFrom = DEFAULT_FROM;
  let fromName = DEFAULT_NAME;
  if (requestedFrom) {
    const match = /^([^<>,;:"\\\r\n\x00-\x1f\x7f]{1,80})\s+<([^<>\s]+)>$/.exec(requestedFrom);
    if (!match || match[2].toLowerCase() !== ADDRESS)
      throw new Error('MAIL_FROM must use info@bozkurtobasi.com.');
    fromName = match[1].trim();
    if (!fromName) throw new Error('MAIL_FROM must include a display name.');
    validatedFrom = `${fromName} <${ADDRESS}>`;
  }
  // Deployment templates include public SMTP settings but intentionally omit the secret.
  // Without SMTP, public pages and Google remain available; email accounts stay pending.
  if (!values[4]) return { enabled: false };
  if (values.some((value) => !value)) throw new Error('Complete SMTP configuration is required.');
  const [smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword] = values;
  if (/\s|[\x00-\x1f\x7f]/.test(smtpHost) || /[\r\n\x00]/.test(smtpUser))
    throw new Error('Invalid SMTP configuration.');
  if (!['465', '587'].includes(smtpPort)) throw new Error('SMTP_PORT must be 465 or 587.');
  if (!['true', 'false'].includes(smtpSecure))
    throw new Error('SMTP_SECURE must be true or false.');
  if ((smtpPort === '465') !== (smtpSecure === 'true'))
    throw new Error('SMTP_PORT and SMTP_SECURE must select implicit or required TLS.');
  let origin;
  try {
    const url = new URL(setting(publicUrl));
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    )
      throw new Error('non-canonical origin');
    origin = url.origin;
  } catch {
    throw new Error('PUBLIC_URL must be a canonical HTTPS origin.');
  }
  return {
    enabled: true,
    host: smtpHost,
    port: Number(smtpPort),
    secure: smtpSecure === 'true',
    user: smtpUser,
    password: smtpPassword,
    publicUrl: origin,
    from: validatedFrom,
    fromName,
  };
}

export function createMailService(config, injectedSender, sendTimeoutMs = 5000) {
  let transport;
  async function sender(message) {
    if (injectedSender) return injectedSender(message);
    if (!transport) {
      const { default: nodemailer } = await import('nodemailer');
      transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        requireTLS: !config.secure,
        connectionTimeout: 3500,
        greetingTimeout: 3500,
        socketTimeout: 4000,
        tls: { minVersion: 'TLSv1.2' },
        auth: { user: config.user, pass: config.password },
      });
    }
    return transport.sendMail(message);
  }
  async function sendCode(to, code, recovery = false) {
    if (!config.enabled) return false;
    if (!/^[0-9]{6}$/.test(code)) throw new Error('Invalid verification code.');
    const illustration = readFileSync(new URL('./assets/formation.png', import.meta.url));
    const heading = recovery
      ? 'Şifreni yenile / Reset your password'
      : 'E-posta adresini doğrula / Verify your email';
    const instructionTr = recovery
      ? 'Şifreni yenilemek için bu altı haneli kodu şifre kurtarma ekranına yaz. Kod 15 dakika geçerlidir. Şifre değiştiğinde tüm cihazlardaki oturumların kapatılır.'
      : 'Oyuna girmek için bu altı haneli kodu doğrulama ekranına yaz. Kod 15 dakika geçerlidir.';
    const instructionEn = recovery
      ? 'Enter this six-digit code on the password recovery screen. It expires in 15 minutes. Resetting your password signs you out on every device.'
      : 'Enter this six-digit code on the verification screen to unlock your village. It expires in 15 minutes.';
    const ignore = recovery
      ? 'Şifre yenilemeyi sen istemediysen mesajı yok say. Şifren değişmez. Kodu kimseyle paylaşma.<br>If you did not request a password reset, ignore this email. Your password stays unchanged. Never share the code.'
      : 'Bu kaydı sen yapmadıysan mesajı yok say. Kodu kimseyle paylaşma.<br>If you did not create this account, ignore this email. Never share the code.';
    const html = `<html><body style="margin:0;background:#eee9dc;font-family:Arial,sans-serif;color:#233b30"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fffdf4;border-radius:16px;overflow:hidden"><tr><td style="padding:24px;background:#233e31;color:#edd49b"><h1 style="margin:0;font-size:24px">Bozkurt Obası</h1><p style="margin:8px 0 0">Obanı kur, sürünü koru. / Build your village, protect your herd.</p></td></tr><tr><td><img src="cid:ayyildiz@bozkurtobasi" width="600" alt="Hilal şeklindeki muhafız kurtlar, yıldız düzenindeki sürüyü korur. Crescent wolves protect the star-shaped herd." style="display:block;width:100%;height:auto"></td></tr><tr><td style="padding:28px"><h2 style="font-size:20px">${heading}</h2><p>${instructionTr}</p><p>${instructionEn}</p><p style="font-size:36px;letter-spacing:8px;font-weight:bold;text-align:center;padding:20px;background:#e9eddd;border-radius:12px">${code}</p><p style="font-size:13px;color:#52634f">Hilal kurtların savunma hattıdır; yıldız ise korunan sürünün düzenidir.<br>The crescent is the wolves’ defense line; the star is the protected herd’s formation.</p><p>${ignore}</p><p><a href="${config.publicUrl}" style="color:#34573f">bozkurtobasi.com</a></p></td></tr></table><p style="font-size:12px">© 2026 Bozkurt Obası</p></td></tr></table></body></html>`;
    let timer;
    try {
      await Promise.race([
        sender({
          from: { name: config.fromName, address: ADDRESS },
          to,
          subject: recovery
            ? 'Bozkurt Obası — Şifre yenileme / Reset your password'
            : 'Bozkurt Obası — E-posta doğrulama / Verify your email',
          text: recovery
            ? `Bozkurt Obası şifre yenileme kodu: ${code}\n${instructionTr}\n\nBozkurt Obası password reset code: ${code}\n${instructionEn}\n\nŞifre yenilemeyi sen istemediysen mesajı yok say. Kodu kimseyle paylaşma.\nIf you did not request a reset, ignore this email. Never share the code.\n`
            : `Bozkurt Obası doğrulama kodu: ${code}\nKod 15 dakika geçerlidir. Doğrulanana kadar oyun kapalıdır.\n\nBozkurt Obası verification code: ${code}\nExpires in 15 minutes. Verify before entering your village.\n`,
          html,
          attachments: [
            {
              filename: 'ay-yildiz-duzeni.png',
              content: illustration,
              contentType: 'image/png',
              cid: 'ayyildiz@bozkurtobasi',
              contentDisposition: 'inline',
            },
          ],
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            transport?.close?.();
            transport = undefined;
            reject(new Error('SMTP delivery timed out'));
          }, sendTimeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    return true;
  }
  return {
    enabled: config.enabled,
    sendVerification: (to, code) => sendCode(to, code),
    sendPasswordReset: (to, code) => sendCode(to, code, true),
  };
}
