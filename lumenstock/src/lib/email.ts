const RESEND_API_URL = "https://api.resend.com/emails";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
}

export function getAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

function getFromAddress() {
  return process.env.EMAIL_FROM || "Lumenstock <onboarding@resend.dev>";
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderShell(heading: string, bodyHtml: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f7f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111111;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e4df;border-radius:14px;padding:32px;">
      <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6c6a64;font-weight:600;">Lumenstock</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(heading)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#2b2a27;">${bodyHtml}</div>
      <hr style="border:none;border-top:1px solid #eceae4;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#7a7770;">We never store card details and never auto-renew subscriptions.</p>
    </div>
  </body>
</html>`;
}

async function sendEmail(input: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info(`[Lumenstock email preview] to=${input.to} subject="${input.subject}"\n${input.text}`);
    return { sent: false as const, mode: "console" as const };
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[Lumenstock Resend error] status=${res.status} body=${errText.slice(0, 300)}`);
    return { sent: false as const, mode: "resend_error" as const };
  }
  return { sent: true as const, mode: "resend" as const };
}

export async function sendVerificationEmail(input: { to: string; name: string; token: string }) {
  const verifyUrl = `${getAppBaseUrl()}/api/auth/verify?token=${encodeURIComponent(input.token)}`;
  const safeName = escapeHtml(input.name);
  return sendEmail({
    to: input.to,
    subject: "Verify your Lumenstock email",
    html: renderShell(
      "Confirm your email address",
      `<p>Hi ${safeName},</p>
       <p>Welcome to Lumenstock. Please verify your email address so your account is ready for HD stock licensing and receipts.</p>
       <p style="margin:24px 0;"><a href="${verifyUrl}" style="display:inline-block;padding:12px 22px;background:#111111;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;">Verify email</a></p>
       <p style="font-size:13px;color:#6c6a64;">Or copy this link: ${verifyUrl}</p>
       <p style="font-size:13px;color:#6c6a64;">This link expires in 24 hours.</p>`,
    ),
    text: `Hi ${input.name},\n\nVerify your Lumenstock email by opening:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendPasswordResetEmail(input: { to: string; name: string; token: string }) {
  const resetUrl = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(input.token)}`;
  const safeName = escapeHtml(input.name);
  return sendEmail({
    to: input.to,
    subject: "Reset your Lumenstock password",
    html: renderShell(
      "Reset your password",
      `<p>Hi ${safeName},</p>
       <p>We received a request to reset your Lumenstock password. Click below to choose a new password.</p>
       <p style="margin:24px 0;"><a href="${resetUrl}" style="display:inline-block;padding:12px 22px;background:#111111;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;">Reset password</a></p>
       <p style="font-size:13px;color:#6c6a64;">This link expires in 60 minutes. If you didn’t request this, you can safely ignore this email.</p>`,
    ),
    text: `Hi ${input.name},\n\nReset your Lumenstock password here (expires in 60 minutes):\n${resetUrl}`,
  });
}

export async function sendPaymentReceiptEmail(input: {
  to: string;
  name: string;
  planLabel: string;
  amountFormatted: string;
  credits: number;
}) {
  const browseUrl = `${getAppBaseUrl()}/browse`;
  return sendEmail({
    to: input.to,
    subject: `Lumenstock receipt — ${input.planLabel}`,
    html: renderShell(
      "Your HD downloads are unlocked",
      `<p>Hi ${escapeHtml(input.name)},</p>
       <p>Thank you for your purchase on Lumenstock. Your payment was confirmed and your download credits are active right away.</p>
       <ul style="padding-left:18px;">
         <li><strong>Plan / Pack:</strong> ${escapeHtml(input.planLabel)}</li>
         <li><strong>Amount paid:</strong> ${escapeHtml(input.amountFormatted)}</li>
         <li><strong>Credits added:</strong> ${input.credits} HD downloads</li>
       </ul>
       <p style="margin:24px 0;"><a href="${browseUrl}" style="display:inline-block;padding:12px 22px;background:#111111;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;">Browse 11,300+ HD images</a></p>`,
    ),
    text: `Hi ${input.name},\n\nPayment received for ${input.planLabel} (${input.amountFormatted}). ${input.credits} HD download credits have been added to your account.\n\nBrowse images: ${browseUrl}`,
  });
}

export async function sendRenewalReminderEmail(input: {
  to: string;
  name: string;
  planId: string;
  expiresAt: string;
}) {
  const renewUrl = `${getAppBaseUrl()}/pricing?renew=${encodeURIComponent(input.planId)}`;
  const dateLabel = new Date(input.expiresAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return sendEmail({
    to: input.to,
    subject: "Your Lumenstock plan ends soon — renew with one click",
    html: renderShell(
      "Ready to renew your plan?",
      `<p>Hi ${escapeHtml(input.name)},</p>
       <p>Because Lumenstock never auto-renews or stores card details, your current plan ends on <strong>${escapeHtml(dateLabel)}</strong>.</p>
       <p>If you’d like to continue downloading HD images, use the one-time renewal link below:</p>
       <p style="margin:24px 0;"><a href="${renewUrl}" style="display:inline-block;padding:12px 22px;background:#111111;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;">Renew on Pricing</a></p>`,
    ),
    text: `Hi ${input.name},\n\nYour Lumenstock plan ends on ${dateLabel}. Because we never auto-renew, renew anytime here:\n${renewUrl}`,
  });
}
