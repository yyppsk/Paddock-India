import net from 'node:net';
import tls from 'node:tls';

const DEFAULT_FROM = 'Paddock India <no-reply@paddockindia.local>';

export async function sendWelcomeEmail({ to, displayName, verificationToken, origin }) {
  const verificationUrl = `${origin}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  await sendMail({
    to,
    subject: 'Welcome to Paddock India',
    text: [
      `Hi ${displayName || 'there'},`,
      '',
      'Welcome to Paddock India.',
      `Verify your email here: ${verificationUrl}`,
      '',
      'Paddock India',
    ].join('\n'),
  });
}

export async function sendPasswordResetEmail({ to, resetToken, origin }) {
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(resetToken)}`;
  await sendMail({
    to,
    subject: 'Reset your Paddock India password',
    text: [
      'We received a request to reset your Paddock India password.',
      `Reset it here: ${resetUrl}`,
      '',
      'If this was not you, ignore this email.',
    ].join('\n'),
  });
}

export async function sendMail({ to, subject, text }) {
  if (!process.env.SMTP_HOST) {
    if (process.env.REQUIRE_SMTP === 'true') {
      throw new Error('SMTP_HOST is required to send email.');
    }

    console.info(`SMTP not configured; skipped email to ${to}: ${subject}`);
    return { skipped: true };
  }

  const client = new SmtpClient();
  await client.send({ to, subject, text, from: process.env.MAIL_FROM || DEFAULT_FROM });
  return { skipped: false };
}

class SmtpClient {
  constructor() {
    this.host = process.env.SMTP_HOST;
    this.port = Number(process.env.SMTP_PORT || 587);
    this.secure = this.port === 465 || process.env.SMTP_SECURE === 'true';
    this.timeoutMs = Math.min(Math.max(Number.parseInt(process.env.SMTP_SEND_TIMEOUT_MS || '', 10) || 10000, 1000), 120000);
    this.socket = null;
    this.buffer = '';
  }

  async send(message) {
    this.socket = await this.connect();

    try {
      await this.readResponse([220]);
      await this.command(`EHLO ${process.env.SMTP_HELO_HOST || 'paddockindia.local'}`, [250]);

      if (!this.secure && process.env.SMTP_STARTTLS !== 'false') {
        await this.command('STARTTLS', [220]);
        this.socket = tls.connect({ socket: this.socket, servername: this.host });
        await new Promise((resolve, reject) => {
          this.socket.once('secureConnect', resolve);
          this.socket.once('error', reject);
        });
        this.buffer = '';
        await this.command(`EHLO ${process.env.SMTP_HELO_HOST || 'paddockindia.local'}`, [250]);
      }

      await this.authenticate();
      await this.command(`MAIL FROM:<${extractEmail(message.from)}>`, [250]);
      await this.command(`RCPT TO:<${extractEmail(message.to)}>`, [250, 251]);
      await this.command('DATA', [354]);
      await this.writeData(formatMessage(message));
      await this.readResponse([250]);
      await this.command('QUIT', [221]);
    } finally {
      this.socket?.destroy();
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = this.secure
        ? tls.connect({ host: this.host, port: this.port, servername: this.host })
        : net.connect({ host: this.host, port: this.port });

      socket.setEncoding('utf8');
      socket.setTimeout(this.timeoutMs);
      socket.once(this.secure ? 'secureConnect' : 'connect', () => resolve(socket));
      socket.once('timeout', () => reject(new Error('SMTP connection timed out.')));
      socket.once('error', reject);
    });
  }

  async authenticate() {
    if (!process.env.SMTP_USER && !process.env.SMTP_PASS) {
      return;
    }

    const auth = Buffer.from(`\0${process.env.SMTP_USER || ''}\0${process.env.SMTP_PASS || ''}`).toString('base64');
    await this.command(`AUTH PLAIN ${auth}`, [235]);
  }

  command(command, expectedCodes) {
    this.socket.write(`${command}\r\n`);
    return this.readResponse(expectedCodes);
  }

  writeData(data) {
    this.socket.write(`${data}\r\n.\r\n`);
  }

  readResponse(expectedCodes) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('SMTP response timed out.'));
      }, this.timeoutMs);

      const onData = (chunk) => {
        this.buffer += chunk;
        const lines = this.buffer.split(/\r?\n/).filter(Boolean);
        const lastLine = lines.at(-1) || '';

        if (!/^\d{3}\s/.test(lastLine)) {
          return;
        }

        const code = Number(lastLine.slice(0, 3));
        cleanup();

        if (expectedCodes.includes(code)) {
          this.buffer = '';
          resolve({ code, response: lines.join('\n') });
        } else {
          reject(new Error(`Unexpected SMTP response ${code}: ${lines.join(' ')}`));
        }
      };

      const onError = (error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.socket.off('data', onData);
        this.socket.off('error', onError);
      };

      this.socket.on('data', onData);
      this.socket.once('error', onError);
    });
  }
}

function formatMessage({ from, to, subject, text }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
  ];
  return `${headers.join('\r\n')}\r\n\r\n${escapeData(text)}`;
}

function escapeData(value) {
  return String(value || '').replace(/^\./gm, '..');
}

function extractEmail(value) {
  const match = String(value || '').match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
}
