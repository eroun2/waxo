import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import * as dns from 'dns';
import * as fs from 'fs';

// Ensure public DNS resolver so Brevo SMTP resolves reliably on Windows without EAI_AGAIN
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

// Load environment variables from .env if present
try {
  const envCandidates = [
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
    'C:\\XERO TECHS\\DESKTOP\\waxo\\.env',
  ];
  for (const rootEnv of envCandidates) {
    if (fs.existsSync(rootEnv)) {
      const lines = fs.readFileSync(rootEnv, 'utf-8').split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = (match[2] || '').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) process.env[key] = val;
        }
      }
      break;
    }
  }
} catch {}

function brevoMailPlugin() {
  return {
    name: 'brevo-mail-dev-plugin',
    configureServer(server: any) {
      server.middlewares.use('/__api/send-email', (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        let body = '';
        req.on('data', (c: any) => { body += c; });
        req.on('end', async () => {
          try {
            const { to, code, stageName, displayName } = JSON.parse(body || '{}');
            if (to && code) {
              const mod: any = await import('nodemailer');
              const nodemailer = mod.default || mod;

              // Resolve Brevo relay IP directly to avoid Windows EAI_AGAIN DNS failures
              let relayHost = process.env.SMTP_HOST || '172.246.243.66';
              try {
                const addrs = await dns.promises.resolve4('smtp-relay.brevo.com');
                if (addrs && addrs.length > 0) relayHost = addrs[0];
              } catch {
                relayHost = '172.246.243.66';
              }

              const transporter = nodemailer.createTransport({
                host: relayHost,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: false,
                tls: { servername: 'smtp-relay.brevo.com' },
                auth: {
                  user: process.env.SMTP_USER || '',
                  pass: process.env.SMTP_PASS || '',
                },
              });

              const name = stageName || displayName || 'there';
              console.log(`[Brevo SMTP] Dispatching verification code ${code} to ${to}...`);

              const info = await transporter.sendMail({
                from: process.env.MAIL_FROM || 'WaXo Music <noreply@waxomusic.com>',
                to,
                subject: `Your WaXo verification code: ${code}`,
                text: `Welcome to WaXo Music!\n\nYour 6-digit verification code is:\n\n${code}\n\nEnter this code on WaXo to activate your account.\nThis verification code expires in 24 hours.`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; padding: 40px 16px; color: #f4f4f5;">
                    <div style="max-width: 540px; margin: 0 auto; background-color: #12131a; border: 1px solid #27272a; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                      <div style="padding: 28px 32px; text-align: center; border-bottom: 1px solid #1f2029; background: linear-gradient(180deg, #181924 0%, #12131a 100%);">
                        <span style="font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">Wa<span style="color: #8b5cf6;">Xo</span></span>
                        <div style="margin-top: 4px; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1.5px; color: #a1a1aa;">Uganda's Music Stream & Community</div>
                      </div>
                      <div style="padding: 36px 32px;">
                        <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 800; color: #ffffff;">Verify Your Email Address</h2>
                        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #d4d4d8;">
                          Hello <strong>${name}</strong>,<br/><br/>
                          Welcome to WaXo! Enter the 6-digit verification code below on the site to activate your account.
                        </p>
                        <div style="margin: 28px 0; text-align: center;">
                          <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #a1a1aa;">
                            Your Verification Code
                          </p>
                          <div style="display: inline-block; background-color: #1a162b; border: 2px dashed #8b5cf6; border-radius: 14px; padding: 16px 36px; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #c084fc; font-family: monospace;">
                            ${code}
                          </div>
                          <p style="margin: 12px 0 0; font-size: 13px; color: #a1a1aa;">This verification code expires in 24 hours.</p>
                        </div>
                        <div style="margin-top: 24px; padding: 14px 18px; background-color: #18181b; border: 1px solid #27272a; border-radius: 10px; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
                          🛡️ Never share this code with anyone. If you did not create an account on WaXo, please disregard this email.
                        </div>
                      </div>
                    </div>
                  </div>
                `,
              });

              console.log(`[Brevo SMTP] Success! Email delivered to ${to} (MessageId: ${info.messageId})`);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ ok: true, messageId: info.messageId }));
            }
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Missing to or code' }));
          } catch (err: any) {
            console.error('[Brevo SMTP] Error sending verification email:', err.message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: err?.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), brevoMailPlugin()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (!res.headersSent) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ offline: true }));
            }
          });
        },
      },
    },
  },
});
