import "server-only";
import nodemailer from "nodemailer";

function mailConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;
  if (!host || !Number.isInteger(port) || !user || !pass || !from) throw new Error("Email delivery is not configured.");
  return { host, port, user, pass, from };
}

export async function sendPasswordResetCode(email: string, name: string, code: string) {
  const config = mailConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });

  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: "Your Dizon's Petshop password reset code",
    text: `Hello ${name}, your password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#edf4fb;font-family:Arial,sans-serif;color:#0b1e40"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;background:#fff;border-radius:22px;overflow:hidden"><tr><td style="padding:30px;text-align:center;background:#0a2048;color:#fff"><div style="font-size:30px">&#128062;</div><h1 style="margin:8px 0 0;font-family:Georgia,serif">Reset your password</h1></td></tr><tr><td style="padding:34px;text-align:center"><p>Hello <strong>${escapeHtml(name)}</strong>,</p><p style="color:#687a93;line-height:1.6">Enter this verification code to choose a new password.</p><div style="display:inline-block;margin:12px 0;padding:16px 22px;border:2px dashed #2467d1;border-radius:14px;background:#edf4fb;color:#0a2048;font-size:32px;font-weight:800;letter-spacing:8px">${code}</div><p style="color:#687a93;font-size:13px">This code expires in <strong>10 minutes</strong>.</p></td></tr><tr><td style="padding:18px 28px;background:#f6f9fd;text-align:center;color:#8492a6;font-size:12px">If you did not request this reset, you can safely ignore this email.</td></tr></table></td></tr></table></body></html>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
