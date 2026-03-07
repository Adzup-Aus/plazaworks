// Email sending via Resend (https://resend.com)
// Free tier: 3,000 emails/month. No Replit required.
// Set RESEND_API_KEY and FROM_EMAIL in .env (e.g. FROM_EMAIL=Plaza Works <onboarding@resend.dev>).

import { Resend } from "resend";

function getFromEmail(): string {
  const from = process.env.FROM_EMAIL;
  if (from) return from;
  // Resend free tier allows sending from onboarding@resend.dev
  return "Plaza Works <onboarding@resend.dev>";
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to .env to send emails, or sign up at https://resend.com (free tier: 3,000 emails/month)."
    );
  }
  return new Resend(apiKey);
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions) {
  const client = getResendClient();
  const from = getFromEmail();

  const result = await client.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  // Resend returns { data, error } and does not throw; check for API errors
  if (result.error) {
    const message = result.error.message ?? JSON.stringify(result.error);

    // In non-production (dev/test), log and continue so local email issues are non-fatal.
    if (process.env.NODE_ENV !== "production") {
      console.warn("Resend email error (non-fatal in non-production):", message, result.error);
      return result;
    }

    const err = new Error(`Resend API error: ${message}`);
    (err as any).resendError = result.error;
    throw err;
  }

  return result;
}

export interface QuoteLineItemForEmail {
  description: string;
  quantity?: string | number;
  unitPrice?: string;
  amount: string;
}

export interface QuotePaymentScheduleForEmail {
  name: string;
  type: string;
  amount: string;
  dueWhen?: string; // e.g. "On acceptance", "30 days after acceptance"
}

export interface SendQuoteNotificationParams {
  clientEmail: string;
  clientName: string;
  quoteNumber: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  validUntil?: string;
  lineItems: QuoteLineItemForEmail[];
  paymentSchedules?: QuotePaymentScheduleForEmail[];
  respondUrl: string;
}

function formatCurrency(value: string): string {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function sendQuoteNotification(params: SendQuoteNotificationParams) {
  const {
    clientEmail,
    clientName,
    quoteNumber,
    subtotal,
    taxRate,
    taxAmount,
    total,
    validUntil,
    lineItems,
    paymentSchedules = [],
    respondUrl,
  } = params;
  const subtotalFmt = formatCurrency(subtotal);
  const taxAmountFmt = formatCurrency(taxAmount);
  const totalFmt = formatCurrency(total);
  const validUntilBlock =
    validUntil &&
    `<tr><td style="padding: 6px 0; color: #4b5563; font-size: 14px;">Valid until</td><td style="padding: 6px 0; text-align: right; font-size: 14px;">${escapeHtml(validUntil)}</td></tr>`;
  const lineItemsTable =
    lineItems.length > 0
      ? `
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0 0; font-size: 14px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="text-align: left; padding: 10px 12px; font-weight: 600; color: #374151;">Description</th>
              <th style="text-align: right; padding: 10px 12px; font-weight: 600; color: #374151;">Qty</th>
              <th style="text-align: right; padding: 10px 12px; font-weight: 600; color: #374151;">Unit Price</th>
              <th style="text-align: right; padding: 10px 12px; font-weight: 600; color: #374151;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems
        .map(
          (item, i) => `
            <tr style="border-bottom: 1px solid #e5e7eb; background: ${i % 2 === 0 ? "#fff" : "#fafafa"};">
              <td style="padding: 10px 12px; color: #1f2937;">${escapeHtml(item.description || "—")}</td>
              <td style="text-align: right; padding: 10px 12px; color: #4b5563;">${escapeHtml(String(item.quantity ?? "—"))}</td>
              <td style="text-align: right; padding: 10px 12px; color: #4b5563;">${escapeHtml(item.unitPrice ?? "—")}</td>
              <td style="text-align: right; padding: 10px 12px; font-weight: 500; color: #1f2937;">${escapeHtml(item.amount ?? "—")}</td>
            </tr>
            `
        )
        .join("")}
          </tbody>
        </table>
      `
      : "";
  const summaryTable = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
      <tr><td style="padding: 6px 0; color: #4b5563;">Subtotal</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(subtotalFmt)}</td></tr>
      <tr><td style="padding: 6px 0; color: #4b5563;">Tax (${escapeHtml(taxRate)}%)</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(taxAmountFmt)}</td></tr>
      <tr style="border-top: 2px solid #e5e7eb;"><td style="padding: 10px 0 0; font-weight: 600; color: #1f2937;">Total</td><td style="padding: 10px 0 0; text-align: right; font-weight: 600; font-size: 18px; color: #1f2937;">${escapeHtml(totalFmt)}</td></tr>
    </table>
  `;
  const paymentScheduleTotal = paymentSchedules.reduce((sum, s) => sum + parseFloat(s.amount) || 0, 0);
  const paymentStructureSection =
    paymentSchedules.length > 0
      ? `
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="font-weight: 600; color: #374151; font-size: 14px; margin-bottom: 10px;">Payment structure (due details)</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="text-align: left; padding: 8px 12px; font-weight: 600; color: #374151;">Payment</th>
                <th style="text-align: right; padding: 8px 12px; font-weight: 600; color: #374151;">Amount</th>
                <th style="text-align: left; padding: 8px 12px; font-weight: 600; color: #374151;">When due</th>
              </tr>
            </thead>
            <tbody>
              ${paymentSchedules
                .map(
                  (s, i) => `
              <tr style="border-bottom: 1px solid #e5e7eb; background: ${i % 2 === 0 ? "#fff" : "#fafafa"};">
                <td style="padding: 10px 12px; color: #1f2937;">${escapeHtml(s.name)}</td>
                <td style="text-align: right; padding: 10px 12px; font-weight: 500; color: #1f2937;">${escapeHtml(formatCurrency(s.amount))}</td>
                <td style="padding: 10px 12px; color: #4b5563;">${escapeHtml(s.dueWhen ?? "—")}</td>
              </tr>
              `
                )
                .join("")}
              <tr style="border-top: 2px solid #e5e7eb; background: #f9fafb;">
                <td style="padding: 10px 12px; font-weight: 600; color: #374151;">Total</td>
                <td style="text-align: right; padding: 10px 12px; font-weight: 600; color: #1f2937;">${escapeHtml(formatCurrency(String(paymentScheduleTotal)))}</td>
                <td style="padding: 10px 12px; color: #6b7280; font-size: 13px;">Equals quote total above</td>
              </tr>
            </tbody>
          </table>
        </div>
      `
      : "";
  return sendEmail({
    to: clientEmail,
    subject: `Quote #${quoteNumber} – ${totalFmt} – Ready for your response`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <p style="font-size: 16px; margin-bottom: 24px;">Hello ${escapeHtml(clientName)},</p>
        <p style="font-size: 15px; line-height: 1.5; margin-bottom: 20px;">A new quote has been prepared for you. Review the details below and use the buttons to accept, reject, or request changes.</p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 14px; color: #4b5563;">Quote number</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 600; font-size: 15px;">${escapeHtml(quoteNumber)}</td>
            </tr>
            ${validUntilBlock ?? ""}
            <tr>
              <td style="padding: 10px 0 6px; font-size: 14px; color: #4b5563;">Quote total</td>
              <td style="padding: 10px 0 6px; text-align: right; font-weight: 700; font-size: 22px; color: #111827;">${escapeHtml(totalFmt)}</td>
            </tr>
          </table>
          ${lineItemsTable}
          ${summaryTable}
          ${paymentStructureSection}
        </div>

        <p style="font-size: 14px; color: #4b5563; margin-bottom: 16px;">Choose an option below. You will confirm your choice on the next page.</p>
        <p style="margin: 20px 0;">
          <a href="${respondUrl}" style="display: inline-block; background: #16a34a; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 4px 8px 4px 0; font-weight: 600; font-size: 14px;">Respond</a>
        </p>
        <p style="color: #6b7280; font-size: 13px; margin-top: 28px;">If you have any questions, please contact us.</p>
      </div>
    `,
    text: `Hello ${clientName},\n\nQuote #${quoteNumber} – Amount due: ${totalFmt}${validUntil ? ` (valid until ${validUntil})` : ""}.\n\nSubtotal: ${subtotalFmt} | Tax: ${taxAmountFmt} | Total: ${totalFmt}${paymentSchedules.length > 0 ? `\n\nPayment structure:\n${paymentSchedules.map((s) => `- ${s.name}: ${formatCurrency(s.amount)}${s.dueWhen ? ` (${s.dueWhen})` : ""}`).join("\n")}` : ""}\n\nRespond: ${respondUrl}`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendInvoiceNotification(
  clientEmail: string,
  clientName: string,
  invoiceNumber: string,
  invoiceTotal: string,
  dueDate: string,
  portalUrl: string
) {
  return sendEmail({
    to: clientEmail,
    subject: `Invoice #${invoiceNumber} - Payment Due ${dueDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${clientName},</h2>
        <p>An invoice has been issued for your recent work.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Amount Due:</strong> ${invoiceTotal}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
        </div>
        <p>You can view and pay this invoice through your client portal:</p>
        <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">View Invoice</a>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for your business!</p>
      </div>
    `,
    text: `Hello ${clientName}, Invoice #${invoiceNumber} for ${invoiceTotal} is due on ${dueDate}. View it at: ${portalUrl}`,
  });
}

export async function sendUserInviteEmail(email: string, acceptInviteUrl: string) {
  return sendEmail({
    to: email,
    subject: "You're invited to Plaza Works",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You're invited to Plaza Works</h2>
        <p>An administrator has invited you to create an account. Click the link below to set your password and get started:</p>
        <a href="${acceptInviteUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">Set your password</a>
        <p style="color: #666; font-size: 14px;">This link will expire in 7 days. If you didn't expect this invite, you can ignore this email.</p>
      </div>
    `,
    text: `You're invited to Plaza Works. Set your password and get started: ${acceptInviteUrl}. This link expires in 7 days.`,
  });
}

export async function sendOtpEmail(email: string, otp: string) {
  return sendEmail({
    to: email,
    subject: "Your Login Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Login Code</h2>
        <p>Use the following code to log in to your account:</p>
        <div style="background: #f5f5f5; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
    text: `Your login code is: ${otp}. This code will expire in 10 minutes.`,
  });
}

export async function sendPasswordResetEmail(email: string, code: string) {
  return sendEmail({
    to: email,
    subject: "Your Password Reset Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>Use the following code to reset your Plaza Works password:</p>
        <div style="background: #f5f5f5; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">Enter this code on the reset password page along with your new password. This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
      </div>
    `,
    text: `Your password reset code is: ${code}. Enter it on the reset password page with your new password. This code will expire in 10 minutes. If you didn't request this, ignore this email.`,
  });
}

export async function sendPaymentLinkEmail(
  clientEmail: string,
  clientName: string,
  invoiceNumber: string,
  amountDue: string,
  paymentLinkUrl: string
) {
  return sendEmail({
    to: clientEmail,
    subject: `Pay Invoice #${invoiceNumber} - ${amountDue} due`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${clientName},</h2>
        <p>Please use the link below to pay your invoice.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Amount Due:</strong> ${amountDue}</p>
        </div>
        <a href="${paymentLinkUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">Pay Now</a>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">Thank you for your business!</p>
      </div>
    `,
    text: `Hello ${clientName}, Please pay invoice #${invoiceNumber} (${amountDue} due) using this link: ${paymentLinkUrl}`,
  });
}

export async function sendJobCompletionNotification(
  clientEmail: string,
  clientName: string,
  jobTitle: string,
  completionDate: string
) {
  return sendEmail({
    to: clientEmail,
    subject: `Job Completed: ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${clientName},</h2>
        <p>Great news! Your job has been completed.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Job:</strong> ${jobTitle}</p>
          <p><strong>Completed On:</strong> ${completionDate}</p>
        </div>
        <p>Thank you for choosing us. We hope you're satisfied with our work!</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any questions or feedback, please don't hesitate to reach out.</p>
      </div>
    `,
    text: `Hello ${clientName}, Your job "${jobTitle}" was completed on ${completionDate}. Thank you for choosing us!`,
  });
}
