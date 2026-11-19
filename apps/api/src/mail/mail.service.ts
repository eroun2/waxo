import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  actionLabel?: string;
  actionUrl?: string;
}

interface QueuedEmail {
  id: string;
  options: EmailOptions;
  attempts: number;
  nextAttemptAt: number;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly log = new Logger('MailService');
  private transporter: nodemailer.Transporter | null = null;
  private readonly queue: QueuedEmail[] = [];
  private processingQueue = false;
  private queueInterval: NodeJS.Timeout | null = null;
  private isConfigured = false;

  private readonly maxRetries = 6;
  private readonly retryDelaysMs = [5_000, 15_000, 45_000, 120_000, 300_000, 600_000];

  onModuleInit() {
    this.initTransport();
    // Process retry queue every 3 seconds
    this.queueInterval = setInterval(() => {
      void this.processQueue();
    }, 3_000);
  }

  private initTransport() {
    try {
      // Use public DNS to ensure smtp-relay.brevo.com resolves reliably across platforms without EAI_AGAIN
      const dns = require('dns');
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch {}

    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host) {
      const dns = require('dns');
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        lookup: (hostname: string, opts: any, cb: any) => {
          if (typeof opts === 'function') {
            cb = opts;
            opts = {};
          }
          dns.resolve4(hostname, (err: any, addrs: string[]) => {
            if (!err && addrs && addrs.length > 0) return cb(null, addrs[0], 4);
            dns.lookup(hostname, opts, cb);
          });
        },
        auth: user ? { user, pass } : undefined,
        tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
      } as any);
      this.isConfigured = true;
      this.log.log(`SMTP configured: host=${host}, port=${port}, secure=${secure}, user=${user ? '***' : 'none'}`);
    } else {
      if (process.env.NODE_ENV === 'production') {
        this.log.error(
          '========================================================================\n' +
          '[CRITICAL WARNING] SMTP_HOST is not configured in production!\n' +
          'No real emails will be delivered. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM.\n' +
          '========================================================================'
        );
      } else {
        this.log.warn(
          'SMTP_HOST not set. Development mail catcher (Mailpit on localhost:1025) or logger fallback will be used.'
        );
        // In local development, check if mailpit is available on localhost:1025
        this.transporter = nodemailer.createTransport({
          host: 'localhost',
          port: 1025,
          secure: false,
          ignoreTLS: true,
        });
      }
    }
  }

  /**
   * Main send method used by all services.
   * Enqueues the email into the retry queue and begins dispatch immediately.
   */
  async send(to: string, subject: string, textOrBody: string, options?: Partial<EmailOptions>) {
    const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    
    // Auto-detect links in plain text if actionUrl wasn't provided
    let actionUrl = options?.actionUrl;
    let actionLabel = options?.actionLabel;
    if (!actionUrl) {
      const match = textOrBody.match(/https?:\/\/[^\s]+/);
      if (match) {
        actionUrl = match[0];
        actionLabel = actionLabel || (subject.toLowerCase().includes('verify') ? 'Verify Email' : 'View in WaXo');
      }
    }

    const html = options?.html || this.renderBrandedHtml({
      title: subject,
      body: textOrBody,
      actionUrl,
      actionLabel,
      appUrl,
    });

    const queuedItem: QueuedEmail = {
      id: Math.random().toString(36).substring(2, 10),
      options: {
        to: to.trim(),
        subject,
        text: textOrBody,
        html,
        ...options,
      },
      attempts: 0,
      nextAttemptAt: Date.now(),
    };

    this.queue.push(queuedItem);
    void this.processQueue();
  }

  // ---------- Retry Queue Engine ----------

  private async processQueue() {
    if (this.processingQueue || this.queue.length === 0) return;
    this.processingQueue = true;

    try {
      const now = Date.now();
      const readyItems = this.queue.filter((item) => item.nextAttemptAt <= now);

      for (const item of readyItems) {
        const success = await this.dispatch(item);
        if (success) {
          // Remove from queue
          const idx = this.queue.indexOf(item);
          if (idx !== -1) this.queue.splice(idx, 1);
        } else {
          item.attempts += 1;
          if (item.attempts >= this.maxRetries) {
            this.log.error(
              `Failed to send email to ${item.options.to} ("${item.options.subject}") after ${this.maxRetries} retries. Dropping.`
            );
            const idx = this.queue.indexOf(item);
            if (idx !== -1) this.queue.splice(idx, 1);
          } else {
            const delay = this.retryDelaysMs[item.attempts - 1] || 60_000;
            item.nextAttemptAt = Date.now() + delay;
            this.log.warn(
              `Email to ${item.options.to} ("${item.options.subject}") delivery failed (attempt ${item.attempts}/${this.maxRetries}). Retrying in ${delay / 1000}s.`
            );
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private async dispatch(item: QueuedEmail): Promise<boolean> {
    const from = process.env.MAIL_FROM || 'WaXo Music <noreply@waxo.ug>';
    const { to, subject, text, html } = item.options;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          text,
          html,
        });
        this.log.log(`Email dispatched successfully to ${to} ("${subject}")`);
        return true;
      } catch (err: any) {
        this.log.warn(`SMTP send error for ${to}: ${err.message}`);
        // If not configured in development and Mailpit is offline, log to console as fallback
        if (!this.isConfigured && process.env.NODE_ENV !== 'production') {
          this.logDevFallback(to, subject, text, html);
          return true; // Consider handled for dev environment
        }
        return false;
      }
    } else {
      // In dev fallback without SMTP transporter
      this.logDevFallback(to, subject, text, html);
      return true;
    }
  }

  private logDevFallback(to: string, subject: string, text?: string, html?: string) {
    this.log.log(
      `\n==================== [DEV EMAIL FALLBACK] ====================\n` +
      `TO: ${to}\n` +
      `SUBJECT: ${subject}\n` +
      `BODY:\n${text || '(HTML message)'}\n` +
      `==============================================================\n`
    );
  }

  // ---------- High-Level Mailers ----------

  async sendVerification(to: string, code: string) {
    const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const subject = `Your WaXo verification code: ${code}`;
    const text = `Welcome to WaXo Music!\n\nYour 6-digit verification code is:\n\n${code}\n\nEnter this code on WaXo to activate your account.\nThis verification code expires in 24 hours.\nIf you did not create a WaXo account, you can safely ignore this email.`;

    const html = this.renderBrandedHtml({
      title: 'Verify Your Email Address',
      body: `Thanks for joining WaXo, Uganda's home for authentic music. Use your 6-digit verification code below to verify your email and activate your account.`,
      verificationCode: code,
      appUrl,
      securityNote: 'This verification code expires in 24 hours. Never share your verification code with anyone.',
    });

    await this.send(to, subject, text, { html });
  }

  async sendPasswordReset(to: string, token: string) {
    const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const link = `${appUrl}/reset-password?token=${token}`;
    const subject = 'Reset your WaXo password';
    const text = `We received a request to reset your WaXo password.\n\nClick the link below to choose a new password:\n${link}\n\nThis reset link works once and expires in 1 hour.\nIf you did not request this, please disregard this email. Your password remains unchanged.`;

    const html = this.renderBrandedHtml({
      title: 'Reset Your Password',
      body: `We received a request to reset the password for your WaXo account. Click the button below to set a new password.`,
      actionLabel: 'Reset Password',
      actionUrl: link,
      appUrl,
      securityNote: 'This link works once and expires after 1 hour. If you did not request a password reset, you can safely ignore this email; your account is safe.',
    });

    await this.send(to, subject, text, { html, actionLabel: 'Reset Password', actionUrl: link });
  }

  async sendPasswordChanged(to: string) {
    const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const loginLink = `${appUrl}/login`;
    const subject = 'Your WaXo password was changed';
    const text = `Your WaXo password was successfully changed.\n\nAll existing sessions have been signed out for your security. You can log in with your new password:\n${loginLink}\n\nIf you did not make this change, please contact support immediately.`;

    const html = this.renderBrandedHtml({
      title: 'Password Updated',
      body: `The password for your WaXo account was changed. As a security measure, existing sessions on other devices were signed out.`,
      actionLabel: 'Log In Now',
      actionUrl: loginLink,
      appUrl,
      securityNote: 'If you did not make this change, your account may be compromised. Please reset your password immediately or contact our team.',
    });

    await this.send(to, subject, text, { html, actionLabel: 'Log In Now', actionUrl: loginLink });
  }

  // ---------- Unified Branded HTML Template ----------

  private renderBrandedHtml(params: {
    title: string;
    body: string;
    verificationCode?: string;
    actionLabel?: string;
    actionUrl?: string;
    appUrl?: string;
    securityNote?: string;
  }): string {
    const appUrl = params.appUrl || 'http://localhost:5173';
    const paragraphs = params.body
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #d4d4d8;">${p}</p>`)
      .join('');

    const codeBox = params.verificationCode
      ? `
        <div style="margin: 28px 0; text-align: center;">
          <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #a1a1aa;">
            Verification Code
          </p>
          <div style="display: inline-block; background-color: #1a162b; border: 2px dashed #8b5cf6; border-radius: 14px; padding: 16px 36px; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #c084fc; font-family: monospace;">
            ${params.verificationCode}
          </div>
          <p style="margin: 12px 0 0; font-size: 13px; color: #a1a1aa;">
            Enter this 6-digit code on the site to activate your account.
          </p>
        </div>
      `
      : '';

    const actionButton =
      params.actionUrl && params.actionLabel
        ? `
        <div style="margin: 28px 0; text-align: center;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${params.actionUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="50%" fillcolor="#8b5cf6">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${params.actionLabel}</center>
          </v:roundrect>
          <![endif]-->
          <a href="${params.actionUrl}" target="_blank" style="display: inline-block; background-color: #8b5cf6; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35); mso-hide: all;">
            ${params.actionLabel}
          </a>
        </div>
        <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.5; color: #71717a; text-align: center; word-break: break-all;">
          Or copy and paste this URL into your browser:<br/>
          <a href="${params.actionUrl}" style="color: #a78bfa; text-decoration: underline;">${params.actionUrl}</a>
        </p>
      `
        : '';

    const securityNoteHtml = params.securityNote
      ? `
        <div style="margin-top: 24px; padding: 14px 18px; background-color: #18181b; border: 1px solid #27272a; border-radius: 10px; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
          🛡️ ${params.securityNote}
        </div>
      `
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${params.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #12131a; border: 1px solid #27272a; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Brand Header -->
          <tr>
            <td style="padding: 32px 36px 24px; text-align: center; border-bottom: 1px solid #1f2029; background: linear-gradient(180deg, #181924 0%, #12131a 100%);">
              <a href="${appUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                <span style="font-size: 30px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">Wa<span style="color: #8b5cf6;">Xo</span></span>
              </a>
              <div style="margin-top: 4px; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1.5px; color: #a1a1aa;">
                Uganda's Music Stream & Community
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 36px 28px;">
              <h1 style="margin: 0 0 20px; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; color: #ffffff; text-align: left;">
                ${params.title}
              </h1>
              ${paragraphs}
              ${codeBox}
              ${actionButton}
              ${securityNoteHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 32px; border-top: 1px solid #1f2029; background-color: #0e0f15; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #a1a1aa;">
                WaXo Music · Connecting 146 Districts of Uganda
              </p>
              <p style="margin: 0 0 12px; font-size: 11px; color: #71717a;">
                Kampala, Uganda · Authentic Sounds Straight From the Source
              </p>
              <p style="margin: 0; font-size: 11px; color: #52525b;">
                © ${new Date().getFullYear()} WaXo. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}
