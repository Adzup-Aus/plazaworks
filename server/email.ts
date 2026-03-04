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

export async function sendQuoteNotification(
  clientEmail: string,
  clientName: string,
  quoteNumber: string,
  quoteTotal: string,
  portalUrl: string
) {
  return sendEmail({
    to: clientEmail,
    subject: `New Quote #${quoteNumber} Ready for Review`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hello ${clientName},</h2>
        <p>A new quote has been prepared for you.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Quote Number:</strong> ${quoteNumber}</p>
          <p><strong>Total:</strong> ${quoteTotal}</p>
        </div>
        <p>You can review and approve this quote through your client portal:</p>
        <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">View Quote</a>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any questions, please don't hesitate to contact us.</p>
      </div>
    `,
    text: `Hello ${clientName}, A new quote #${quoteNumber} for ${quoteTotal} is ready for review. View it at: ${portalUrl}`,
  });
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
