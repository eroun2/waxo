// Quick email tester for WaXo Brevo SMTP integration
const path = require('path');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const dotenv = require(path.join(__dirname, '../apps/api/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, '../.env') });

const nodemailer = require(path.join(__dirname, '../apps/api/node_modules/nodemailer'));

const to = process.argv[2] || 'erounbeats1@gmail.com';
const code = Math.floor(100000 + Math.random() * 900000).toString();

console.log(`Connecting to SMTP relay: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}...`);
console.log(`Sending from: ${process.env.MAIL_FROM}`);
console.log(`Sending to: ${to}`);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  lookup: (hostname, opts, cb) => {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    dns.resolve4(hostname, (err, addrs) => {
      if (!err && addrs && addrs.length > 0) return cb(null, addrs[0], 4);
      dns.lookup(hostname, opts, cb);
    });
  },
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((err) => {
  if (err) {
    console.error('SMTP Connection Failed:', err.message);
    process.exit(1);
  }
  console.log('SMTP Connection Verified Successfully!');

  transporter.sendMail(
    {
      from: process.env.MAIL_FROM || 'WaXo Music <c41def001@smtp-brevo.com>',
      to,
      subject: `Your WaXo verification code: ${code}`,
      text: `Welcome to WaXo Music!\n\nYour 6-digit verification code is:\n\n${code}\n\nEnter this code on WaXo to activate your account.\nThis verification code expires in 24 hours.`,
      html: `
        <div style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 40px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #12131a; border: 1px solid #27272a; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                  <!-- Brand Header -->
                  <tr>
                    <td style="padding: 32px 36px 24px; text-align: center; border-bottom: 1px solid #1f2029; background: linear-gradient(180deg, #181924 0%, #12131a 100%);">
                      <span style="font-size: 32px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">Wa<span style="color: #8b5cf6;">Xo</span></span>
                      <div style="margin-top: 4px; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1.5px; color: #a1a1aa;">
                        Uganda's Music Stream & Community
                      </div>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 36px 36px 28px;">
                      <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 800; color: #ffffff;">
                        Verify Your Email Address
                      </h1>
                      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #d4d4d8;">
                        Welcome to WaXo Music! Use the 6-digit verification code below to verify your email address and activate your account.
                      </p>

                      <div style="margin: 28px 0; text-align: center;">
                        <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #a1a1aa;">
                          Your Verification Code
                        </p>
                        <div style="display: inline-block; background-color: #1a162b; border: 2px dashed #8b5cf6; border-radius: 14px; padding: 16px 36px; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #c084fc; font-family: monospace;">
                          ${code}
                        </div>
                        <p style="margin: 12px 0 0; font-size: 13px; color: #a1a1aa;">
                          This verification code expires in 24 hours.
                        </p>
                      </div>

                      <div style="margin-top: 24px; padding: 14px 18px; background-color: #18181b; border: 1px solid #27272a; border-radius: 10px; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
                        🛡️ Never share this code with anyone. If you did not create an account on WaXo, please disregard this email.
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 36px 32px; border-top: 1px solid #1f2029; background-color: #0e0f15; text-align: center;">
                      <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #a1a1aa;">
                        WaXo Music &middot; Connecting 146 Districts of Uganda
                      </p>
                      <p style="margin: 0; font-size: 11px; color: #52525b;">
                        &copy; ${new Date().getFullYear()} WaXo. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      `,
    },
    (sendErr, info) => {
      if (sendErr) {
        console.error('Failed to send email:', sendErr.message);
        process.exit(1);
      }
      console.log('Email sent successfully!');
      console.log('Recipient:', to);
      console.log('Verification Code:', code);
      console.log('Message ID:', info.messageId);
    }
  );
});
