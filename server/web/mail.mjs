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
  // No password means local/first-time deployments stay usable without sending mail.
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
  return {
    enabled: config.enabled,
    async sendVerification(to, token) {
      if (!config.enabled) return false;
      // The fragment never reaches the web server or Referer headers, keeping the token out of access logs.
      const link = `${config.publicUrl}/#verify=${encodeURIComponent(token)}`;
      let timer;
      try {
        await Promise.race([
          sender({
            from: { name: config.fromName, address: ADDRESS },
            to,
            subject: 'Bozkurt Obası — E-posta doğrulama / Verify your email',
            text:
              `Bozkurt Obası hesabının e-posta adresini doğrulamak için bağlantıyı aç. Bağlantı 1 saat geçerlidir:\n${link}\n\n` +
              `Verify your Bozkurt Obası email address. This link expires in 1 hour:\n${link}\n`,
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
    },
  };
}
