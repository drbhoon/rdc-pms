/**
 * mailer.js — Nodemailer wrapper for sending RM / BH assessment links.
 *
 * Required Railway env vars:
 *   SMTP_HOST    e.g. smtp.gmail.com  OR  smtp.office365.com
 *   SMTP_PORT    587 (STARTTLS) or 465 (SSL)
 *   SMTP_USER    sender email address
 *   SMTP_PASS    app password / SMTP password
 *   SMTP_FROM    display name + address  e.g. "RDC PMS <pms@rdcconcrete.com>"
 *
 * If SMTP_HOST is not set, emails are skipped silently (safe for local dev).
 */
import nodemailer from 'nodemailer';

function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const from = () => process.env.SMTP_FROM || process.env.SMTP_USER || 'RDC PMS <noreply@rdcconcrete.com>';

// ── RM notification (sent when pair is created) ───────────────────────────────
export async function sendRmLink({ rmName, rmEmail, empName, empCode, roleKey, cycle, formUrl }) {
  const transport = getTransport();
  if (!transport) {
    console.log('[mailer] SMTP not configured — skipping RM email to', rmEmail);
    return;
  }

  await transport.sendMail({
    from: from(),
    to:   rmEmail,
    subject: `Action Required: Assessment for ${empName} (${cycle})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;">
        <div style="background:#0f172a;border-radius:8px 8px 0 0;padding:16px 24px;">
          <span style="color:#fff;font-weight:700;font-size:18px;">RDC PMS</span>
          <span style="color:#94a3b8;font-size:13px;margin-left:8px;">Performance Management System</span>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
          <p style="margin:0 0 16px;">Dear <strong>${rmName}</strong>,</p>
          <p style="margin:0 0 16px;">Please complete the assessment for the following employee:</p>
          <table style="border-collapse:collapse;width:100%;margin-bottom:20px;font-size:14px;">
            <tr><td style="padding:6px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;width:140px;">Employee</td><td style="padding:6px 12px;border:1px solid #e2e8f0;">${empName} (${empCode})</td></tr>
            <tr><td style="padding:6px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Role</td><td style="padding:6px 12px;border:1px solid #e2e8f0;">${roleKey}</td></tr>
            <tr><td style="padding:6px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Cycle</td><td style="padding:6px 12px;border:1px solid #e2e8f0;">${cycle}</td></tr>
          </table>
          <div style="text-align:center;margin:24px 0;">
            <a href="${formUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px;">
              Open Assessment Form →
            </a>
          </div>
          <p style="font-size:12px;color:#94a3b8;margin:0;">This link is unique to you. Do not share it. If you have questions, contact your HR team.</p>
        </div>
      </div>
    `,
  });

  console.log('[mailer] RM email sent to', rmEmail, 'for', empName);
}

// ── BH notification (sent when RM submits) ────────────────────────────────────
export async function sendBhLink({ bhName, bhEmail, empName, empCode, roleKey, cycle, formUrl }) {
  const transport = getTransport();
  if (!transport) {
    console.log('[mailer] SMTP not configured — skipping BH email to', bhEmail);
    return;
  }

  await transport.sendMail({
    from: from(),
    to:   bhEmail,
    subject: `Review Required: Assessment for ${empName} (${cycle})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;">
        <div style="background:#0f172a;border-radius:8px 8px 0 0;padding:16px 24px;">
          <span style="color:#fff;font-weight:700;font-size:18px;">RDC PMS</span>
          <span style="color:#94a3b8;font-size:13px;margin-left:8px;">Performance Management System</span>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
          <p style="margin:0 0 16px;">Dear <strong>${bhName}</strong>,</p>
          <p style="margin:0 0 16px;">The RM has submitted their assessment. Please review and finalise:</p>
          <table style="border-collapse:collapse;width:100%;margin-bottom:20px;font-size:14px;">
            <tr><td style="padding:6px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;width:140px;">Employee</td><td style="padding:6px 12px;border:1px solid #e2e8f0;">${empName} (${empCode})</td></tr>
            <tr><td style="padding:6px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Role</td><td style="padding:6px 12px;border:1px solid #e2e8f0;">${roleKey}</td></tr>
            <tr><td style="padding:6px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;">Cycle</td><td style="padding:6px 12px;border:1px solid #e2e8f0;">${cycle}</td></tr>
          </table>
          <div style="text-align:center;margin:24px 0;">
            <a href="${formUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px;">
              Open Review Form →
            </a>
          </div>
          <p style="font-size:12px;color:#94a3b8;margin:0;">This link is unique to you. Do not share it. If you have questions, contact your HR team.</p>
        </div>
      </div>
    `,
  });

  console.log('[mailer] BH email sent to', bhEmail, 'for', empName);
}
